# Final release status — 10 November 2026

**Source fixes are prepared; device and service acceptance remain incomplete.** The working tree extends `f7288c3` with chart scrolling/inspection/loading fixes and navigation clearance outside the Trade scroll viewport. **Trade UI: Rotate 1** remains the Settings marker. Recorded APK 8 and AAB 9 contain the earlier app code from `331c1aa` and do not include these fixes. Current release target: Android.

## Verified for this source

| Check | Result |
| --- | --- |
| Lint / TypeScript | Pass, rerun 10 November |
| Repository tests | All 83 test files pass, final rerun 10 November, including the chart/loading/navigation and retention regressions |
| Expo Doctor | 20/20 checks pass, 10 November with `EXPO_NO_DOTENV=1`; the direct SDK version check also passes. The initial dotenv-enabled Doctor dependency subcheck gave a false failure with no mismatched packages. |
| Android, iOS and web exports | Pass, final rerun 10 November to `/tmp/pipwise-export-final-20261110`; these are not installed-device tests |
| Local Android preview / production preflight | Pass, rerun 10 November |
| EAS access and builds | APK 8 and AAB 9 reconfirmed `FINISHED` online on 10 November; new preview code 10 is submitted and awaiting completion below |
| Downloaded APK / AAB | Package, actual version/code, target API 36, permissions, signatures and 64-bit ELF alignment checked; see [artifact evidence](ANDROID_RELEASE_VERIFICATION.md) |
| Remote mobile production environment | Rechecked 10 November: five project-scoped `EXPO_PUBLIC_` assignments, no account-scoped variable assignments returned; actual remote public values passed preview/production Android configuration checks without printing values |
| Public privacy / deletion / native-auth return pages and script | HTTP 200 with expected content markers, rechecked 9 November using unauthenticated GETs; functional account flows still require acceptance |
| Retention scheduler | Default-branch workflow exists; all three observed scheduled runs failed. Latest failure: missing/blank `RETENTION_JOB_DATABASE_URL`, before any query. No successful cleanup/dry-run evidence. [Diagnosis](RETENTION_SCHEDULER_SETUP.md#observed-actions-history--9-november-2026). |

The source review added regressions for unavailable charts, asset changes, open chart sheets, one-candle inspection, vertical browser scrolling and navigation space through resize/fullscreen/keyboard changes. Native painting and browser touch behavior still require acceptance. ADB returned no connected device or emulator on 10 November, and no browser surface was available for a local UI smoke test. The recorded overlap screenshots remain valid evidence for the older APK; no new pixel-level pass is claimed.

The independent native retention policy, bounded trigger handler, scoped email-function DB overrides and disabled-first runbook are prepared locally. The current environment has no `APP_RUNTIME_DATABASE_URL`, `RETENTION_JOB_DATABASE_URL`, `MIGRATOR_DATABASE_URL`, `PIPWISE_RETENTION_CHECK_SECRET` or explicit retention activation flag configured. Only presence was checked; no secret value was printed. Read-only Neon metadata confirms the linked app project remains `aws-eu-west-2`; do not deploy the native Functions policy there. One read-only `pg_roles` query, after matching the configured database/Auth endpoint identifiers, returned none of `migrator`, `app_runtime` or `retention_job`. The scoped rollout is therefore absent on that configured app database. No mutating SQL, role/password change, service deployment or retention activation was performed on 10 November.

The remote check covers the mobile build environment, not private backend/email credentials or database permissions. The current 1024×500 feature graphic and 512×512 store icon are prepared in [assets/play-store](../assets/play-store/README.md). The inspected native source archive retains required configuration/plugins while excluding local environment files, local operator state and store-only media files. Exports and automated tests do not prove native painting, keyboard visibility, gesture performance, a deployed backend revision, or Play approval.

## Artifact and acceptance evidence

| Evidence | Status |
| --- | --- |
| Current working-tree preview APK | Submitted 10 November as version 1.0.0 / code 10: [build page](https://expo.dev/accounts/natananse/projects/pipwise/builds/d0b9c653-b346-42bf-be36-850f96c0014d). EAS records base commit `f7288c3`; the uploaded archive includes the uncommitted chart/navigation fixes. Build completion, downloaded manifest/signature checks and installed-device acceptance are not yet established. |
| Fresh EAS preview APK from `331c1aa` | Finished: version 1.0.0, downloaded manifest confirms code 8; [build page](https://expo.dev/accounts/natananse/projects/pipwise/builds/7cb6a82c-1228-47cd-a6b9-4fcb3eaae214), [APK](https://expo.dev/artifacts/eas/2mwDFkDLTEmhod_J-nlP-XuvjrN7X1N0HPxvnbdTrzI.apk). [Static artifact checks pass](ANDROID_RELEASE_VERIFICATION.md). |
| Fresh emulator screenshots / smoke test | Partial pass on 9 November: installed APK 8 on Android 17/API 37 x86_64 with 16KB pages. Portrait/Arabic setup, question resume, demo entry, both landscape directions, draft/Review retention, keyboard entry and fullscreen/Back checked. [Evidence, observations and remaining gaps](ANDROID_NATIVE_SMOKE_TEST.md). |
| Phone-size listing screenshot candidates | Four actual 1080×1920 RGB product captures plus Settings build evidence are saved in [screenshots](../assets/play-store/screenshots/README.md). Native acceptance/layout observations remain open; these have not been uploaded or approved. |
| Physical Android acceptance | Pending; use the [phone checklist](TRADING_ROTATION.md#phone-acceptance) |
| Production AAB / Play track upload | Finished: version 1.0.0, downloaded manifest confirms code 9 from `9a9496e`; [build page](https://expo.dev/accounts/natananse/projects/pipwise/builds/ea94cdee-66de-40a1-a4d3-15963e51fcb3), [AAB](https://expo.dev/artifacts/eas/0s__A6w6wvlq2Bc1ILMnNavm1aRJODce7j-_b-AmaA8.aab). Bundletool validation, signature and static checks pass. Compiled app bundle is identical to APK 8. No Play submission/publication performed. |

EAS URLs, source commits, actual artifact versions and the emulator test environment/results are recorded above and in the linked reports. Actual installed Settings confirms **Trade UI: Rotate 1** and **1.0.0 / build 8**. Add equivalent device/date/results for physical acceptance. Do not substitute an old APK, Expo Go host version, local `app.json` code or a JS export for this evidence.

## Remaining release steps, in order

1. **Complete the backend/security cutover.** The 10 November read-only role query confirms the three scoped roles are absent on the configured app database; no administration SQL was applied. Complete the reviewed role/helper rollout and integration checks before the backend cutover. Follow [DATA_LAYER_LEAST_PRIVILEGE.md](DATA_LAYER_LEAST_PRIVILEGE.md): prepare and verify a recoverable production backup/recovery branch first, test the administration SQL and rollback on a separate disposable branch, then perform the coordinated owner-run cutover. Existing schemas, owners, tables and user data must remain preserved. These prerequisites are outside the completed source checks.
2. **Owner coordinates private environments and compatible deployments.** Hosted API/email uses `APP_RUNTIME_DATABASE_URL` as `app_runtime`; retention uses only `RETENTION_JOB_DATABASE_URL` as `retention_job`; direct `MIGRATOR_DATABASE_URL` remains operator-local. Deploy the matching backend/browser client and verify email delivery, email/Google sign-in, session restoration, account details, feedback and in-app/public deletion with controlled test accounts. The new protected API requires `X-Pipwise-Session`; do not leave incompatible client/server releases paired. Follow the [rollout order](DATA_LAYER_LEAST_PRIVILEGE.md#rollout-order) and [beta smoke test](BETA_TESTING.md#7-release-smoke-test).
3. **Configure and verify recurring retention.** The reviewed GitHub workflow is already on the default branch, but all three last-observed scheduled runs failed. After the scoped role/branch setup is verified, configure that scheduler or deploy the independent native Neon policy disabled first to the verified supported-region relay project. Follow the count-only check and single-scheduler handoff before enabling deletion, then record the first actual scheduled success and monitor failures. An active schedule without successful cleanup does not establish enforcement. See [RETENTION_SCHEDULER_SETUP.md](RETENTION_SCHEDULER_SETUP.md).
4. **Finish native acceptance.** The [partial emulator test](ANDROID_NATIVE_SMOKE_TEST.md) now records actual launch/onboarding/RTL/resume, rotation, draft/Review retention, keyboard and fullscreen/Back evidence. Complete the remaining emulator and physical-phone checks, including existing wallet/P&L, chart gestures, risk edge cases, immersive controls, safe areas, large text and other keyboard forms. Use [TRADING_ROTATION.md](TRADING_ROTATION.md). Preserve screenshots from the actual accepted release; a phone pass must not be inferred from source tests or emulator captures.
5. **Build and accept a current Play candidate after service and device checks.** Historical AAB 9 passes its recorded static checks but predates the current chart/navigation fixes. A fresh production build is required for this working tree. See [artifact verification and remaining limits](ANDROID_RELEASE_VERIFICATION.md). Confirm Play-generated split behavior and the artifact against the accepted service configuration. Before any Play upload, its actual code must be higher than every code previously uploaded for this app. EAS remote versions/auto-increment determine the artifact's real code.
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
