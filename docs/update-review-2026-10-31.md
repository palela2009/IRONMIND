# IRONMIND changes for review — 31 October 2026

The backend changes were subsequently committed and pushed to GitHub at your request: [53d1ad6](https://github.com/palela2009/IRONMIND-backend/commit/53d1ad6c7503f684f3f464b5a871f801ddb8eb4f). Render's automatic deployment completed: the live `/health` response returned this exact commit ID and confirmed database readiness. The app changes remain local; nothing was submitted to Google Play.

The original Home layout has been restored after your feedback. The large monitoring, sync, and extra challenge cards were removed. Remaining time appears within the existing app rows when a limit is configured. Progress sync and monitor recovery use the existing Profile settings.

After further design feedback, the progress row is hidden while syncing is healthy. A retry row appears only when sync fails. The friend/duel reminder control now uses the same rounded card, margins, typography, and lime accent as the other settings; routine explanatory status text is hidden.

## What changed

1. Android saves each challenge result with a stable ID and account ID before notifying React Native. Active challenges and pending wins are also saved. Results remain queued when React Native is unavailable and are acknowledged only after the app saves them locally.
2. Owner access uses the verified email from Firebase's signed token. Profile request bodies cannot override identity. Old owner entitlements no longer remain active when the verified account is not an owner. Referrals again check for the same device.
3. Each account has its own persisted progress queue. Pending results retry at startup, when returning to the app, and every 30 seconds while the app is active. Screen-time uploads also persist and retry. The Profile sync row shows failures and allows retrying. Unsynced statistics are provisional until confirmed by the server.
4. The backend records results and applies stats, coins, perfect-day bonuses, and freezes in a transaction. Repeated event IDs or repeated app/timestamp pairs do not earn another reward. Daily result and coin limits are checked on the server. Streak reclaiming is tied to the recorded loss and charges once. Unrestricted coin awards, freeze grants, and direct stats writes are rejected.
5. Duel entry fees, refunds, and payouts use database transactions. Repeated accept/cancel/settle requests do not charge or pay twice. Final usage reports are required; earlier interim usage cannot decide a completed duel. Missing final reports after a 10-minute grace period cause a refund. History explains cancellations, ties, and missing reports.
6. Permission steps identify READY and NEEDED settings, clarify battery access, and offer a refresh. The existing Profile status card includes a monitor restart control. Monitoring restarts on returning to the app when configured.
7. Friend and duel reminders have a working Profile preference, stored on the backend. Notification taps open Friends or Home, including from a cold launch. Tokens are validated and moved off other accounts when registered to the current account; sign-out attempts to unregister them.
8. Sentry reads EXPO_PUBLIC_SENTRY_DSN, wraps the root component, and strips request headers, cookies, bodies, query strings, and console breadcrumbs from reports. As requested, the DSN is still for you to add later.

## Validation

- App: `npx tsc --noEmit` passed.
- App: `node --test tests/progress.test.cjs` passed all 4 tests.
- Backend: `npm test` built TypeScript and passed all 12 tests.
- Backend tests use a temporary local MongoDB replica set, not the production database.
- Android: Gradle `app:assembleDebug` passed for the emulator's x86_64 architecture.
- The final APK is `android/app/build/outputs/apk/debug/app-debug.apk`.
- The rebuilt native APK was subsequently installed over the existing emulator app with `adb install -r`, retaining its data. After relaunch, Profile showed Background monitor RUNNING, Progress sync UP TO DATE, and the notification preference loaded successfully. Existing streak, XP, history, and balances remained visible. End-to-end testing of queued challenges across process death is still required.
- Real-device battery behavior, notification delivery, Firebase production claims, and crash delivery have not been verified end to end against a deployed copy of this backend.

## Before release

This app needs the updated backend's `/api/challenge/progress`, `/api/challenge/result`, and `/api/challenge/reclaim` behavior. The old deployed backend cannot provide the new sync flow, which explains a sync failure while previewing against it.

Coordinate backend deployment and the app update. Version 5 uses the old direct stats, coin award, and freeze endpoints; those writes are intentionally rejected by the updated backend. Its local UI may disagree with server progress. Test a matching app/backend pair before production. Do not deploy these backend changes blindly while expecting version 5's old reward flow to continue unchanged.

Transactions require a MongoDB replica set or sharded deployment; MongoDB Atlas supports transactions. Keep the existing OWNER_EMAILS environment variable, listing the exact verified account emails. An unverified email/password account does not receive owner privileges.

Add EXPO_PUBLIC_SENTRY_DSN to the Expo build environment before making a release if crash reporting should be active. It belongs in the app build environment, not only in Render. Source-map upload remains disabled in the existing production build profile; readable production source maps need Sentry organization/project and upload configuration separately. No Sentry auth token was added.

Reward deduplication and limits do not prove that an unmodified device generated every usage report. Challenges and duel usage remain client-reported. Stronger protection against fabricated reports requires a further device verification design, such as Play Integrity.

Android force-stop, uninstall, clearing app data, and manufacturer restrictions can prevent monitoring or delete local queues. The durable queue preserves already saved results across normal app/process restarts; it cannot override Android's force-stop behavior. Existing historical stats are preserved as the migration baseline; past inconsistent or fraudulently awarded balances are not retroactively repaired.

## Every changed or added file

### IRONMIND — 27 files including this report

| File | Change |
| --- | --- |
| [App.tsx](../App.tsx) | Uses the saved progress flow, routes notification taps, passes sync state to Profile, restores cloud app limits, wraps crash reporting. |
| [app.config.js](../app.config.js) | New: includes the Sentry DSN from the build environment. |
| [.env.example](../.env.example) | New: DSN setting template. |
| [ChallengeStore.kt](../android/app/src/main/java/com/anonymous/IRONMIND/ChallengeStore.kt) | New: persistent native challenge state and account-scoped result queue. |
| [UsageMonitorModule.kt](../android/app/src/main/java/com/anonymous/IRONMIND/UsageMonitorModule.kt) | Exposes pending results, acknowledgement, and monitor state; requires an account to start. |
| [UsageMonitorService.kt](../android/app/src/main/java/com/anonymous/IRONMIND/UsageMonitorService.kt) | Saves results before emitting events, restores active challenges, retains cooldown, reports running state. |
| [PermissionGate.tsx](../src/components/PermissionGate.tsx) | Clearer recovery text and check-again control. |
| [PermissionSteps.tsx](../src/components/PermissionSteps.tsx) | READY/NEEDED labels and more accurate battery wording. |
| [StatusCard.tsx](../src/components/StatusCard.tsx) | Monitor state and restart control in the existing Profile card. |
| [StreakReclaimModal.tsx](../src/components/StreakReclaimModal.tsx) | Uses the server's reclaim operation; no separate charge followed by local restoration. |
| [NotificationSettings.tsx](../src/components/NotificationSettings.tsx) | New: persisted friend/duel reminder preference with retry status. |
| [sentry.ts](../src/config/sentry.ts) | Environment DSN, root wrapper, and report filtering. |
| [ProContext.tsx](../src/context/ProContext.tsx) | Account-scoped entitlement cache; removes obsolete free reward methods. |
| [useAppMonitor.ts](../src/hooks/useAppMonitor.ts) | Account checks and resume-time restart. |
| [useDuels.ts](../src/hooks/useDuels.ts) | Resolution explanations and proper HTTP error handling. |
| [useNotifications.ts](../src/hooks/useNotifications.ts) | Push registration, social channel, account checks, and warm/cold notification routing. |
| [usePermissions.ts](../src/hooks/usePermissions.ts) | Accurate missing-native status, monitor state, refresh, and restart. |
| [useScreenTime.ts](../src/hooks/useScreenTime.ts) | Persistent per-account upload queue, retries, limits for Home, and zero-minute formatting. |
| [useStats.ts](../src/hooks/useStats.ts) | Native queue consumption, local persistence, serialized retries, provisional offline progress, server reclaim. |
| [FriendsScreen.tsx](../src/screens/FriendsScreen.tsx) | Cancelled/refunded history and result explanations. |
| [HomeScreen.tsx](../src/screens/HomeScreen.tsx) | Original layout retained; remaining time added within existing app names. |
| [ProfileScreen.tsx](../src/screens/ProfileScreen.tsx) | Existing settings now contain sync/retry and notification controls; sign-out unregisters push token. |
| [training.ts](../src/types/training.ts) | Result counting and freeze fields. |
| [authFetch.ts](../src/utils/authFetch.ts) | Authentication/account checks and request timeout. |
| [progressState.ts](../src/utils/progressState.ts) | New: pure offline progress projection and history reconciliation. |
| [progress.test.cjs](../tests/progress.test.cjs) | New: 4 offline projection/reconciliation tests. |
| [This report](update-review-2026-10-31.md) | New: change list, validation, deployment notes, and undo record. |

### IRONMIND-backend — 24 files

Paths below are relative to `C:/Users/admin/Desktop/IRONMIND-backend`.

| File | Change |
| --- | --- |
| `package.json` | Adds the test command and temporary MongoDB test dependency. |
| `package-lock.json` | Locks that development dependency. |
| `src/index.ts` | Health response includes the deployed commit ID and database readiness, so the Render deployment can be verified. |
| `src/middleware/verifyAuth.ts` | Verified/revocation-checked Firebase claims, trusted profile identity, separate database error response. |
| `src/models/ChallengeResult.ts` | Stable event IDs, unique index, counting, rewards, freezes, and reclaim fields. |
| `src/models/ChallengeDay.ts` | New: daily quota and perfect-day bookkeeping. |
| `src/models/Duel.ts` | Stores the reason a duel ended. |
| `src/models/UserOnboarding.ts` | Verified email, reminder preference, and progress transaction revision. |
| `src/models/UserStats.ts` | Recorded lost streak and reclaimable event. |
| `src/routes/challengeRoutes.ts` | Progress snapshots, transactional result submission, and reclaim endpoint. |
| `src/routes/coinRoutes.ts` | Rejects unverified reward claims and standalone reclaim charges. |
| `src/routes/duelRoutes.ts` | Uses transaction services; validates IDs/usage and reports settlement reasons. |
| `src/routes/friendRoutes.ts` | Uses verified identity for owner badges. |
| `src/routes/proRoutes.ts` | Verified owner checks, single monthly refill, blocks unrestricted freeze operations. |
| `src/routes/statsRoutes.ts` | Rejects direct stats replacement; retains leaderboard notification helper. |
| `src/routes/tokenRoutes.ts` | Validates/reassigns push tokens and supports unregistering. |
| `src/routes/userRoutes.ts` | Ignores body-provided identity, validates daily limit, adds notification preferences. |
| `src/services/challenges.ts` | New: result validation, deduplication, transactional stats/rewards/freezes and paid reclaim. |
| `src/services/duelTransactions.ts` | New: transactional entry fees, refunds, and settlement. |
| `src/services/identity.ts` | New: trusted email normalization and owner matching. |
| `src/services/notifications.ts` | Respects reminder preference and identifies recipient account. |
| `src/services/referrals.ts` | Restores same-device checks and verified owner bypass. |
| `src/services/revenuecat.ts` | Uses verified ownership when protecting owner entitlements. |
| `tests/security-and-progress.test.cjs` | New: 12 identity, endpoint, reward, and concurrent financial tests. |

## Undo

The before-change copies are saved outside both repositories:

`C:/Users/admin/.codex-backups/ironmind-2026-10-31-improvements`

That folder has original tracked-file copies and repository baseline records. The final change manifest records the files in this update and their hashes. Ask to undo all changes or name the part you dislike; restoration can be limited to these edits without removing later work. Your pre-existing untracked screenshot asset was not changed. Generated build outputs and installed test dependencies are separate from source restoration.
