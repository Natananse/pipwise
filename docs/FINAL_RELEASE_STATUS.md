# Final release status — 9 November 2026

**Android artifacts verified; device and service acceptance remain incomplete.** Current release source is `9a9496e`, with app code unchanged from `331c1aa` and **Trade UI: Rotate 1** in Profile → Settings. Current release target: Android.

## Verified for this source

| Check | Result |
| --- | --- |
| Lint / TypeScript | Pass, rerun 9 November |
| Repository tests | All 81 test files pass, rerun 9 November with database/provider credentials removed from the test process environment |
| Expo Doctor | 20/20 checks pass, rerun 9 November |
| Android and iOS JavaScript bundle exports | Passed during the previous session; these are not installed-device tests |
| Local Android preview / production preflight | Pass, rerun 9 November |
| EAS access and existing builds | Both existing builds confirmed `FINISHED` online on 9 November |
| Downloaded APK / AAB | Package, actual version/code, target API 36, permissions, signatures and 64-bit ELF alignment checked; see [artifact evidence](ANDROID_RELEASE_VERIFICATION.md) |
| Remote mobile production environment | Previous-session evidence: five project-scoped `EXPO_PUBLIC_` variables; no account-scoped variables returned; actual values passed preview/production Android configuration checks without printing values |
| Public privacy / deletion / native-auth return pages and script | HTTP 200 with expected content markers, rechecked 9 November using unauthenticated GETs; functional account flows still require acceptance |
| Retention scheduler | Default-branch workflow exists; all three observed scheduled runs failed. Latest failure: missing/blank `RETENTION_JOB_DATABASE_URL`, before any query. No successful cleanup/dry-run evidence. [Diagnosis](RETENTION_SCHEDULER_SETUP.md#observed-actions-history--9-november-2026). |

The remote check covers the mobile build environment, not private backend/email credentials or database permissions. The current 1024×500 feature graphic and 512×512 store icon are prepared in [assets/play-store](../assets/play-store/README.md). The inspected native source archive retains required configuration/plugins while excluding local environment files, local operator state and store-only media files. Exports and automated tests do not prove native painting, keyboard visibility, gesture performance, a deployed backend revision, or Play approval.

## Artifact and acceptance evidence

| Evidence | Status |
| --- | --- |
| Fresh EAS preview APK from `331c1aa` | Finished: version 1.0.0, downloaded manifest confirms code 8; [build page](https://expo.dev/accounts/natananse/projects/pipwise/builds/7cb6a82c-1228-47cd-a6b9-4fcb3eaae214), [APK](https://expo.dev/artifacts/eas/2mwDFkDLTEmhod_J-nlP-XuvjrN7X1N0HPxvnbdTrzI.apk). [Static artifact checks pass](ANDROID_RELEASE_VERIFICATION.md). |
| Fresh emulator screenshots / smoke test | Partial pass on 9 November: installed APK 8 on Android 17/API 37 x86_64 with 16KB pages. Portrait/Arabic setup, question resume, demo entry, both landscape directions, draft/Review retention, keyboard entry and fullscreen/Back checked. [Evidence, observations and remaining gaps](ANDROID_NATIVE_SMOKE_TEST.md). |
| Phone-size listing screenshot candidates | Four actual 1080×1920 RGB product captures plus Settings build evidence are saved in [screenshots](../assets/play-store/screenshots/README.md). Native acceptance/layout observations remain open; these have not been uploaded or approved. |
| Physical Android acceptance | Pending; use the [phone checklist](TRADING_ROTATION.md#phone-acceptance) |
| Production AAB / Play track upload | Finished: version 1.0.0, downloaded manifest confirms code 9 from `9a9496e`; [build page](https://expo.dev/accounts/natananse/projects/pipwise/builds/ea94cdee-66de-40a1-a4d3-15963e51fcb3), [AAB](https://expo.dev/artifacts/eas/0s__A6w6wvlq2Bc1ILMnNavm1aRJODce7j-_b-AmaA8.aab). Bundletool validation, signature and static checks pass. Compiled app bundle is identical to APK 8. No Play submission/publication performed. |

EAS URLs, source commits, actual artifact versions and the emulator test environment/results are recorded above and in the linked reports. Actual installed Settings confirms **Trade UI: Rotate 1** and **1.0.0 / build 8**. Add equivalent device/date/results for physical acceptance. Do not substitute an old APK, Expo Go host version, local `app.json` code or a JS export for this evidence.

## Remaining release steps, in order

1. **Owner confirms the backend/security cutover.** The last recorded owner status was that the manual SQL and role-specific secret configuration were incomplete; completion has not been confirmed in this resumed session. No SQL or database connection was performed by the agent; complete the reviewed role/helper rollout and integration checks before the backend cutover. Follow [DATA_LAYER_LEAST_PRIVILEGE.md](DATA_LAYER_LEAST_PRIVILEGE.md): prepare and verify a recoverable production backup/recovery branch first, test the administration SQL and rollback on a separate disposable branch, then perform the coordinated owner-run cutover. Existing schemas, owners, tables and user data must remain preserved. These manual prerequisites are outside the completed source checks.
2. **Owner coordinates private environments and compatible deployments.** Hosted API/email uses `APP_RUNTIME_DATABASE_URL` as `app_runtime`; retention uses only `RETENTION_JOB_DATABASE_URL` as `retention_job`; direct `MIGRATOR_DATABASE_URL` remains operator-local. Deploy the matching backend/browser client and verify email delivery, email/Google sign-in, session restoration, account details, feedback and in-app/public deletion with controlled test accounts. The new protected API requires `X-Pipwise-Session`; do not leave incompatible client/server releases paired. Follow the [rollout order](DATA_LAYER_LEAST_PRIVILEGE.md#rollout-order) and [beta smoke test](BETA_TESTING.md#7-release-smoke-test).
3. **Configure and verify recurring retention.** The reviewed workflow is already on the default branch, but all three observed scheduled runs failed. The latest run stops at the missing/blank `RETENTION_JOB_DATABASE_URL` guard before querying the database. After the scoped role/branch setup is verified, add/correct that Actions secret privately with the `retention_job` connection, then verify a successful dry run and scheduled run and monitor failures. An active schedule without a successful cleanup does not establish enforcement. Keep the policy aligned with actual retention and vendor backup/log practices. See [RETENTION_SCHEDULER_SETUP.md](RETENTION_SCHEDULER_SETUP.md).
4. **Finish native acceptance.** The [partial emulator test](ANDROID_NATIVE_SMOKE_TEST.md) now records actual launch/onboarding/RTL/resume, rotation, draft/Review retention, keyboard and fullscreen/Back evidence. Complete the remaining emulator and physical-phone checks, including existing wallet/P&L, chart gestures, risk edge cases, immersive controls, safe areas, large text and other keyboard forms. Use [TRADING_ROTATION.md](TRADING_ROTATION.md). Preserve screenshots from the actual accepted release; a phone pass must not be inferred from source tests or emulator captures.
5. **Accept the Play candidate after service and device checks.** Candidate AAB 9 already exists; its manifest, signature, target API 36 and 64-bit ELF checks pass. See [artifact verification and remaining limits](ANDROID_RELEASE_VERIFICATION.md). Rebuild if application code or bundled public configuration changes. Confirm Play-generated split behavior and the artifact against the accepted service configuration. The documented new-app/update requirement is [Android 16 / API 36 or higher](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en). Before any Play upload, code 9 must be higher than every code previously uploaded for this app. EAS remote versions/auto-increment determine the artifact's real code.
6. **Complete Play Console and any qualifying closed test.** Finish developer/account verification, signing, reviewer access, screenshots/icon/feature graphic, privacy/deletion links, content rating, audience/ads/financial declarations and accurate Data safety vendor classifications. Use [GOOGLE_PLAY_RELEASE_CONTENT.md](GOOGLE_PLAY_RELEASE_CONTENT.md). For personal accounts subject to [Google's testing gate](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en), at least 12 testers must remain opted in continuously for 14 days before applying for production access. Calculate eligibility from the actual twelfth qualifying opt-in; the older November 6–20 calendar is an example, not a completed test or promised release date. Production access and release review remain separate.

## Build commands

For a fresh standalone phone APK:

```bash
pnpm beta:android
```

For the Android Play bundle:

```bash
pnpm beta:check --profile production --platform android
pnpm dlx eas-cli@latest build --platform android --profile production
```

The completed APK runs without a cable, Metro or the computer. Online account/provider/support features still need their configured services and connectivity. A new cloud build is not an automatic backend deployment or Play submission.

## Optional work outside the free Android release

Risk estimates, rotation, fullscreen and immersive navigation are already implemented; they need device acceptance. Automatic photo AI, paid products, raw live feeds, push delivery, referral rewards, community rankings, further cosmetic restyling and future iOS distribution are separate feature work. Do not advertise inactive features or enable them without updating their configuration, acceptance and disclosures.

The dated [release audit](GOOGLE_PLAY_RELEASE_AUDIT.md) retains previous deployment/build/test evidence. This page is the current release checklist; older counts and artifact links do not certify Rotate 1.
