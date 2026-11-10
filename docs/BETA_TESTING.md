# Share PipWise with testers

The current release target is **Android only**. Android testers receive a standalone APK install link; Google Play distribution uses a production build. Apple Developer membership and Apple sign-in are not required for this Android release. The optional iPhone/TestFlight instructions below are for a future iOS release.

**Current release status — 9 November 2026:** release source `9a9496e` retains app code from `331c1aa` and **Trade UI: Rotate 1**. The [preview APK](https://expo.dev/accounts/natananse/projects/pipwise/builds/7cb6a82c-1228-47cd-a6b9-4fcb3eaae214) is finished as version **1.0.0 / code 8**; the [production AAB candidate](https://expo.dev/accounts/natananse/projects/pipwise/builds/ea94cdee-66de-40a1-a4d3-15963e51fcb3) is finished as **1.0.0 / code 9**. Downloaded-artifact static checks pass; see [ANDROID_RELEASE_VERIFICATION.md](ANDROID_RELEASE_VERIFICATION.md). Physical-phone QA and service prerequisites remain incomplete. See [FINAL_RELEASE_STATUS.md](FINAL_RELEASE_STATUS.md) for current acceptance evidence and owner prerequisites, and [TRADING_ROTATION.md](TRADING_ROTATION.md) for the installation/rotation/full-screen/keyboard checklist. The dated builds below are historical.

These builds contain the JavaScript bundle and run without your computer, Metro, or port 8081. Development onboarding previews are disabled in both release profiles.

Complete [the manual least-privilege rollout](DATA_LAYER_LEAST_PRIVILEGE.md) before deploying this source. All mobile profiles use the public-only EAS `production` environment; hosted server credentials stay in `preview`. Historical APK build 5 lacks the new live-session header; use a current rebuilt APK after the matching backend/database setup.

Browser beta: **https://pipwise--beta.expo.app**. Local source changes do not update this website or an existing APK. Deploy the web export and create new native builds when preparing a release.

**Historical 5 November baseline:** that beta deployment included the free Chart coach workflow and authenticated feedback API. Android preview **1.0.0, version code 4** finished successfully: [historical build page](https://expo.dev/accounts/natananse/projects/pipwise/builds/5386bc64-e718-49a3-aec5-bb451b1c838c). Automatic AI was explicitly disabled in that preview hosting environment. This build predates the current scoped-session backend requirements, bright Trade, chart gestures and Rotate 1 native changes; use the new artifact for acceptance. Physical-device signup, file-picker and trade checks still require current evidence.

## 1. Connect the build account

Run these from the project directory if the CLI is not already signed in or the project is not linked:

```bash
pnpm dlx eas-cli@latest login
pnpm dlx eas-cli@latest whoami
pnpm dlx eas-cli@latest init
```

`whoami` must show your Expo username. Being signed into expo.dev in a browser is separate from the CLI session. If browser login does not finish, use `pnpm dlx eas-cli@latest login --no-browser` and enter credentials only in your terminal.

Keep the Android package and iOS bundle identifier `io.pipwise.app` stable for future updates. EAS cloud builds regenerate the ignored native folders from app.json and use the configured signing credentials.

## 2. Configure the existing Neon backend

The application uses **Neon Managed Better Auth**, not the legacy Supabase auth files. Confirm the intended project and branch before changing settings; `.neon` records the current link. Do not create a replacement project or run the old Supabase migrations against Neon.

1. In the existing branch's Better Auth settings, keep email/password signup enabled. Configure email verification using **codes** when requiring verified email. The application includes code entry, resend, and a way to resume verification after reopening it.
2. Configure custom SMTP for production. Neon's shared sender is for development/testing; verification codes and password resets work with shared or custom SMTP. Verify delivery to real tester inboxes and check spam folders. Consider revoking existing sessions when a password is reset.
3. Add the hosted application origin to Neon's trusted domains: `https://pipwise--beta.expo.app`. Register a separate production origin when using one. Register only origins you control.
4. Configure `EXPO_PUBLIC_NEON_AUTH_URL` with its `/auth` service path. `neon env pull` supplies private branch variables; `node scripts/sync-neon-env.mjs` creates the public Auth alias. Set `EXPO_PUBLIC_APP_API_URL` to the deployed application origin, or use the origin of `EXPO_PUBLIC_NATIVE_AUTH_RETURN_URL`. A Neon Data API is not needed.
5. Have the owner manually review and run `neon/security/` SQL in the Neon SQL Editor on a test branch first, following the linked guide. Existing migrations `001`–`004` are unchanged. Future `pnpm db:migrate` runs use direct `MIGRATOR_DATABASE_URL`; the existing ledger must already be provisioned, and DDL on existing tables still requires their unchanged owner. Do not rerun raw create-table SQL over existing tables.
6. Deploy the matching server routes with sensitive `APP_RUNTIME_DATABASE_URL`, `NEON_AUTH_BASE_URL` and `NEON_AUTH_JWKS_URL` variables. `POST /api/feedback` verifies the signed-in JWT, a matching unexpired session, and report owner before inserting a review. Duplicate retries are idempotent. Clients cannot read or change submitted reviews. Read `public.beta_feedback` through the owner's database tools. Demo users can copy/share a report themselves.

The app requests password recovery codes and lets the user enter a new password. It does not reuse Supabase access-token fragments or PKCE links for Neon accounts. Practice data remains local to the device after signup.

## 3. Configure Google and Apple sign-in

On Android and iPhone, social sign-in opens the **system browser**, uses Neon's OAuth flow, and returns to `pipwise://auth-callback` through the hosted page described below. It uses the existing Expo browser modules. This implementation does not use the Google native SDK, Google Android/iOS OAuth client IDs, or a Google SHA-1 configuration. APK signing is still required independently for distribution.

### Google

The **Google Cloud project** is a container for PipWise's Google login settings: its app name, consent screen, and OAuth credentials. The **Google Play Console account** is the separate account that publishes the Android app in the store. You can set up the login project before registering or paying for Play publishing. [Google's authentication setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid) starts with creating/selecting a Cloud project and creating a web OAuth client; [Play registration](https://support.google.com/googleplay/android-developer/answer/6112435) is a separate process.

If a friend manages these accounts, they can invite your Google account to the Cloud project through IAM and invite you to the Play Console team separately. Access to one does not automatically grant access to the other; use invitations rather than sharing passwords. See [Cloud project access](https://cloud.google.com/iam/docs/granting-changing-revoking-access) and [Play Console access](https://support.google.com/googleplay/android-developer/answer/6112435).

Create your own **Web application** OAuth client in Google Cloud for production. Set its authorized redirect URI to the complete branch Auth URL followed by `/callback/google`:

```text
<NEON_AUTH_BASE_URL>/callback/google
```

The Auth URL already includes its database/auth path. Configure this web client's ID and secret in the existing branch's Neon Google provider. Configure the consent screen, app branding, authorized domains and published privacy policy; complete any Google verification required for your requested scopes and audience. A consent app left in testing restricts who can sign in.

Neon's shared Google credentials are suitable for development, not a production release under PipWise's identity. Keep the client secret in Neon only; it must never appear in `.env` under `EXPO_PUBLIC_`, in source code, or in an app build.

### Optional: Apple for a future iOS release

Leave `EXPO_PUBLIC_APPLE_AUTH_ENABLED=0` for the current Android-only release. For a future iOS release, this app offers Sign in with Apple as the equivalent privacy-preserving login when Google is enabled. [App Review guideline 4.8](https://developer.apple.com/app-store/review/guidelines/#login-services) requires an equivalent service with limited data collection and private-email support when social login creates or authenticates a primary account, subject to its listed exceptions. This app's preflight requires the Apple flag for Google in `testflight`/`production` when checking `--platform ios` or `--platform all`; `--platform android` does not require it.

In the Apple Developer account, configure a Sign in with Apple Services ID associated with the app, an Apple Team ID, Key ID, and `.p8` private key. Register this HTTPS return URL:

```text
<NEON_AUTH_BASE_URL>/callback/apple
```

Configure that provider in Neon with the Services ID and the private key through the Console or a protected local key file. Apple credentials are not shared, and the `.p8` key must never be committed, sent in chat, or bundled in the client. This browser-based implementation does not call `expo-apple-authentication`.

### Deploy the HTTPS return page before enabling buttons

The app's `EXPO_PUBLIC_NATIVE_AUTH_RETURN_URL` must be the public HTTPS URL of `public/native-auth.html`, with exactly that path and no query or fragment. The beta value is:

```text
https://pipwise--beta.expo.app/native-auth.html
```

The page returns the one-use Neon verifier and the initiating app's challenge to the installed app. It does not contain OAuth secrets. The app verifies the pending challenge and exchanges the verifier through the Neon SDK before publishing the session.

Export the website, then deploy it to the existing beta alias using the intended public environment:

```bash
pnpm exec expo export --platform web
pnpm dlx eas-cli@latest deploy --alias beta --environment preview
```

This updates the beta website as well as the return page. Confirm that the deployed `/native-auth.html` serves the actual static return page over HTTPS, rather than a missing page or the application's ordinary route fallback. Trust its origin in the same Neon branch used by the app:

```bash
neon neon-auth domain add https://pipwise--beta.expo.app
neon neon-auth domain list
```

Use another controlled origin for production if desired, deploying the page there and changing the public return URL and trusted-domain configuration together. Keep the page available for already-released app versions.

Only then enable provider flags in a test build. Test successful sign-in, cancel, denied permission, and returning after the app has been closed. Complete the device checks below before enabling social login for users. Expo Go does not reproduce the standalone app's custom-scheme return; use a signed installed build.

## 4. Supply public configuration to cloud builds

Local `.env` is ignored during cloud upload. All mobile profiles now use the Expo project's public-only **production** environment, including Android preview and TestFlight. Keep backend secrets in the separate hosting **preview** environment:

| Variable | Value |
| --- | --- |
| `EXPO_PUBLIC_NEON_AUTH_URL` | Branch public HTTPS Auth URL including `/auth` path |
| `EXPO_PUBLIC_APP_API_URL` | Required public HTTPS application backend origin |
| `EXPO_PUBLIC_GOOGLE_AUTH_ENABLED` | `0` until configured; `1` enables Google |
| `EXPO_PUBLIC_APPLE_AUTH_ENABLED` | Keep `0` for Android-only release; configure before enabling for future iOS |
| `EXPO_PUBLIC_NATIVE_AUTH_RETURN_URL` | Deployed HTTPS `/native-auth.html` page |

Use Expo's Environment variables dashboard or individual EAS commands. For example, after replacing the public URL placeholder:

```bash
pnpm dlx eas-cli@latest env:set --environment production --name EXPO_PUBLIC_NEON_AUTH_URL --value "<public-branch-auth-url>" --visibility plaintext
pnpm dlx eas-cli@latest env:set --environment production --name EXPO_PUBLIC_GOOGLE_AUTH_ENABLED --value "0" --visibility plaintext
pnpm dlx eas-cli@latest env:set --environment production --name EXPO_PUBLIC_APPLE_AUTH_ENABLED --value "0" --visibility plaintext
pnpm dlx eas-cli@latest env:set --environment production --name EXPO_PUBLIC_NATIVE_AUTH_RETURN_URL --value "https://pipwise--beta.expo.app/native-auth.html" --visibility plaintext
pnpm beta:check
```

Repeat for the application API origin. Keep the same public configuration available to the hosted browser export and local testing, without copying server secrets into the mobile environment. Enable the provider flags only after completing the setup above.

**Do not upload the whole `.env` file.** It contains private database credentials from Neon. Only the listed public settings and optional public RevenueCat platform keys belong in the client build environment. OAuth client secrets, Apple keys, database URLs, and SMTP credentials stay server-side.

`beta:check` validates local files, public endpoint/return URLs, flag values, and the login options for the target platform. Its defaults are `preview` → Android, `testflight` → iOS, and `production` → all platforms. Use `pnpm beta:check --profile production --platform android` for this Android-only store release. It does not contact providers, verify the remote EAS environment, confirm deployment/trusted domains, send emails, apply migrations, or exercise real-device login. Both social flags default to off, so a passing check does not mean Google/Apple sign-in is enabled.

RevenueCat keys are optional for beta practice. Purchases require configured store products/offerings and the correct platform key; an unconfigured paid plan remains a preview.

## 5. Android install link

```bash
pnpm beta:android
```

For the first build, let EAS create/manage Android signing credentials. Keep them for future updates. When the build finishes, copy the install URL from the EAS build page and share it with testers yourself. They open the URL on Android, download the APK, and allow installation from that source when asked.

If an older debug build uses the same package with a different signing key, Android cannot install the release over it. Uninstalling clears that install's local practice data; use another device when that data must be retained.

The existing `pipwise://` invitation link opens an installed app. It is not an APK download link, and referral rewards are not connected. For the Android-only Google Play release, check the Android target explicitly, then create and submit the production build:

```bash
pnpm beta:check --profile production --platform android
pnpm dlx eas-cli@latest build --platform android --profile production
pnpm dlx eas-cli@latest submit --platform android --profile production
```

Submission uploads the build to the configured Play Console account; completing its testing, policy, verification, and publication steps is separate. The Google login project and its credentials must still be configured even when a friend owns that publishing account.

## 6. Optional future iPhone and TestFlight release

An active paid Apple Developer membership and an App Store Connect app record are required. After enrollment and provider configuration:

```bash
pnpm beta:ios
pnpm beta:ios:submit
```

Complete Apple authentication, signing, and App Store Connect selection in EAS. Submission uploads the binary; it does not create a public invitation link. After Apple processes the build, configure TestFlight beta details and an external tester group, complete any required Beta App Review, and enable invitations. Testers install Apple's TestFlight app and open the invitation.

The `preview` profile can also create an iOS ad hoc build with registered device UDIDs, but this still needs Apple Developer membership. An Android APK cannot be installed on an iPhone. The browser beta remains available separately; its deployed bundle and backend must also have the intended configuration.

## 7. Release smoke test

Run this on a physical Android build for the current release, using accounts you control. Repeat on iPhone before any future iOS release:

1. Fresh install: splash → language → three questions → Create account.
2. With email verification enabled, receive a code, close/reopen before confirming, then finish confirmation and reach Trade. Confirm expired/wrong codes fail and resend works.
3. Sign out/in; enter a wrong password; request recovery and successfully choose a new password. Verify the old password no longer signs in.
4. Google: complete system-browser authorization and return to the app. Sign out, repeat, then cancel an attempt and confirm it creates no app session. Reject invalid, expired, or replayed return links.
5. For a future iOS release only, exercise Apple shared-email and private-email account creation, successful return, cancel, and returning-user sign-in.
6. Close/reopen after successful login. Confirm the session survives and signed-out users cannot bypass account access by opening a protected route, unless they explicitly choose demo mode.
7. Open/close a virtual position; complete a lesson/quiz and bookmark it; finish an Analyse exercise. Verify saved practice data survives reopening.
8. Send feedback and verify the private row in Neon. Confirm failed delivery preserves the form for retry.
9. Check store release requirements, including working in-app account deletion for account creation, accessible published privacy policy, review credentials/instructions, and the store privacy/data-safety forms. Passing local authentication tests does not replace these requirements.

Practice trades, lessons, avatars, and preferences remain local; signup does not sync them to another phone. The app uses simulated market data and money. Chart coach's free file studies and manual ChatGPT handoff work without an API key. Automatic AI reviews remain disabled until owner model access and quotas are configured; referral rewards, push delivery, live execution, and production community rankings are not connected.

## References

- [Neon social OAuth setup](https://neon.com/docs/auth/guides/setup-oauth)
- [Google authentication project and web client setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)
- [Neon native system-browser integration pattern](https://neon.com/guides/capgo-capacitor-neon)
- [Neon trusted domains](https://neon.com/docs/auth/guides/configure-domains)
- [Neon auth production checklist](https://neon.com/docs/auth/production-checklist)
- [Expo SDK 58 browser sessions](https://docs.expo.dev/versions/v58.0.0/sdk/webbrowser/)
- [Expo Hosting deployments and aliases](https://docs.expo.dev/eas/hosting/deployments-and-aliases/)
- [Expo cloud environment variables](https://docs.expo.dev/eas/environment-variables/)
- [Expo internal distribution](https://docs.expo.dev/build/internal-distribution/)
- [Expo TestFlight distribution](https://docs.expo.dev/submit/testflight/)
- [Apple App Review guidelines](https://developer.apple.com/app-store/review/guidelines/)
