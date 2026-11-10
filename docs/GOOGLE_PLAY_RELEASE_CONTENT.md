# PipWise Play Console content

Prepared from the app source and live service configuration on 6 November 2026. This copy describes the current free educational release: local practice, optional Neon accounts/private feedback and optional TradingView charts. Automatic photo reviews are disabled on the maintained backend; RevenueCat public SDK keys are absent from the production mobile environment. Revisit the conditional answers before enabling those services or distributing a build with different collection behavior.

## Store listing — ready to paste

**App name:** PipWise

**Short description — 65 characters:**

```text
Learn trading concepts and practice with virtual funds and charts
```

**Full description — within 4,000 characters:**

```text
Build your understanding of financial markets with PipWise, an educational app for adult learners.

LEARN AT YOUR OWN PACE
Explore 83 lessons across nine chapters, check your understanding with quizzes, bookmark useful topics and save your progress on your device.

PRACTICE WITH VIRTUAL FUNDS
Explore seven moving simulated markets, open and close practice positions, and review your virtual portfolio, trading history, costs and performance. Practice quotes are simulated and are separate from provider market prices.

STUDY CHARTS
Work through chart-pattern exercises and import candle files for educational analysis on your device. Prepare your own chart questions and choose whether to share a prompt with an external service. Optional TradingView charts offer additional market context; availability and delays vary by provider.

KEEP TRACK OF YOUR PROGRESS
Your virtual trades, preferences, bookmarks and lesson progress stay on your device. An optional account supports sign-in, profile details and private feedback. Practice records do not sync across devices.

PipWise runs as an installed app without a developer server. Accounts, provider charts and online support features need an internet connection.

PipWise is designed for adults aged 18 and over. It does not execute brokerage trades, accept deposits or offer real-money prizes. Virtual balances have no cash value. Simulated performance does not predict real results. Educational content only; not financial advice.
```

Do not add claims about active automatic AI reviews, guaranteed returns, a real community leaderboard, broker matching, referral rewards, raw live feeds or paid benefits. Those are not established features of this release.

**Contact email:** `pipswise1@gmail.com`

**Published privacy-policy URL:** `https://pipwise--beta.expo.app/privacy-policy`

**Published account-deletion URL:** `https://pipwise--beta.expo.app/delete-account`

Both public pages are deployed and were checked without authentication. Destructive flow integration passed on isolated synthetic accounts; complete real-phone acceptance before Play submission. The policy names Natnael Ermias and pipswise1@gmail.com. It commits to account-data deletion within 30 days and feedback retention of up to 12 months; activate the retention maintenance job described in the release report.

## Data safety — current release answers

