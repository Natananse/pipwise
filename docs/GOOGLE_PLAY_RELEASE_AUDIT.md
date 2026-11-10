# PipWise release implementation report

## Current status — 9 November 2026

**Current release source: `9a9496e`, with app code unchanged from `331c1aa`, Trade UI: Rotate 1. Android artifacts are verified; production release is not certified.** Use [FINAL_RELEASE_STATUS.md](FINAL_RELEASE_STATUS.md) for the current ordered release checklist, [ANDROID_RELEASE_VERIFICATION.md](ANDROID_RELEASE_VERIFICATION.md) for downloaded-artifact checks and [TRADING_ROTATION.md](TRADING_ROTATION.md) for native acceptance. The dated sections below retain historical implementation/deployment evidence.

- On 9 November, `pnpm lint`, `pnpm typecheck`, all **81 test files**, **20/20 Expo Doctor checks**, and local Android preview/production preflights passed again. Android/iOS bundle exports passed during the previous session. These checks do not establish phone behavior or a live backend cutover.
- EAS build access was reconfirmed on 9 November. Previous-session environment evidence: the remote mobile **production** environment had five project-scoped `EXPO_PUBLIC_` variables and no account-scoped variables were returned. Actual remote values passed the preview/production Android configuration checks without printing their values. This does not validate the separate private hosting/email/retention environments.
- On 9 November, public privacy, deletion and native-auth return pages and the return script again returned HTTP 200 with expected content markers. Page availability does not prove sign-in, email delivery or account deletion works with the new release.
- Both existing EAS builds were confirmed `FINISHED` online on 9 November: [preview APK 8](https://expo.dev/accounts/natananse/projects/pipwise/builds/7cb6a82c-1228-47cd-a6b9-4fcb3eaae214) from `331c1aa` and [production candidate AAB 9](https://expo.dev/accounts/natananse/projects/pipwise/builds/ea94cdee-66de-40a1-a4d3-15963e51fcb3) from `9a9496e`. Downloaded manifests confirm version 1.0.0, package `io.pipwise.app` and target API 36. Signatures, expected permissions and 64-bit ELF alignment pass; their compiled app bundles are identical. See [artifact evidence and limitations](ANDROID_RELEASE_VERIFICATION.md). Installed-device acceptance is tracked in the final status page; no Play submission/publication was performed.
- A fresh [partial emulator smoke test](ANDROID_NATIVE_SMOKE_TEST.md) installed APK 8 on a 16KB-page Android 17 emulator and confirmed the actual Settings version/Rotate 1 marker, local onboarding/resume, rotation, draft/Review retention, keyboard entry and fullscreen/Back. Physical-device acceptance and recorded layout observations remain open.
- The retention workflow is present on GitHub `main`, but **all three observed scheduled runs failed**; no successful cleanup or manual dry run appears in the returned history. A targeted safe log check identifies the latest failure as missing/blank `RETENTION_JOB_DATABASE_URL`, before database client creation or queries. See [run evidence and owner configuration step](RETENTION_SCHEDULER_SETUP.md#observed-actions-history--9-november-2026). No job was triggered during this verification.
- No SQL or database connection was performed in this release session. The live role/helper rollout, matching backend/email deployment, retention scheduler success, physical-device acceptance and Play Console completion remain unverified owner prerequisites. Follow the [manual rollout and recovery procedure](DATA_LAYER_LEAST_PRIVILEGE.md), including recovery backup/branch preparation before any owner-run SQL.

The old APK numbers, test counts and deployment IDs below are historical; they are not evidence that the current source is installed or deployed. Google Play eligibility must use the actual qualifying closed-test start date, not a promised November 20 date.

## 7 November 2026: database hardening prepared, not applied

The next source release separates hosted API/email connections (`APP_RUNTIME_DATABASE_URL` / `app_runtime`), local direct migrations (`MIGRATOR_DATABASE_URL` / `migrator`), and retention (`RETENTION_JOB_DATABASE_URL` / `retention_job`). Reviewed manual SQL creates scoped roles and helper functions and adds table grants/RLS policies while preserving **every existing table/schema owner, table name, schema location, column, and user row**. It does not move tables into the new helper namespace. The migrator owns only the new helper namespace/functions and future objects there; future DDL on existing owner-managed tables requires manual owner SQL.

**No SQL was executed, no scoped role passwords or secrets were configured, and no new backend/APK was deployed by this source change. SQL integration, RLS/grant behavior, helper/concurrency behavior, and metadata rollback are untested against Neon.** Follow [DATA_LAYER_LEAST_PRIVILEGE.md](DATA_LAYER_LEAST_PRIVILEGE.md), test the supplied rollback on an isolated branch, and apply the approved SQL manually before deploying the matching backend. Existing migrations `001`–`004` remain unchanged; there is no automatic security migration `005`.

The strengthened protected API requires both a verified JWT and the matching current `X-Pipwise-Session` proof. Deploy its matching browser client and build/install a **new APK/AAB**; an old native build sending only a JWT cannot satisfy the new backend. Repeat sign-in, feedback, account-details, deletion and real-device release checks after cutover. The November 6 verification/deployment evidence below describes the prior baseline and does not establish the new role-separated implementation is deployed or production-ready.

All mobile build profiles (`preview`, `testflight`, `production`) now select the public-only EAS **production** environment in local `eas.json`. The hosted backend keeps its separate private **preview** environment and needs `APP_RUNTIME_DATABASE_URL`; the email relay needs the same scoped runtime login, the GitHub job uses `RETENTION_JOB_DATABASE_URL`, and `MIGRATOR_DATABASE_URL` stays local. Broad legacy owner-connection variables are not fallbacks in the new implementation. No remote environment was changed: privately inspect/remove database/email/relay/model secrets from the mobile build environment before building, and complete the coordinated scoped-server rollout first.

Historical 7 November source checks passed: `pnpm lint`, `pnpm typecheck`, and `node --test tests/*.test.cjs` (57 files). Direct execution also verified all **439 declared tests** at that revision, with database/provider credentials removed from the test process environment. Installed-SDK tests replace networking entirely and cover Neon replacing a returned session token with a JWT: the client now captures the original opaque proof from the same response and avoids the SDK's shared token/session cache. These are local source/SDK tests, not evidence of live role grants, account deletion, SQL execution, or a deployed release.

## 6 November baseline implemented

- **Account deletion:** Settings has a Delete account button below Sign out, permanent-data confirmation and password/Google reauthentication when needed. `src/app/api/delete-account+api.ts` calls the server-only `accountDeletionApi.ts`. The endpoint accepts no caller-selected user ID and requires a verified JWT plus a matching, unexpired, non-impersonated session created within ten minutes. It locks the actual Neon identity and deletes account/profile/feedback/review usage/known verification records in a READ COMMITTED transaction; auth sessions and provider accounts cascade. The active identity is Neon; Supabase files are legacy and no Supabase service key was added.
- **Local deletion:** after confirmed server success, encrypted sign-in and registration state and app-owned local records are cleared; native providers reset and navigation returns to onboarding. Old queued writes are paused and drained so deleted practice data cannot be saved again. Cleanup/reset is deduplicated across UI timeouts; account switching preserves the new identity, stale Auth responses are rejected, and route changes do not prematurely resume writes. Local-clear failure offers retry without resubmitting the destructive request. Other-device local records and separately shared files remain under the user's control.
- **Public deletion:** `/delete-account` is exempt from onboarding, wallet and login startup gating. It has account-bound self-service email/Google authentication, email verification/recovery, explicit DELETE confirmation and the real support email `pipswise1@gmail.com`. The contact fallback works without reinstalling or signing in.
- **Public privacy:** `/privacy-policy` is readable without login or a saved workspace. It names **Natnael Ermias**, **pipswise1@gmail.com**, account retention while active, deletion within **30 days**, and feedback retention up to **12 months**. It is linked from Settings, paywall and the public deletion page. No owner-detail placeholders remain. Canonical copy is `src/lib/legal.ts`; Markdown copy is `docs/PRIVACY_POLICY_DRAFT.md`.
- **Retention:** `feedbackRetention.ts` enforces a 12-calendar-month cutoff before feedback insertion and through `scripts/purge-retained-data.mjs`. `.github/workflows/data-retention.yml` prepares nightly cleanup. Recurring execution is not active until the owner completes the scheduler activation below; a helper file alone is not a running job.
- **OAuth return:** native deletion reauthentication carries only a state-bound, encrypted, allowlisted `/delete-account` return path. Cold starts and duplicate callbacks preserve it; callback query parameters cannot supply an arbitrary redirect.
- **Standalone API URL:** `EXPO_PUBLIC_APP_API_URL=https://pipwise--beta.expo.app` is explicitly set in EAS **preview**, EAS **production**, local ignored configuration and the env example. Release preflight rejects missing API origins, local/IP service addresses and privileged EXPO_PUBLIC credential names. The maintained cloud alias is independent of Metro or the developer's computer.
- **Build config:** `io.pipwise.app`, PipWise, version `1.0.0`; app.json records versionCode `4`, while EAS remote versioning plus autoIncrement controls the actual next build code. Preview produces an internal standalone **APK**; production produces a store **AAB**. Existing iOS testflight support is retained. Icon/adaptive foreground/splash reference real assets; splash uses the configured plugin. Unused broad-storage, overlay and biometric permissions are blocked; Internet and vibration remain used. Inspect final release artifact/launcher masks on device.
- **Cleanup:** no console calls remain in src. Fictional leaderboard results, illustrative subscription prices, planned-benefit placeholders, disconnected reminder controls, fake referral milestones and fallback chart dates were removed. Input hints and clearly labelled educational simulations remain intentional features.

## 6 November baseline verified

- `pnpm lint` — pass.
- `pnpm typecheck` — pass.
- `node --test tests/*.test.cjs` — **55 test files pass**.
- `pnpm dlx expo-doctor` — **20/20 checks pass**.
- Android and web exports — successful; final deployment details are recorded below after export.
- Real deletion integration used synthetic users on isolated schema-only Neon branches. Verified ownership, expired/revoked/impersonated session rejection, unrelated-user isolation, FK cascades, rollback/retry, both concurrent quota/deletion lock orders and shared quota caps. Every temporary branch was removed. No real production account was deleted for testing.
- Live retention dry-run found **zero eligible feedback records**; no production purge was executed.
- `.env`/`.env.local` and private key paths are ignored and untracked. All **18 reachable commits / 436 historical blobs** were checked for sensitive paths and six current private credential values, with no matches. Final scans checked 56 Android export files and 76 web-client files against the six current private values, with zero matches; private server credentials must never be placed under EXPO_PUBLIC.
- Live Neon configuration confirms the maintained beta origin is trusted, Google is configured, the remote client ID matches local configuration and its client-secret field is set. Google consent publication/scopes remain an owner Console check.
- Local `.env` and `.env.local` permissions are **600**.
- No mandatory secret rotation is indicated by this audit. Rotate database passwords, Google client secret, SMTP app password, relay secret or other private provider/deployment keys if they were exposed outside this checked history. Public Auth URLs, Google client ID and Supabase publishable keys are not private secrets.

## HTTP 403 diagnosis and cloud deployment

The earlier failed request was `GET https://pipwise--beta.expo.app/native-auth.html` with Python's default `Python-urllib/3.11` user agent. It returns **403**, body exactly `error code: 1010` followed by a newline. The same URL returns **200** with Android okhttp, Android Chrome or a descriptive audit user agent. Cloudflare documents this browser-signature filtering. This was a diagnostic-client rejection; app authentication/CORS were not weakened. [Cloudflare error 1010](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1010/).

Protected account/feedback routes without credentials return expected **401 UNAUTHORIZED**. The coach status is available and automatic photo AI is disabled. Same-origin CORS checks succeed. The separate `pipwise.expo.app` alias returns 404 because no deployment is assigned; builds intentionally use the maintained `pipwise--beta.expo.app` origin.

The hosting server uses the existing EAS **preview** private environment; the production mobile build uses its separate public environment. Database/Auth/SMTP/relay/model credentials stay in server environment/credential stores. Do not upload a complete env file or introduce a client service-role key. See [network and credential details](RELEASE_NETWORK_DIAGNOSTICS.md).

Public release URLs:

- Privacy: `https://pipwise--beta.expo.app/privacy-policy`
- Account deletion: `https://pipwise--beta.expo.app/delete-account`

Final deployment **x8i6pooefs** is live at the maintained beta alias (immutable deployment: `https://pipwise--x8i6pooefs.expo.app`). Privacy/deletion/OAuth return pages return 200 for normal and Googlebot diagnostic requests; privacy HTML includes the supplied operator/contact and Auth photo/IP disclosures. Deployed client assets match the final export SHA-256. Unauthenticated deletion/account-details requests return 401; deletion CORS preflight returns 204 with required headers; automatic photo reviews remain disabled. No production account deletion or email was triggered by these probes. A successful web/API deployment does not update an already installed APK; build and reinstall the new native release.

## Build and install without a development server

Use Node 24.18.0 and the packageManager-pinned pnpm 11.20.0.

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
node --test tests/*.test.cjs
pnpm dlx expo-doctor

# Standalone APK for a real Android phone
pnpm beta:check --profile preview --platform android
pnpm dlx eas-cli@latest build --platform android --profile preview

# AAB for Google Play
pnpm beta:check --profile production --platform android
pnpm dlx eas-cli@latest build --platform android --profile production
```

Open the EAS preview build link on the phone, download/install its APK and permit installation from that browser if Android asks. Turn off the computer/dev server and launch the app. Keep an internet connection available for initial setup, account restoration, provider charts and support. Lessons and simulation records are stored locally; no Metro connection is needed. Upload the AAB to Play Console; an AAB is not directly installed like an APK. Actual native builds and physical-device acceptance still need to be run; bundle export is not a device test.

In Expo project > Environment variables, select **production** and keep these public values (the same public settings are configured in preview):

| Variable | Value |
| --- | --- |
| EXPO_PUBLIC_APP_API_URL | https://pipwise--beta.expo.app |
| EXPO_PUBLIC_NEON_AUTH_URL | https://ep-round-tooth-za67qro2.neonauth.c-2.eu-west-2.aws.neon.tech/neondb/auth |
| EXPO_PUBLIC_NATIVE_AUTH_RETURN_URL | https://pipwise--beta.expo.app/native-auth.html |
| EXPO_PUBLIC_GOOGLE_AUTH_ENABLED | 1 |
| EXPO_PUBLIC_APPLE_AUTH_ENABLED | 0 |

Example CLI update:

```bash
pnpm dlx eas-cli@latest env:set production --name EXPO_PUBLIC_APP_API_URL --value https://pipwise--beta.expo.app --visibility plaintext --non-interactive
pnpm dlx eas-cli@latest env:list production
```

Rebuild native apps whenever public values change. Private DATABASE_URL and email/provider credentials belong in the hosting server environment, not this client table. The existing server values were preserved.

## Google Cloud / Play settings still requiring owner action

Google's Web application OAuth client authorized redirect:

```text
https://ep-round-tooth-za67qro2.neonauth.c-2.eu-west-2.aws.neon.tech/neondb/auth/callback/google
```

Neon trusted app origin: `https://pipwise--beta.expo.app`. The later relay is `https://pipwise--beta.expo.app/native-auth.html`; final native callback is `pipwise://auth-callback`. Those latter addresses do not replace the Google authorized redirect.

This implementation uses Neon **web OAuth**, so it does not require an Android SHA-1 OAuth client. If native Google Android SDK sign-in is introduced, register package `io.pipwise.app` with the certificate signing the installed app. The EAS upload/direct-APK signing certificate currently has SHA-1:

```text
2E:54:7D:2A:91:F7:7C:57:C5:84:4F:12:AD:C2:69:95:08:DB:5D:B0
```

Read it using `pnpm dlx eas-cli@latest credentials --platform android`, then select production. The credential summary displays fingerprints; do not replace the keystore. For a Play-installed app, obtain the **Play app-signing certificate** SHA-1 from Play Console > App integrity/App signing; it may differ from the EAS upload key.

Owner must verify Google Auth Platform consent publishing status/branding/scopes, Play signing/submission setup, reviewer access and successful email/Google/deletion tests on an installed release. This work did not submit the app to Google Play or claim those Console-only statuses.

## Paste-ready Play content and testing plan

[GOOGLE_PLAY_RELEASE_CONTENT.md](GOOGLE_PLAY_RELEASE_CONTENT.md) contains the short/full descriptions, code-based Data safety inventory and purpose/optional flags, content-rating answers, 18+ audience, no-ads answer, financial-features explanation, six-screen screenshot plan, 512×512 icon and 1024×500 feature-graphic requirements, and daily November 6–20 closed-test plan.

Complete the provider-specific Data safety sharing/IP classification check before submitting a blanket no-sharing answer. Capture screenshots from the final installed release and complete Console listing/reviewer/declaration fields.

For new personal accounts created after November 13, 2023, confirm the production-access requirement on the Play Dashboard. At least 12 testers must each remain opted in continuously for the preceding 14 days. If the closed release and the twelfth qualifying opt-in start November 6, earliest application is **November 20, 2026 at or after the same Addis Ababa time**. Setup work alone does not start the clock, and approval/release review follows. [Official closed-testing rule](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).

## Remaining operational actions

1. Complete the manual least-privilege SQL rollout and private role setup, then activate and monitor the nightly retention workflow with **`RETENTION_JOB_DATABASE_URL`** authenticated as `retention_job`. Enable Actions and place reviewed source on main. Activation/success is unverified; a prepared file is not a running job. See [DATA_LAYER_LEAST_PRIVILEGE.md](DATA_LAYER_LEAST_PRIVILEGE.md), [RETENTION_SCHEDULER_SETUP.md](RETENTION_SCHEDULER_SETUP.md), and [FEEDBACK_RETENTION.md](FEEDBACK_RETENTION.md).
2. Verify provider backup/security-log retention and Data safety vendor classifications; the policy does not promise immediate removal of every infrastructure backup.
3. Build/install the new APK; verify signup/email/reset/Google return, privacy/deletion, local persistence, offline behavior, file picking, charts/gestures and Android lifecycle. Check the final AAB permissions, target API/16 KB compatibility, signing and version code.
4. Complete Play Console assets/declarations, account verification and any required closed test. No developer-name/contact/retention placeholders remain in the policy.
