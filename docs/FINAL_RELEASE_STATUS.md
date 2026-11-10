# Final release status — 10 November 2026

**Android release builds and backend setup are complete. Physical-device acceptance and Google Play publishing remain.** The current APK and AAB include the chart loading, inspection, browser scrolling and Trade navigation-clearance fixes. Settings still shows **Trade UI: Rotate 1**; use the actual native build number to distinguish the new APK.

## Current artifacts

| Artifact | Result |
| --- | --- |
| Standalone Android preview | **1.0.0 / code 10**, finished 10 November at 11:51:56 Addis. [Build](https://expo.dev/accounts/natananse/projects/pipwise/builds/d0b9c653-b346-42bf-be36-850f96c0014d) · [Download APK](https://expo.dev/artifacts/eas/SiUgkTm_wLmFtk8UiLlSHfjqQpph_-J_Mclhy3VDofg.apk) |
| Google Play candidate | **1.0.0 / code 11**, finished 10 November at 12:06:47 Addis. [Build](https://expo.dev/accounts/natananse/projects/pipwise/builds/56b3c615-4c57-4b4c-88b8-a07bed13ef6a) · [Download AAB](https://expo.dev/artifacts/eas/6uYDi2HwfOdQiqdsDUXiJ8AE6PngqpC96LSkNZ1JAdI.aab) |
| Downloaded artifact checks | Both have package `io.pipwise.app`, min API 24, target API 36, the expected release signer and matching compiled application bundles. All 50 arm64/x86_64 native libraries pass the recorded 16KB checks. [Full evidence and limits](ANDROID_RELEASE_VERIFICATION.md) |
| Source provenance | EAS records base `f7288c3` with the submitted working-tree changes. The selected app/dependency hashes still match the validated source, subsequently committed locally as `5a41b8f`. Later documentation, workflow and private environment updates do not change the compiled client. |

APK 8 and AAB 9 are historical and lack these chart/navigation fixes. Existing emulator captures and store screenshot candidates came from APK 8; they do not establish acceptance of APK 10. Nothing was submitted or published to Google Play.

## Completed verification

| Check | Result |
| --- | --- |
| Lint / TypeScript | Pass, final 10 November rerun |
| Repository tests | All **83 test files** pass, including chart loading, gesture/renderer, navigation-clearance, auth, simulator and retention regressions |
| Expo Doctor | **20/20** pass with `EXPO_NO_DOTENV=1`; direct SDK-compatible dependency check also passes |
| Android, iOS and web exports | Pass; validated export used for the deployed web/API release |
| Preview / production Android preflight | Pass using local and actual remote public settings without printing values |
| Mobile cloud environment | Five public project variables; no account-level variable assignments returned. Private server credentials remain outside mobile build profiles. |
| Production database | Tested SQL applied at **12:00:08 Addis**. All 20 privilege assertions and actual scoped-role queries pass. Existing rows and owners are preserved. [Evidence](DATA_LAYER_VERIFICATION_2026_11_10.md) |
| Recovery and rollback | Durable recovery branch `br-small-cherry-zapghtfk` has no expiry. Separate validation branch tested functional behavior, contention and rollback; scoped queries are rejected after rollback. Retain recovery material until acceptance. |
| Hosted web/API | Current beta deployment **`zi2wl6zxa1`**; 13 route, preflight and client-asset checks pass. Its actual uploaded manifest matches the reviewed server/public environment and contains no owner DB URL, SMTP secret or Google client secret. [Service evidence](SERVICE_DEPLOYMENT_VERIFICATION_2026_11_10.md) |
| Legacy hosting cleanup | All seven obsolete/unused workers retired; inventory now contains only the accepted beta deployment. Private rollback archives are retained. Cached public assets are separate from worker retirement. |
| Email relay | Frankfurt `authmail` deployment **4** uses `app_runtime`. Actual native-runtime database access and SMTP TLS/authentication pass. Temporary diagnostics were removed. No test email was sent. |
| Auth configuration | Existing custom Google credentials, OTP verification, PipWise branding, signed OTP webhook and trusted beta origin verified; production localhost access is disabled. Real user interaction still needs the phone checks below. |
| Retention | Native `retention` deployment **2**; approved nightly trigger enabled for **04:17 Addis**. Next run: **11 November 2026, 04:17 Addis**. Count-only preview found zero eligible rows; a genuine count-only scheduled proof passed and was removed. First actual nightly purge has not occurred yet. [Scheduler evidence and monitoring](RETENTION_SCHEDULER_SETUP.md) |
| Scheduler handoff | GitHub Actions is manual-only on `main` in [commit `aac7677`](https://github.com/Natananse/pipwise/commit/aac7677b8d417202ec14bcf7d095bf21eab7df01). All four historical runs were complete before handoff; its old cron is removed. |

The role credentials are saved in ignored, mode-0600 `.env.server-runtime`, `.env.retention` and `.env.migrator`; the migrator is operator-local. Local API development also has the scoped runtime setting. No secret values belong in reports, Git or the client bundle. Preserve private operator/recovery files.

## Remaining acceptance and publishing

1. Install **APK 10** on a physical Android phone. Confirm Settings reports build 10, then complete [rotation/full-screen/keyboard checks](TRADING_ROTATION.md#phone-acceptance) and [chart gestures](CHART_GESTURE_STAGE_1.md#phone-acceptance-checklist), including saved wallet/P&L, cutouts, large text and reduced motion. No device or browser UI surface was available in this session; no new native painting or measured-frame-rate pass is claimed.
2. With controlled accounts, check actual email receipt, Google/email sign-in, recovery, session restoration, profile/feedback and in-app/public account deletion on the installed app. SMTP authentication, source tests and isolated SQL tests do not prove inbox delivery or browser-return behavior. [Smoke checklist](BETA_TESTING.md#7-release-smoke-test)
3. Monitor the first nightly cleanup after **04:17 Addis on 11 November**, and retain its execution result. The successful scheduled proof only counted rows; no production feedback was deleted during this setup.
4. Complete the applicable Play Console account, testing and policy requirements using [release content](GOOGLE_PLAY_RELEASE_CONTENT.md). Upload **AAB 11** yourself after acceptance; verify its code exceeds every code already uploaded for this app. Signing verification does not establish Play approval or Play-generated split behavior.

The APK runs without Metro, a cable or this computer. Online features use the deployed services. Future hosting deployments must use `EXPO_NO_DOTENV=1` with the reviewed private server environment so local operator credentials cannot enter an immutable worker. Automatic AI, paid products, live provider feeds and future iOS distribution remain outside this free Android release.