Start at Play Console > App content > Data safety. These answers describe actual collection rather than Android permissions. Include all active distributed versions and SDKs. [Google's definitions and form guidance](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en).

### App-level answers

| Question | Answer for this release |
| --- | --- |
| Does the app collect or share any required user data types? | **Yes.** Account and feedback data leave the device. |
| Is user data encrypted in transit? | **Yes**, for the configured HTTPS Auth/API, secure database connection, SMTP TLS and provider-chart services. This does not mean local practice storage is encrypted. |
| Account creation methods | **Username and password** (the username is an email address), and **OAuth** (Google). No SMS/phone login. Choose the corresponding options shown by the current form. |
| Can users request account deletion? | **Yes only after the deployed in-app/web deletion flow passes acceptance testing.** Supply the `/delete-account` URL above. |
| Independent security review / MASA validation | **No.** No independent certification was established. |
| Data used for advertising or marketing | **No** for the current app. |

### Confirmed account and support collection

For every row below: **Collected = Yes; ephemeral = No**. Accounts and feedback are optional because users can choose local practice without signing in; fields described as required apply when choosing email registration. There is no automatic upload of the practice wallet.

| Data type to select | Data and code evidence | Required/optional selection | Purpose selections |
| --- | --- | --- | --- |
| Personal info > Name | Full name sent to Neon Auth and editable in the profile; `src/lib/neonAuth.ts`, `accountProfile.ts`. | **Optional** across the app; required for email signup. | **App functionality; Account management** |
| Personal info > Email address | Signup/login, verification/recovery and identity; `neonAuth.ts`. | **Optional** across the app; required for an email account. | **App functionality; Account management; Fraud prevention, security and compliance** |
| Personal info > User IDs | Neon account subject, account ownership, feedback and deletion authorization. | **Optional** across the app; required when using an account. | **App functionality; Account management; Fraud prevention, security and compliance** |
| Photos and videos > Photos | Google profile-photo URL stored by the Auth provider. Actual retained metadata was verified; illustrated in-app avatars are separate local choices. | **Optional**, through Google sign-in. | **App functionality; Account management** |
| Device or other IDs | Authentication session identifiers, IP address and browser/device user-agent information retained by Neon Auth. Actual populated fields were verified. No location inference was established. | **Optional** across the app; associated with account sessions. | **Account management; App functionality; Fraud prevention, security and compliance** |
| Personal info > Phone number | Optional profile contact field; `RegistrationFields.tsx`, `accountDetailsApi.ts`. No SMS verification or phone login. | **Optional** | **App functionality; Account management** |
| Personal info > Other info | User-selected country/region and other account authentication information handled by the Auth service. Country is not a device GPS reading. | **Optional** across the app; country required in email registration. | **App functionality; Account management** |
| App activity > Other user-generated content | Private feedback message, rating and category; `src/lib/feedback.ts`, `feedbackApi.ts`. | **Optional** | **App functionality; Analytics** (manual review of feedback to diagnose issues and improve the app) |
| App info and performance > Diagnostics | User-submitted bug/support context: app version, platform, language and message. No automatic crash reporter or stack-trace collector was found. | **Optional** | **Analytics; App functionality** |

**Sharing for the account/support rows:** select **No** only for transfers to Neon, hosting and email providers that actually process solely on the developer's behalf under the applicable service-provider arrangements. Provider processing remains collection. Do not label a processor transfer as sharing merely because the processor is another company. Conversely, do not claim the exception for a vendor using data independently.

### TradingView widget collection — include in vendor review

`src/components/TradingViewWidget.tsx` loads TradingView-hosted chart code, so its behavior belongs in the app's disclosure. Its [widget-specific privacy FAQ](https://www.tradingview.com/widget-docs/faq/general/) describes embedding-page URL, widget type, displayed symbol and short-term IP processing for connection/security. It says the widget sets no cookies and does not associate IP with identifiable data.

- **App activity > App interactions:** disclose chart/widget and symbol request information where it remains user-linked or pseudonymous. Collection is **optional**, because users choose provider chart mode. Purposes: **App functionality** and any vendor **Analytics** actually applied. Do not mark persistent vendor statistics ephemeral.
- **IP/network information:** do not automatically classify this as GPS location, advertising ID or a stable device ID. Google's guidance says the correct category depends on the use of the IP. If provider/hosting settings use it to derive location or identifiers, additionally declare **Approximate location** or **Device or other IDs** as applicable. Connection/security-only transient processing must be assessed against the exact form definitions and actual retention.
- **Sharing:** use the relevant service-provider, user-initiated or anonymous-transfer exception only if the arrangement/behavior satisfies it. Until that is confirmed, do not submit a blanket “No data shared” statement. A privacy-policy link alone does not establish a sharing exemption.

This vendor classification is an operator/provider-contract check rather than a fact the client source can certify. The confirmed account/support rows above are ready to enter; finish this check before submitting the full declaration.

The Auth inventory was checked against actual retained fields using aggregate queries only. Its Google provider maps the profile image URL from Google's picture claim; session records store IP and user-agent values. Filtering these fields out of the app's displayed session does not remove server-side retention. See [Better Auth's schema](https://better-auth.com/docs/concepts/database) and [Google provider source](https://github.com/better-auth/better-auth/blob/main/packages/core/src/social-providers/google.ts).

### Data not collected off-device by the current app features

- Virtual balances, trades, practice P/L, preferences, lesson progress, bookmarks, watchlists, avatars and chart-exercise answers stay in local storage. They are not real bank/payment information.
- Selected CSV/JSON files are processed on-device. The app deletes its temporary picker copy after reading it. Do not select **Files and docs** solely because the system picker is available.
- Manual ChatGPT text sharing is user-directed; simply opening ChatGPT transmits no prompt or image. It is distinct from an automatic model API request.
- No device GPS, contacts, SMS inbox, microphone, calendar, health data, installed-app inventory, advertising ID collection or automatic crash-reporting SDK was found.
- A verification/recovery email sent by the Auth service is not access to the user's mailbox. Do not select **Messages > Emails** solely for sending account messages.

### Conditional answers if features are enabled later

| Feature | Required declaration update |
| --- | --- |
| Play/RevenueCat subscriptions | Add **Financial info > Purchase history** and associated **User IDs**; declare actual SDK functionality/analytics and configured integrations. The app never receives payment-card details. Follow [RevenueCat's Play guidance](https://www.revenuecat.com/docs/platform-resources/google-platform-resources/google-plays-data-safety). |
| Automatic photo AI reviews | Add **Photos**, submitted notes/other user content, account-linked review-attempt interactions and applicable provider processing. Recheck retention; server memory-only processing does not prove the AI provider is ephemeral. Update consent, reporting and privacy text too. |
| Automatic analytics/crash SDK, location, marketing or new providers | Reinspect the SDK and update the form before distribution. |

## Content rating — questionnaire answers

Use the **Other app / education** category that matches the current IARC options. The questionnaire category is separate from store category and the chosen 18+ audience. Google/IARC computes the rating; do not manually promise “Everyone” or “18+” as the resulting rating. [Google rating instructions](https://support.google.com/googleplay/android-developer/answer/9859655?hl=en).

| Topic | Answer | Reason |
| --- | --- | --- |
| Violence, blood, horror/fear | **No** | No such authored content found. |
| Sexual content/nudity | **No** | No such content found. |
| Offensive language/profanity | **No** | No such authored content found. |
| Drugs/alcohol/tobacco | **No** | Not a feature or subject of the authored app content. |
| Real-money gambling, betting, cash prizes | **No** | No deposits, stakes, payouts or cash-value rewards. |
| Simulated casino gambling | **No** | The app teaches market concepts and simulates financial positions; it does not simulate slots, casino cards, roulette or other casino games. |
| Public user-generated content, chat or social interaction | **No** | Feedback is private to the developer. There is no public community feed/chat. |
| Location sharing | **No** | No user-location sharing feature. |
| Unrestricted web access/browser | **No** | External links and charts serve fixed feature purposes, rather than an unrestricted in-app browser. |
| Digital purchases | **No for this configured free release**; **Yes if store products become available** | Production mobile RevenueCat keys are unset. Update this if the release can actually purchase digital features. |

Review external content and generated outputs if enabled before submission; the answers above cover the current authored/free release.

## Target audience, ads and financial declaration

**Target audience:** select **18 and over only**, consistent with the adult market-education release positioning. Do not select child age groups or market the app as a children's product. This is an intended-audience choice, not a claim that the app verifies every user's birth date. If you enable Play's optional **Restrict Minor Access** setting, verify the availability restriction and listing behavior in Console. [Target-audience settings](https://support.google.com/googleplay/android-developer/answer/9867159?hl=en).

**Ads declaration:** select **No, my app does not contain ads** for the current app. No advertising SDK, ad unit or sponsored placement is implemented. Branding/attribution links are not paid ad placements. Recheck any provider-controlled widget display and update the declaration if it introduces actual advertisements.

**Financial-features declaration:** complete it even for closed testing. Do not claim brokerage execution, lending, deposits, investment custody or cryptocurrency exchange. Where the form offers **Other** financial support/education, use this explanation:

```text
PipWise provides financial-market education, chart studies and a simulator using virtual funds. It does not accept deposits, execute brokerage trades, provide lending, hold investments or cryptocurrency, or pay real-money prizes. Simulated results have no cash value and do not predict real trading outcomes.
```

Choose the current form category that accurately fits that explanation rather than selecting regulated execution/custody features. [Financial declaration guidance](https://support.google.com/googleplay/android-developer/answer/13849271?hl=en).

## Screenshots and graphics to prepare

**9 November update:** four real 1080×1920 RGB screenshot candidates from installed APK **1.0.0 / code 8**, plus Settings version evidence, are saved in [assets/play-store/screenshots](../assets/play-store/screenshots/README.md). They cover Trade, order review, Learn and Analyse; they are not a completed device sign-off or an approved/uploaded listing. See the capture notes and [native acceptance observations](ANDROID_NATIVE_SMOKE_TEST.md) before final selection. The icon and feature graphic remain in [assets/play-store](../assets/play-store/README.md).

Capture these **six real phone screens** from the final standalone release build, using an account/demo workspace without personal contact details. Preserve simulated-data labels and avoid unfinished paid/AI screens.

| Order | Screen | Show | Suggested alt text |
| --- | --- | --- | --- |
| 1 | Trade/practice | A moving simulated chart, selected market and virtual-funds label. | PipWise simulated market chart and virtual trading workspace. |
| 2 | Order entry | Buy/sell practice quantity, collateral/cost details and virtual-order confirmation controls. | Practice order entry showing quantity and virtual trading costs. |
| 3 | Learn | Chapter/lesson path and real saved completion progress. | Market lessons and saved learning progress. |
| 4 | Lesson quiz or Analyse | A quiz or chart-pattern exercise with educational feedback. | A chart exercise with an explanation of the simulated outcome. |
| 5 | Portfolio | Real local practice history, portfolio curve and metrics; no fabricated leaderboard results. | Virtual portfolio performance and completed practice trades. |
| 6 | Chart coach | A valid candle-file study and educational observations, without implying active automatic AI. | On-device candle-file study and educational chart observations. |

Optional seventh/eighth images: Progress, and Settings showing privacy/deletion access. Prefer product-value screens among the first four.

- **Play icon:** 512×512, 32-bit PNG, maximum 1,024 KB. Use the PipWise mark at clear small sizes; no rankings, pricing or store badges.
- **Feature graphic:** 1024×500, JPEG or 24-bit PNG without alpha. Use the brand palette, chart-learning context and restrained copy such as “Learn. Practice. Reflect.” Keep key content away from crop edges.
- **Phone screenshots:** target 1080×1920 portrait, JPEG or 24-bit PNG without alpha. Google requires at least two screenshots; four or more at that resolution are recommended for promotional eligibility. Up to eight per device type. Keep longest dimension at most twice the shortest; accepted general dimensions are 320–3840 px.
- Capture actual UI rather than AI-generated fake screenshots. Do not claim a ranking, profit guarantee, active feature or reward that the release does not deliver.

[Google asset specifications](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en).

## Closed testing — account eligibility and daily plan

The mandatory gate applies to **personal developer accounts created after 13 November 2023**. For the app, at least **12 testers must have stayed opted in continuously for the preceding 14 days** when applying for production access. Internal testing/direct APK installs do not meet this gate. Production access is reviewed, followed by release review. [Google's current testing rule](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).

Check your account in Play Console's developer-account details for personal versus organization account type. Open this app's Dashboard and Production area: a testing/“Apply for production” requirement card or locked production access is the practical authority for the app's eligibility. Check the original registration confirmation if the account creation date is unclear. Do not assume a friend's account has already satisfied the requirement for this app.

### Recruitment and tracking

Recruit **15–20 real Android users** so there is a buffer above 12: friends, colleagues, classmates and adult market-learning communities. Ask for honest testing and feedback, not paid ratings or fabricated usage. Explain that they must keep the same Google account opted in through the test and application period.

Create a private tracker with: tester Google account, consent/contact preference, device/model, Android version, opt-in date/time/timezone, installation date, build/version code, assigned scenario, last test confirmation, issue/feedback, severity, fix/build, retest result and continuous-opt-in status. Use Play private feedback or the in-app feedback feature. Do not expose tester emails in a public sheet.

Release the actual AAB to a closed track, add the email list or Google Group, share the Play opt-in link and confirm opt-in plus install. Start the clock from the 12th tester who will remain continuously opted in, not when recruiting or building starts. Replacements need their own 14 days. Keep genuine engagement and summarize concrete findings/fixes for the production-access application; there is no universal Google rule requiring a particular number of daily opens.

### Day-by-day plan starting 6 November 2026

The dates below assume the closed release is live and at least 12 qualifying users actually opt in on November 6. If rollout review or recruitment finishes later, shift the entire eligibility date accordingly. Each day, check opt-in continuity, record feedback and retest relevant fixes.

| Day/date | Recruitment/coordination | Test focus and evidence |
| --- | --- | --- |
| Day 0 — Fri Nov 6 | Recruit 15–20, add accounts, send opt-in/install instructions and confirm the 12th timestamp. | Install from Play, standalone startup without Metro, splash/onboarding; record device and build. |
| Day 1 — Sat Nov 7 | Help remaining recruits join; retain a qualifying group of at least 12. | Email signup, verification/resend, password recovery with real inboxes. |
| Day 2 — Sun Nov 8 | Confirm opted-in status and collect sign-in issues. | Google browser login/return, cancel/retry, sign-out and return login. |
| Day 3 — Mon Nov 9 | Share a short lesson assignment. | Lessons, quiz answers, bookmarks, force-close/reopen and saved progress. |
| Day 4 — Tue Nov 10 | Assign different markets/devices across testers. | Open/close virtual orders, quantities, fees, insufficient balance and USD/JPY conversion. |
| Day 5 — Wed Nov 11 | Review duplicate reports and prioritize reproducible defects. | Portfolio/P&L/history and reopening with saved positions. |
| Day 6 — Thu Nov 12 | Provide a safe sample candle file and ask for picker feedback. | Valid/invalid CSV/JSON, canceled picker, file size limits and chart study. |
| Day 7 — Fri Nov 13 | Midpoint opt-in audit and feedback summary. | Airplane mode, slow internet, expired session, API errors and retry behavior. |
| Day 8 — Sat Nov 14 | Ask users to keep testing through the coming week. | Background/foreground, process death, app restart and interrupted browser callback. |
| Day 9 — Sun Nov 15 | Assign accessibility checks to a varied device group. | Small phones, large text, TalkBack, contrast, back gestures and chart controls. |
| Day 10 — Mon Nov 16 | Confirm language coverage and review screenshots of issues privately. | Languages/preferences, profile edits, saved country/optional phone and sign-out behavior. |
| Day 11 — Tue Nov 17 | Assign deletion to disposable tester accounts, retaining Play opt-in. | In-app and public-web deletion; verify sessions/data disappear and local state resets. Test billing only if enabled. |
| Day 12 — Wed Nov 18 | Distribute a corrected closed-track build if needed. | Update through Play, regression of fixed bugs and retained non-deleted local progress. |
| Day 13 — Thu Nov 19 | Collect final feedback, final qualifying count and test/fix evidence. | Full smoke test, privacy/deletion links, listing accuracy and unresolved blocker triage. |
| Day 14 — Fri Nov 20 | After the full elapsed period, confirm 12 qualifying testers and complete the access application. | Summarize tester engagement, findings and fixes. Continue testing while review runs. |

**Earliest production-access application:** **20 November 2026 at or after the same time the 12th qualifying tester opted in on 6 November**, in Africa/Addis_Ababa (UTC+3). November 20 is an application date, not guaranteed public availability. If only recruitment/setup starts November 6, eligibility is later.

## Owner details supplied

- Legal developer/operator: **Natnael Ermias**.
- Privacy/support/deletion and listing contact: **pipswise1@gmail.com**.
- Account data is kept while active; deletion requests complete within **30 days**. Feedback is kept for **up to 12 months** or removed earlier on account deletion. Activate and monitor the prepared retention job; provider backup/security-log schedules are separate.

All other text above uses current code or explicit release choices. Confirm third-party data classification/contract exceptions, final build feature availability and the Console's exact questionnaire wording before submitting.
