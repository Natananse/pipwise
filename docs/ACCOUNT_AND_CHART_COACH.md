# Account details, moving demo and chart coach

## Email verification

Neon Managed Auth remains the identity provider. New email accounts must verify
their address with an email code before the app publishes a signed-in session.
The app explicitly requests the OTP after registration. Neon automatic signup
and sign-in sending remain disabled to avoid two codes invalidating each other.
Successful sends have a 60-second resend cooldown. A delivery failure preserves
the already-created account and offers the code/resend step, rather than asking
the user to register the same account again. Existing unverified accounts can
resume verification from Sign in.

OTP delivery is configured through the PipWise email relay (2026-11-05).
The existing Auth application name is **PipWise**. Its `send.otp` webhook points
to `https://pipwise--beta.expo.app/api/auth-email`, with a 10-second per-attempt
timeout. Sign-in, email verification and password-reset codes use PipWise-only
subjects, HTML and plain text, from **PipWise <pipswise1@gmail.com>**. The Gmail
address remains visible; this setup does not create an app-owned email domain.
The default shared Neon provider remains configured but is bypassed for these
subscribed OTP events. Other email event types are not subscribed.

Expo Hosting's Free runtime rejects SMTP connections, so its API route verifies
the original Neon signature and forwards the exact signed bytes over HTTPS to a
Node relay. Function ingress strips `X-Neon-*` headers; the app host forwards the
six signed headers under `X-PipWise-Neon-*`, with a separate private origin secret.
The relay checks that secret before work, reconstructs the original headers, and
verifies the signature again against the existing London Auth branch's JWKS.
Only supported, unexpired email OTP events can reach the fixed Gmail transport.

The relay is Function `authmail` in the separate **Free** project **PipWise Email
Delivery** (`steep-hill-28178125`, branch `br-snowy-cake-b96dtgbu`, Frankfurt).
Functions are unavailable in the original London region. The app's users,
sessions and delivery ledger stay in the original project; `.neon` and `neon.ts`
still select it. The relay policy is isolated in `neon.email.ts`.

