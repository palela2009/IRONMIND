# Code review — 1 November 2026

The code is not perfect or ready for an unconditional release approval. This review covered the app's authentication, monitoring, progress queue, rewards, purchases, account deletion, social flows, and backend transaction paths, together with build configuration. Passing checks cover particular cases and do not establish correctness of every runtime path.

This document records the pre-fix findings. The subsequent [bug-fix report](bug-fixes-2026-11-01.md) describes the local fixes for findings 1–5, the improved settings validation for finding 6, and the remaining device-verification limitation. The original comment-cleanup pass itself changed explanatory comments only.

## Findings

### P1 — Repeated shop requests can charge repeatedly for one cosmetic

Location: [coinRoutes.ts](../../IRONMIND-backend/src/routes/coinRoutes.ts:44), especially the balance update at line 106.

Ownership is checked in a separate read. The final update filters by sufficient balance but does not require the cosmetic still to be unowned. Concurrent requests therefore pass the same ownership check and each deduct coins while `$addToSet` stores only one item. The same read/check/update pattern exists for the once-per-month Pro purchase.

Reproduced in a temporary MongoDB replica set: eight simultaneous requests for a 200-coin theme produced five successful purchases, deducted 1,000 coins, and added one owned theme. No production data was used.

Fix: transactionally check ownership/month eligibility with the debit, and use a persisted purchase ID so a retry after a lost response cannot charge again.

### P1 — Account deletion removes active duels without refunding opponents

Location: [userRoutes.ts](../../IRONMIND-backend/src/routes/userRoutes.ts:99), specifically `Duel.deleteMany` at line 108.

The account deletion path deletes every associated duel directly, bypassing the transactional cancellation/refund service. The surviving player loses the entry fee and the duel record needed to recover it.

Reproduced locally: an opponent with 400 coins after a 100-coin entry remained at 400 after the other account was deleted; the duel no longer existed. The expected refunded balance was 500.

The same deletion path also catches Firebase deletion failure and still returns HTTP 200. The temporary Firebase mock deliberately lacked the deletion operation, demonstrating that an auth deletion failure is reported to the client as success. The new `ChallengeDay` records and new account-specific local caches are also absent from the existing deletion cleanup.

Fix: make deletion a retryable operation, settle/refund financial obligations first, remove all account data, and do not report completion before Firebase deletion succeeds.

### P1 — One permanently rejected challenge blocks all later uploads

Location: [useStats.ts](../src/hooks/useStats.ts:74).

The queue always processes its first entry. Every non-2xx response throws before that entry is removed or moved aside. A permanent 400 response, for example from an invalid timestamp, is retried forever ahead of valid later results. The UI's retry control repeats the same failing request.

Fix: separate permanent validation failures from temporary network/server failures, preserve rejected entries for inspection/recovery, and continue processing later valid results. Do not discard the only local copy silently.

### P2 — Android and the backend disagree about when a day starts

Locations: [TrustedClock.kt](../android/app/src/main/java/com/anonymous/IRONMIND/TrustedClock.kt:45), [challenges.ts](../../IRONMIND-backend/src/services/challenges.ts:40), [progressState.ts](../src/utils/progressState.ts:26).

Android's challenge quota uses a pinned local time zone. The backend and offline projection use UTC dates. At 00:30 on 1 November in Tbilisi, the backend still groups a challenge under 31 October. A user who has already used the previous UTC day's quota may receive local challenges after midnight that do not count toward server stats/rewards. Home's day grouping is local as well.

Fix: define one consistent account day boundary and use it for native counters, pending result projection, server quotas, and display. A time-zone change policy must prevent users repeatedly resetting their allowance.

### P2 — First-time Pro purchase can show success while Pro is still inactive

Locations: [ProContext.tsx](../src/context/ProContext.tsx:119), [ProScreen.tsx](../src/screens/ProScreen.tsx:42), [proRoutes.ts](../../IRONMIND-backend/src/routes/proRoutes.ts:105).

The purchase function returns `purchased` even if the backend sync fails. ProScreen then says every Pro feature is unlocked. A first-time buyer whose profile still has a free source is not covered by the backend's automatic recheck, which only runs for an existing store-sourced profile. Manual restore or a later RevenueCat webhook may recover it, but there is no durable client retry for that confirmation.

The checked-in RevenueCat key is currently empty, so this purchase path is disabled until configured. It must be fixed before enabling paid purchases.

Fix: represent a charged-but-awaiting-confirmation state, persist and retry purchase verification, and show the actual entitlement outcome.

### P2 — Reward validation still trusts client-originated success reports

Location: [challenges.ts](../../IRONMIND-backend/src/services/challenges.ts:15).

Stable event IDs and server quotas stop replaying a recorded reward. They do not establish that the phone really ran the challenge. A modified client can submit new event IDs and claim wins with a short elapsed time. The server also accepts a successful elapsed time below 10 seconds regardless of the configured 3/5/10-second difficulty.

Fix: enforce the appropriate challenge parameters and time bounds. Stronger proof of legitimate device activity needs a separate verification design; a hardcoded client secret would not solve it.

## Device cases still needing verification

- Locking the screen during a challenge: the service selects foreground apps from resume events and falls back to the last resumed package. It does not explicitly handle screen-off/paused events for challenge completion. Verify that locking does not incorrectly record a loss.
- Native service process death and restoration during an active challenge or pending win.
- Results uploaded after a long offline period or from multiple devices, including ordering and account switches.
- Android manufacturer battery restrictions and reboot behavior.
- RevenueCat purchase, refund, cancellation, restore, and delayed webhook behavior with a configured test store account.

## Comment cleanup

Removed explanatory comments from these five files:

1. [android/app/build.gradle](../android/app/build.gradle)
2. [android/build.gradle](../android/build.gradle)
3. [android/gradle.properties](../android/gradle.properties)
4. [android/app/proguard-rules.pro](../android/app/proguard-rules.pro)
5. [android/app/src/main/res/drawable/rn_edit_text_material.xml](../android/app/src/main/res/drawable/rn_edit_text_material.xml)

App/backend JavaScript, TypeScript, and Kotlin source already had no ordinary explanatory comments. The scan uses the JavaScript parser for those files, so URLs and strings containing `//` are not damaged.

Retained two intentional exceptions: the TypeScript compiler directive `// @ts-ignore` in [firebase.ts](../src/config/firebase.ts:2), and the Android Open Source Project copyright/license notice in the XML resource. Vendored dependencies, generated output, and Gradle wrapper tooling were excluded from source cleanup.

This report is the sixth changed/added file in this pass. Before-change copies of the five edited files are saved in `C:/Users/admin/.codex-backups/ironmind-2026-11-01-comment-cleanup`.

## Validation

- App TypeScript check passed.
- Four existing offline-progress tests passed.
- Twelve existing backend tests passed, followed by two temporary reproduction checks confirming the purchase and deletion issues above. The reproduction checks assert the current buggy behavior; they are evidence of bugs, not fixes.
- Android debug build passed after comment removal.
- Source scan found only the compiler directive and license notice described above.
- No live account data was modified by the review tests.

## Release setup still pending

Sentry remains ready for the DSN you said you would add later. RevenueCat's app key is empty and rewarded ads are intentionally disabled. The app's local version code is still 5; prepare a higher code for the next Play upload using the configured EAS version process. These setup items are separate from the correctness issues above.
