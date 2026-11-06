# PipWise release network and credential verification

Checked 6 November 2026. Requests were read-only except for the explicitly authorized public EAS backend URL setting and hosting deployments. No user account was created, deleted or modified by this diagnostic work.

## Final deployed release verification

The final reviewed web/API export was deployed on 6 November 2026 to **`x8i6pooefs`**, immutable URL [pipwise--x8i6pooefs.expo.app](https://pipwise--x8i6pooefs.expo.app), and assigned to the maintained **beta** alias. The hosting preview environment's database host/database, Auth base URL and JWKS were privately compared to the intended production branch; **all three comparisons matched**. No private values were printed or copied into the production mobile environment. Local `.env` and `.env.local` permissions are both **600**.

The generated export was staged in ignored `dist/release-web` after clearing only that task-owned staging directory. Its 93 files matched the final export's SHA-256 tree. The deployed client assets below also matched the final export byte-for-byte:

```text
entry-6cc2d2192be0ebf956653807706c96a3.js
_layout-99305a74447c74a313293105d6ea6ae8.js
```

Final safe acceptance results:

| Request | Verified result |
| --- | --- |
| GET [privacy-policy](https://pipwise--beta.expo.app/privacy-policy) | **200 HTML**; contains Natnael Ermias, pipswise1@gmail.com, the Google profile-photo and authentication IP/user-agent disclosures, the final entry asset, and no unknown owner placeholders. |
| GET [delete-account](https://pipwise--beta.expo.app/delete-account) | **200 HTML**; identifies PipWise, contains pipswise1@gmail.com and ownership-verification/deletion instructions, references the final entry asset and contains no unknown owner placeholders. |
| GET [native-auth.html](https://pipwise--beta.expo.app/native-auth.html) | **200 HTML** with `/native-auth-return.js`. |
| POST `/api/delete-account` with the same-origin header and no authentication | **401** JSON `UNAUTHORIZED`; no account deletion performed. |
| OPTIONS `/api/delete-account` with same-origin and requested auth/session headers | **204**; permits `Authorization, Content-Type, X-Pipwise-Session` and POST/OPTIONS for the maintained origin. |
| GET `/api/account-details` without authentication | **401** JSON `UNAUTHORIZED`. |
| GET `/api/chart-coach` | **200**, automatic reviews remain disabled. |
| Googlebot-user-agent diagnostic GET of all three public pages above | **200** for each. This checks the observed user-agent rejection distinction; it is not a claim that Google has completed its own crawl/review. |

No signed-in production user was deleted, no verification/recovery email was sent and no Play build/submission was started during these checks. Device-level signup, Google login and signed-in production acceptance remain separate from these safe route checks.

The original beta deployment **`w8ktc770yw`** was captured before publishing and remains the rollback target. An intermediate deployment was **`flkmtzid0y`**. If a later verified failure requires reverting the alias, the documented command is:

```bash
pnpm dlx eas-cli@latest deploy:alias --alias beta --id w8ktc770yw --non-interactive
```

Rolling back also removes the newly published policy/deletion routes from the beta alias, so use it only for a confirmed runtime failure and restore a corrected release afterward.

## Exact cause of the earlier HTTP 403

The failing public origin was `https://pipwise--beta.expo.app`, including `/native-auth.html` and application API paths. Repeating a request with Python's default HTTP client reproduced:

```text
GET https://pipwise--beta.expo.app/native-auth.html
User-Agent: Python-urllib/3.11
HTTP 403

error code: 1010
```

The same URL with the Android HTTP-client user agent `okhttp/4.12.0`, Android Chrome, or a descriptive application user agent returned HTTP 200. This isolates the observed rejection to Cloudflare's browser-signature/Browser Integrity Check treatment of the diagnostic client. Cloudflare documents the default Python urllib user agent as an example and recommends a descriptive application user agent for programmatic requests. [Cloudflare error 1010 documentation](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1010/).

No application authentication or CORS protection was weakened. There is no need to spoof a browser in the mobile app. Use a descriptive audit-client user agent for deployment probes. Real authenticated device login still needs its normal acceptance test.

## Application routes and response bodies

These results used a descriptive `PipWise-Release-Audit/1.0` user agent and no authentication token. They verify route reachability and expected unauthenticated behavior, not a signed-in user's full database workflow.

| Method and URL | Status | Response body / meaning |
| --- | --- | --- |
| GET `https://pipwise--beta.expo.app/native-auth.html` | 200 | HTML titled `Return to PipWise`, loading `/native-auth-return.js`. |
| GET `https://pipwise--beta.expo.app/api/account-details` | 401 | `{"error":{"code":"UNAUTHORIZED","message":"Sign in with a confirmed email to continue."}}` |
| POST `https://pipwise--beta.expo.app/api/feedback` with `{}` and no token | 401 | `{"error":{"code":"UNAUTHORIZED","message":"Sign in with a confirmed email to continue."}}` |
| GET `https://pipwise--beta.expo.app/api/feedback` | 405 | Expo Hosting `Method Not Allowed` HTML. This endpoint accepts POST, so GET is not a valid health check. |
| GET `https://pipwise--beta.expo.app/api/chart-coach` | 200 | `{"available":false,"provider":"gemini","requiresSubscription":true,"monthlyLimit":10,"message":"In-app photo reviews are disabled until the owner connects a provider. Local file studies and the manual ChatGPT workflow are available."}` |
| GET `https://pipwise--beta.expo.app/api/market` without query fields | 400 | `{"error":{"code":"INVALID_REQUEST","message":"Choose a supported market, timeframe, and resource."}}` |
| GET `https://pipwise.expo.app/native-auth.html` | 404 | Expo Hosting HTML titled `Error: Worker Deployment Not Found`. The separate production alias has not been deployed/promoted; do not point the phone at it yet. |

An OPTIONS request to the beta account-details route with origin `https://pipwise--beta.expo.app` returned 204 and allowed that origin, credentials, `authorization,content-type`, and GET/POST/PUT/PATCH/DELETE. Native mobile HTTP calls do not use browser CORS enforcement. The existing account-details, feedback and chart-coach clients include `Authorization: Bearer <JWT>` for protected calls. A missing or invalid token correctly produces 401.

## Explicit standalone backend configuration applied

The following public setting was created in **both** EAS preview and production environments and in ignored `.env.local`:

```dotenv
EXPO_PUBLIC_APP_API_URL=https://pipwise--beta.expo.app
```

This maintained cloud-hosting alias works independently of Metro, port 8081 or the developer's computer. Existing native builds must be rebuilt to include changed public variables. Client code may retain compatibility with older callback-origin fallback behavior, but the release preflight now requires an explicit API origin. It rejects local DNS/IP literals and privileged credential names under `EXPO_PUBLIC_`.

The current production build environment contains only the following five public settings:

```text
EXPO_PUBLIC_NEON_AUTH_URL
EXPO_PUBLIC_GOOGLE_AUTH_ENABLED=1
EXPO_PUBLIC_APPLE_AUTH_ENABLED=0
EXPO_PUBLIC_NATIVE_AUTH_RETURN_URL=https://pipwise--beta.expo.app/native-auth.html
EXPO_PUBLIC_APP_API_URL=https://pipwise--beta.expo.app
```

The preview environment additionally contains the hosting server's private database/Auth/email-relay settings and disabled automatic photo-review gate. These server settings were not copied to the production mobile build environment. Private values are intentionally omitted from this report. [Expo environment variable guidance](https://docs.expo.dev/eas/environment-variables/manage/).

To reproduce the public URL setup:

```bash
pnpm dlx eas-cli@latest env:set preview --name EXPO_PUBLIC_APP_API_URL --value https://pipwise--beta.expo.app --visibility plaintext --non-interactive
pnpm dlx eas-cli@latest env:set production --name EXPO_PUBLIC_APP_API_URL --value https://pipwise--beta.expo.app --visibility plaintext --non-interactive
```

To publish updated API/legal routes to the existing maintained alias, first export the web app, then deploy with the existing server environment:

```bash
pnpm exec expo export --platform web --output-dir /tmp/pipwise-release-web
pnpm dlx eas-cli@latest deploy --alias beta --environment preview --export-dir /tmp/pipwise-release-web --non-interactive
```

This changes the beta hosting alias to the new immutable deployment. `--environment preview` selects the existing hosting server variables; production mobile build variables are selected separately by `eas.json`. Run final tests and deployment checks before using this command. Promoting to the separate `pipwise.expo.app` production alias is optional; it requires intentional URL, trusted-domain and hosting-environment preparation. [Expo hosting aliases](https://docs.expo.dev/eas/hosting/deployments-and-aliases/).

## Google OAuth redirects and SHA-1

This app uses Neon Managed Better Auth's **web OAuth** flow in the system browser, not the Google Android SDK. Google Cloud's Web application OAuth client must use this exact authorized redirect for the current production Auth branch:

```text
https://ep-round-tooth-za67qro2.neonauth.c-2.eu-west-2.aws.neon.tech/neondb/auth/callback/google
```

Neon must trust the hosted application origin:

```text
https://pipwise--beta.expo.app
```

The post-provider relay and final app deep link are:

```text
https://pipwise--beta.expo.app/native-auth.html
pipwise://auth-callback
```

Those latter URLs are not replacements for Google's Neon authorized redirect. Keep the Google OAuth client secret in Neon/server configuration. Verify Google Auth Platform publishing status, consent branding and custom provider settings in the owner consoles; local client-secret presence is not proof they are installed there.

No Google Android OAuth client SHA-1 is required for this existing web flow. If native Android Google sign-in is added, register an Android OAuth client for package `io.pipwise.app` with the certificate that signs the installed build.

The existing **EAS production keystore** public fingerprint was read from the credential summary without downloading a private key:

```text
SHA-1:   2E:54:7D:2A:91:F7:7C:57:C5:84:4F:12:AD:C2:69:95:08:DB:5D:B0
SHA-256: 7E:3F:2F:90:C1:86:EA:CE:47:22:16:F9:C9:04:E7:6D:6A:82:90:CB:18:8C:88:E7:EA:00:66:E8:5F:6F:1C:24
```

That fingerprint applies to the EAS upload/direct-install signing key. **Google Play may re-sign the installed app with a different app-signing key.** Read the Play app-signing certificate SHA-1 from Play Console > App integrity/App signing; it could not be established from this repository/EAS summary. EAS showed no Play submission service-account key assigned.

To view the EAS fingerprint again:

```bash
pnpm dlx eas-cli@latest credentials --platform android
```

Choose `production`; the Android credential summary displays SHA-1/SHA-256. Do not generate a replacement keystore for an existing app. Keep downloaded credential files private and ignored. [Expo app credentials](https://docs.expo.dev/app-signing/app-credentials/).

## Git history and secret rotation

All **18 reachable commits / 436 historical file blobs** were scanned. No `.env`, `.env.local`, private-key/keystore file or root credential JSON was found in that history. No historical match was found for the current six private database, Google client-secret, SMTP-password and email-relay values loaded from local env files. Public variables are service URLs/provider flags, Supabase publishable configuration and optional native RevenueCat public SDK keys, rather than privileged credentials.

No mandatory credential rotation is indicated by this repository/history audit. Rotate a credential if it was exposed outside this checked history, sent to an untrusted party or included in a previously distributed client bundle. The values requiring rotation in that event are database passwords/URLs, Google client secret, SMTP app password, relay secret and any privileged model/provider/RevenueCat or deployment key involved. Public Auth/service URLs, Google client ID and Supabase publishable/anon keys do not require rotation merely because clients can read them.