References: [Neon email customization](https://neon.com/docs/auth/guides/customize-emails),
[Functions availability](https://neon.com/docs/compute/functions/overview),
[Free allowances](https://neon.com/docs/introduction/plans).

Server-only settings belong in private `.env.local`, never `EXPO_PUBLIC_*`:

- SMTP: `PIPWISE_SMTP_USER`, `PIPWISE_SMTP_APP_PASSWORD` (Google App Password).
- Trusted hop: `PIPWISE_AUTH_EMAIL_RELAY_URL`, `PIPWISE_AUTH_EMAIL_RELAY_SECRET`.
- Restricted original app credential for the relay: `APP_RUNTIME_DATABASE_URL` (the `app_runtime` role),
  `PIPWISE_ORIGIN_AUTH_BASE_URL`, `PIPWISE_ORIGIN_AUTH_JWKS_URL`.
- Delivery gate: `PIPWISE_AUTH_EMAIL_ENABLED=1` after transport verification.

Expo preview holds only the hop URL/secret/gate as sensitive settings, alongside
its existing app configuration. Gmail credentials were removed from Expo. The
relay policy uploads only its seven declared settings, including SMTP and the
original app credentials; it ignores the new project's injected database URL.
Future relay deployments must explicitly select the email project:

```bash
neon deploy --project-id steep-hill-28178125 --branch br-snowy-cake-b96dtgbu --config neon.email.ts --env .env.local --no-env-pull
```

Migration `004_auth_email_deliveries.sql` adds private delivery metadata with
RLS and no client grants. Claims use per-request ownership, a 60-second lease,
and completed-event deduplication. Retention is 30 days. Recipient addresses,
codes and message bodies are never stored in that ledger or logged. Gmail uses
verified implicit TLS on port 465, fresh sockets, a four-second TLS deadline and
an eight-second total SMTP deadline. Only the approved templates are accepted.

Google accepted the dedicated mailbox credentials both locally and from the
Free hosted relay without sending email. Signature, forwarding, template,
transport and concurrency checks passed. Temporary health endpoints, tokens and
diagnostic deployments were removed. A real owner-authorized OTP/inbox check is
still needed; SMTP acceptance alone does not prove inbox delivery or rendering.
Gmail and Free-tier quotas still apply; no paid plan or payment method was added.

Emergency rollback restores Neon's shared OTP delivery (and its branding):

```bash
neon neon-auth config webhook update --project-id old-credit-68830713 --branch br-damp-bonus-zabur4d5 --enabled false
```

## Registration and profile

Full name and country are required for email signup. Phone is an optional contact
field in international format. Country and phone are saved privately through
`/api/account-details` after verification. They are not sent as unsupported custom
fields to Managed Auth. A native pending registration draft uses SecureStore,
expires after 30 minutes and only syncs to the matching account. Web drafts stay
in memory. Profile can retry saving if the API is unavailable. Name/avatar edits
remain available during a contact-service outage; unknown contacts are preserved.

Phone collection does not verify phone ownership and does not send SMS. No
address, date of birth, identity documents or KYC information is collected.

The account API verifies the Neon session JWT signature, issuer, audience,
expiry, verified email and subject using branch JWKS, then checks a matching,
unexpired, non-impersonated live session. Queries derive ownership
from the verified subject, never a user-supplied ID. The account and monthly usage
tables have RLS enabled and no PUBLIC/client grants; only server credentials can
access them. Migration files use the existing ledger and direct connection.

Native API requests use `EXPO_PUBLIC_APP_API_URL`, falling back to the HTTPS
origin of `EXPO_PUBLIC_NATIVE_AUTH_RETURN_URL`. Web uses same-origin API routes.
The server needs `APP_RUNTIME_DATABASE_URL`, `NEON_AUTH_BASE_URL` and `NEON_AUTH_JWKS_URL`.
On Expo Hosting these must be **sensitive** variables, not public variables or
secret-visibility variables (Hosting does not support secret visibility).

Follow [the manual security setup and rollback guide](DATA_LAYER_LEAST_PRIVILEGE.md)
before deploying this source. The API and relay reject legacy or owner-credential
fallbacks. No agent applies these SQL files. Existing app table names, schema
locations, owners and user rows are preserved; grants and RLS policies change.

## Moving practice market

The Trade tab opens an in-app simulated market. Seven assets have evolving
quotes, OHLC candles, prior-bar high/low, 20-bar support/resistance and a pivot.
Ticks run only while an interested screen is focused and the app is foregrounded.
The user can pause and resume. These are generated prices, not a real exchange
feed. External provider charts remain an optional viewing mode; their prices are
never scraped or used for fills.

New orders are tagged `moving-demo-v1`. Entry, close and open P/L use the same
engine quotes. Price anchors/history are saved before the wallet is persisted.
A failed or corrupt price-cache restore blocks new pricing with a retry option.
Existing fixed-price positions keep their original valuation and close rules.
SL/TP fields remain stored practice targets; automatic execution is not connected.
The simulator uses virtual funds, no leverage, a 0.02% fee on entry and exit, and
does not model brokerage execution, real spread, slippage or market hours.

## Chart coach

Open Profile → Chart coach. The file-study preview works without an AI key and
without sending uploaded data to a server. Import OHLC CSV/JSON (60–5,000 bars,
1 MB maximum) or paste it. Required columns are `time,open,high,low,close`; JSON
accepts an array or an object containing `candles`. Timestamps must be Unix
seconds/milliseconds or ISO strings with an explicit timezone. Bad OHLC, duplicate
times, invalid calendar dates and future bars are rejected. The selected timeframe
determines completed bars; live/incomplete bars are excluded from analysis.

ICT/SMC-inspired studies describe the prior range, wick-and-close sweeps and
unfilled three-bar gaps. MSNR-inspired studies describe support/resistance and
confirmed five-bar swings. These are explicitly defined learning rules, not an
official implementation, trained model or calibrated forecast. Reports show
levels, conditional upside/downside/range scenarios and limitations. Historical
uploads are labelled. A generated practice example is explicitly simulated.

The free manual ChatGPT path prepares a selectable/shareable prompt containing
the chosen study method, optional unverified notes, the local report and up to
60 completed candles. It excludes image bytes, file names and account details.
Sharing is a user action. A separate button opens `https://chatgpt.com/`; users
paste the prompt and attach any original chart photo themselves. Opening ChatGPT
does not transfer the photo, sign the user in or run a review. ChatGPT's own
account, upload and usage limits apply. This path requires no PipWise subscription
or model API key.

Automatic photo review is **disabled for the zero-budget beta**. There is no
model key or confirmed API-credit benefit in this checkout. The current chat is
not used as a backend. The free local/manual paths above remain available.

The optional server path accepts one PNG/JPEG/WebP under 3 MB. The user consents
to the named provider before any image is sent. It verifies a confirmed-email
Neon account, validates the request, and reserves both an account quota and a
shared app quota in Postgres before calling a model. Defaults are 10 attempts
per account and 50 across the app per UTC month. The shared cap works across
server workers; existing monthly attempts are included when it is introduced.
Failed provider attempts count. Requests have size, duration and output limits.
No screenshots, notes or reports are retained in our database. The selected
provider's processing/retention terms apply. Crop personal information first.

An optional OpenAI configuration uses the Responses API with `store: false`,
low-detail image input and bounded output. Verified free PipWise accounts can
use this owner-funded service without a RevenueCat subscription. The server
never reuses ChatGPT/Codex session credentials and never falls back to another
provider when a credit/spending limit is reached. Quotas bound attempts, not
dollar spending; the owner must verify the API organization's billing controls.
An API key alone does not prove that usage is free.

If owner-funded model access is available later, set server-only values in the
hosting environment and explicitly enable the gate only after a test:

```dotenv
CHART_COACH_ENABLED=0
CHART_COACH_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_MODEL=gpt-6-luna
CHART_COACH_MONTHLY_LIMIT=10
CHART_COACH_GLOBAL_MONTHLY_LIMIT=50
```

The model is explicit rather than silently upgraded or substituted. Verify its
current availability, image support and pricing. Eligible paid Pro/Business
owners may have an API-credit benefit, but eligibility/activation must be
confirmed in their own billing account. Do not buy a plan, add a payment method
or enable auto-recharge to make this beta work.

The legacy Gemini adapter remains optional. It additionally verifies a real
Pro/Elite RevenueCat entitlement for the Neon user ID:

```dotenv
CHART_COACH_ENABLED=0
CHART_COACH_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL=
REVENUECAT_SECRET_KEY=
```

For Gemini, verify any free-tier eligibility, quotas, processing terms and
entitlement IDs (`pro`, `elite`) before enabling it. Neither provider is enabled
by these code changes. Never prefix private keys with `EXPO_PUBLIC_`. Neon AI
Gateway is not provisioned.

No verified current news feed is configured. Fundamental notes are user-supplied,
unverified context. Neither the local rules nor a screenshot model can verify
current events or guarantee future prices. Full live-market simulation remains
dependent on licensed raw data, as described in [MARKET_DATA.md](MARKET_DATA.md).

## Android installation and checks

The file picker adds native code. Install the newly rebuilt Android test APK;
Metro reload alone cannot add its module. Older installations fail gracefully
with a rebuild message and still offer pasted CSV analysis.

Run `pnpm lint`, `pnpm typecheck`, `node --test tests/*.test.cjs` and Expo exports
for Android and web. Unit tests inject clocks, storage, JWTs, billing and AI
responses; they make no paid calls. Physical Android picker/gesture checks,
real inbox arrival, and a real premium AI-provider round trip must be checked
before offering these features as publicly available subscription benefits.

The 2026-11-05 release passed lint, TypeScript, 45 regression test files, all 20
Expo Doctor checks and Android/web exports. Feedback now uses the existing
authenticated `/api/feedback` server route; the Neon Data API is not required.
The beta at https://pipwise--beta.expo.app was updated and checked with automatic
AI disabled. Shared quota locking was tested with concurrent requests on an
isolated Neon copy, which was deleted afterwards. No model requests were made.

References: [Expo 58 DocumentPicker](https://docs.expo.dev/versions/v58.0.0/sdk/document-picker/),
[OpenAI image inputs](https://developers.openai.com/api/docs/guides/images-vision),
[OpenAI API-credit eligibility](https://developers.openai.com/api/docs/guides/chatgpt-api-credits),
[GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna),
[Gemini API reference](https://aistudio.google.com/api-reference/generate-content),
[Gemini pricing](https://aistudio.google.com/docs/pricing),
[RevenueCat customer API](https://www.revenuecat.com/docs/api-v1/customers).
