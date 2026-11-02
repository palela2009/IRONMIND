# Phone fixes and welcome rewards - 1 November 2026

## Result

1. Home and Apps show overall time across launchable apps, including IRONMIND, while tracked-app time stays separate. Native collection no longer truncates the list to ten apps. Usage sessions are bounded by the requested period, close on screen lock, and avoid overlapping app switches or losing time on duplicate resume events. Launcher and system UI are excluded. Android usage events can still differ from Digital Wellbeing's calculations; earlier saved history was collected using the old top-ten/excluded-IRONMIND rules and is not retroactively reconstructed.
2. Safe-area handling keeps content above navigation buttons and below the status bar. Home, Apps, Friends and Profile use consistent header spacing. Profile setting rows and permission labels wrap at larger font sizes. System font scaling remains enabled.
3. Shop is mounted outside Home's list footer. Header/footer content also uses stable element types. Home refreshes no longer remount the shop or restart its slide transition and scroll state.
4. Starter coins remain 150, once per account. Accounts first created after this backend update are eligible to choose one permanent theme and receive one freeze. The server claims these together in a transaction; retries and simultaneous theme selections cannot grant a second theme or freeze. Existing accounts and balances are retained without granting another starter bonus. The gift can be deferred and claimed from the shop. The selected theme stays owned after Pro expires.
5. Seven days of coin-bought Pro costs 500, still limited to one purchase per UTC calendar month. Win and perfect-day coin rewards and their caps are unchanged. Earned Pro keeps doubled challenge rewards and its existing freeze benefits. Only active store-sourced Pro receives 500 monthly bonus coins. Coin payouts have an independent calendar-month marker, and legacy paid refills are migrated without duplicating a current-month bonus.
6. Updated the source privacy policy to describe overall app usage and the existing sharing of tracked-app totals with friends. The separately hosted policy copy is being synchronized from this source as part of the 2 November GitHub update.

## Verification

- App TypeScript check passed.
- App tests: 11 passed, including overall versus tracked time and preserving an open shop's instance and scroll state through repeated Home refreshes.
- Backend tests: 30 passed against a temporary MongoDB replica set with mocked Firebase. They include concurrent welcome claims, gift validation and eligibility, unchanged 150 starter coins, the 500 Pro debit, monthly restrictions, paid-only monthly coins, migration, and unchanged doubled challenge rewards.
- Android JVM tests: 4 passed for midnight, screen lock, duplicate resume/app switching, and more than ten apps.
- Android debug APK built successfully and installed over the emulator app with data preserved, after approval.
- Emulator shows nonzero overall time while tracked apps show 0 minutes. Profile settings were checked at font scale 1.5; long setting values wrap without colliding. Original font scale 1.0 was restored after testing.
- Shop stayed at identical visible positions across 68 seconds at font scale 1.5, spanning multiple background refreshes. Welcome-gift API behavior was tested locally; backend commit 7ecec31 is live on Render, verified on 2 November 2026. The full new-user flow still needs checking with an account created after that deployment.
- No production purchase or live deletion tests were scripted. Backend commit 7ecec31 was pushed to GitHub and verified live on Render on 2 November 2026. No new store AAB was started.

## Delivery

The debug APK is at android/app/build/outputs/apk/debug/app-debug.apk. Build 7 does not contain these changes. The matching backend has been deployed through GitHub/Render. New accounts created after deployment can test the welcome gift using the updated emulator app. Create a new AAB with a higher version code when approved. RevenueCat and Sentry configuration remain unchanged.

Before-change copies and the per-file manifest are saved at C:/Users/admin/.codex-backups/ironmind-2026-11-01-phone-and-rewards.

## Exact files changed in this pass

## IRONMIND (24 files)

- [android/app/build.gradle](../android/app/build.gradle)
- [android/app/src/main/java/com/anonymous/IRONMIND/UsageMonitorModule.kt](../android/app/src/main/java/com/anonymous/IRONMIND/UsageMonitorModule.kt)
- [android/app/src/main/java/com/anonymous/IRONMIND/UsageTimeline.kt](../android/app/src/main/java/com/anonymous/IRONMIND/UsageTimeline.kt) (added)
- [android/app/src/test/java/com/anonymous/IRONMIND/UsageTimelineTest.kt](../android/app/src/test/java/com/anonymous/IRONMIND/UsageTimelineTest.kt) (added)
- [App.tsx](../App.tsx)
- [docs/phone-fixes-and-welcome-rewards-2026-11-01.md](../docs/phone-fixes-and-welcome-rewards-2026-11-01.md) (added)
- [docs/privacy-policy.html](../docs/privacy-policy.html)
- [package-lock.json](../package-lock.json)
- [package.json](../package.json)
- [src/components/StatusCard.tsx](../src/components/StatusCard.tsx)
- [src/constants/cosmetics.ts](../src/constants/cosmetics.ts)
- [src/context/ProContext.tsx](../src/context/ProContext.tsx)
- [src/hooks/useScreenTime.ts](../src/hooks/useScreenTime.ts)
- [src/screens/AppsScreen.tsx](../src/screens/AppsScreen.tsx)
- [src/screens/FriendsScreen.tsx](../src/screens/FriendsScreen.tsx)
- [src/screens/HomeScreen.tsx](../src/screens/HomeScreen.tsx)
- [src/screens/ProfileScreen.tsx](../src/screens/ProfileScreen.tsx)
- [src/screens/ProIntroScreen.tsx](../src/screens/ProIntroScreen.tsx)
- [src/screens/ShopScreen.tsx](../src/screens/ShopScreen.tsx)
- [src/screens/WelcomeGiftScreen.tsx](../src/screens/WelcomeGiftScreen.tsx) (added)
- [src/screens/WelcomeOfferScreen.tsx](../src/screens/WelcomeOfferScreen.tsx)
- [src/utils/screenTime.ts](../src/utils/screenTime.ts) (added)
- [tests/progress.test.cjs](../tests/progress.test.cjs)
- [tests/shop-lifecycle.test.cjs](../tests/shop-lifecycle.test.cjs) (added)

## IRONMIND-backend (8 files)

- [src/constants/cosmetics.ts](../../IRONMIND-backend/src/constants/cosmetics.ts)
- [src/models/UserOnboarding.ts](../../IRONMIND-backend/src/models/UserOnboarding.ts)
- [src/routes/proRoutes.ts](../../IRONMIND-backend/src/routes/proRoutes.ts)
- [src/routes/tokenRoutes.ts](../../IRONMIND-backend/src/routes/tokenRoutes.ts)
- [src/routes/userRoutes.ts](../../IRONMIND-backend/src/routes/userRoutes.ts)
- [src/services/onboarding.ts](../../IRONMIND-backend/src/services/onboarding.ts)
- [src/services/welcomeGift.ts](../../IRONMIND-backend/src/services/welcomeGift.ts) (added)
- [tests/security-and-progress.test.cjs](../../IRONMIND-backend/tests/security-and-progress.test.cjs)

## GitHub workflow preference - 2 November 2026

The user authorized committing and pushing verified task updates automatically. This preference is recorded in AGENTS.md in both repositories; those two instruction files are additional to the 32 files in the original fix pass above. Play Store builds and publishing remain separate requested actions.
