# Service deployment verification — 10 November 2026

The scoped database cutover and matching service deployment are complete. The maintained API/browser origin is [pipwise--beta.expo.app](https://pipwise--beta.expo.app). This report records service configuration and read-only acceptance; real email delivery, Google sign-in, signed-in account flows and physical-device acceptance remain separate checks. No email was sent and no account was created or deleted by this service verification.

## Accepted deployments

| Service | Verified target and result |
| --- | --- |
| Expo Hosting | Project `65b6f1aa-e283-46bd-8c3c-ad8ba7205c4b`; deployment **`zi2wl6zxa1`**, immutable URL [pipwise--zi2wl6zxa1.expo.app](https://pipwise--zi2wl6zxa1.expo.app) |
| Maintained alias | `beta` assigned to `zi2wl6zxa1` at **12:11:09 Africa/Addis_Ababa** / `09:11:09Z`; final inventory retained only this deployment and no custom domain |
| Email relay | Project `steep-hill-28178125`, Frankfurt `aws-eu-central-1`; branch `br-snowy-cake-b96dtgbu`; function **`authmail`**, active deployment **4**, `completed`, `nodejs24` |
| Production Auth | Project `old-credit-68830713`, branch `br-damp-bonus-zabur4d5`; existing Managed Better Auth retained; **localhost access disabled** and rechecked at `09:27:23Z` |

The final hosted deployment completed at `09:08:42Z` / **12:08:42 Africa/Addis_Ababa**. It uses the validated 10 November export, copied into ignored `dist/hosting-cutover-20261110`; all **155 file hashes** matched the original export. The deployed root layout and entry assets also matched their exported bytes:

- `_layout-f60e8bb79f2a7f39951cf32a34bf4b29.js`
- `entry-a2a7200440117e03d774a33f44758785.js`

## Credential scope and deployment inputs

Hosting preview contains exactly six sensitive server settings: `APP_RUNTIME_DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL`, `PIPWISE_AUTH_EMAIL_ENABLED`, `PIPWISE_AUTH_EMAIL_RELAY_URL` and `PIPWISE_AUTH_EMAIL_RELAY_SECRET`. The old owner-role `DATABASE_URL` was removed. The existing production mobile environment remains separate and contains its five public settings.

The final Hosting upload explicitly used **`EXPO_NO_DOTENV=1`**. Inspection of its actual uploaded manifest confirmed exactly the **14 reviewed remote variables: six sensitive server settings and eight existing public settings**. No owner database URL, migrator URL, SMTP credential or Google client secret entered that final worker. Keep `EXPO_NO_DOTENV=1` on future Hosting deployments: the inspected EAS CLI otherwise merges local `.env` files into the server deployment manifest.

The relay uses `APP_RUNTIME_DATABASE_URL` as **`app_runtime`**. Its `DATABASE_URL` and `DATABASE_URL_UNPOOLED` overrides also use that restricted login, replacing the relay project's injected database defaults. Its remaining settings are the delivery gate, origin secret, origin Auth URL/JWKS and SMTP pair. The legacy `PIPWISE_AUTH_DATABASE_URL` and unused `PIPWISE_AUTH_EMAIL_HEALTH_TOKEN` keys were removed; the final active-deployment environment-name audit passed.

## Verification results

At `09:02:15Z`, a temporary origin-secret-protected `authmailcheck` function verified the actual Neon Node runtime: **`app_runtime`**, intended database match, zero-row ledger access and successful SMTP TLS/authentication through `SMTP.verify()`. Missing and incorrect origin secrets returned **401** before application work. This check did not invoke mail sending. The diagnostic function was deleted at `09:02:22Z`; the final function inventory contains only `authmail` and the independently managed `retention` function.

All **13** final beta probes passed at **12:27:41 Africa/Addis_Ababa** / `09:27:41Z`:

- Anonymous account-details, feedback and deletion requests returned **401**.
- Unsigned hosted email webhooks and native relay requests without the origin secret returned **401**.
- Account-details and deletion preflights returned **204**, allowing the required `Authorization` / `X-Pipwise-Session` headers for the maintained origin.
- Privacy, deletion instructions and native-auth return pages returned **200**; the two compiled client assets matched the export byte-for-byte.
- The photo-review availability endpoint returned **200** with automatic reviews disabled.

Auth's application name remains **PipWise**. Email verification remains required with OTP, and automatic signup/sign-in email sending remains disabled so the app requests its single code. The custom Google provider has nonempty credentials and its client ID matches the existing private configuration. The trusted domain remains the maintained beta origin. The enabled webhook still intercepts only `send.otp`, targets `/api/auth-email`, and has a 10-second timeout. No provider credentials, user rows or Auth methods were replaced.

## Retired workers and recovery evidence

After beta acceptance, these alias-free legacy/unused deployments were deleted between `09:25:50Z` and `09:25:58Z`: `a6mkkxj512`, `x8i6pooefs`, `flkmtzid0y`, `w8ktc770yw`, `235is81eox`, `jxtkg9mem5` and `uzgy915fu8`. A fresh complete inventory confirmed **only `zi2wl6zxa1` remains**, with the `beta` alias and no custom domain. Historical commands that reassign beta to those retired IDs are no longer valid rollback commands.

Retired-host HTTP probes initially included an old static response; later no-cache API probes returned HTTP **500** for all seven hosts rather than the application's normal unauthorized response. Deployment retirement is established by the control-plane inventory. These results do not claim that cached public assets have been purged or that retired hostnames must return 404.

Protected local evidence is under **`/tmp/pipwise-service-prep/`** (`0700`; private files `0600`): original environment/alias snapshots, all retrievable legacy worker metadata/source under `worker-backups/`, the actual uploaded worker archives/manifests, native runtime proof, retirement evidence and final HTTP/configuration audits. The final upload archive SHA-256 is `357cf81bfe4558917fa36e5f93fd015c9e27206009e6a43eed440c36591f19e3`. The provider's worker downloads omit secret bindings and some runtime shim/source-map contents; the private environment snapshots and source history are separate recovery evidence. Restore compatible source into a new deployment with reviewed scoped credentials if rollback is needed, preserving the verified database recovery path.

No credential values, signed download URLs, private account contents or raw service errors are included in this report. Retention scheduling is managed separately; see [RETENTION_SCHEDULER_SETUP.md](RETENTION_SCHEDULER_SETUP.md). Current release/device work is tracked in [FINAL_RELEASE_STATUS.md](FINAL_RELEASE_STATUS.md).
