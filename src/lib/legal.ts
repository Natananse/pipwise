export const legalDetails = {
  operator: 'Natnael Ermias',
  contactEmail: 'pipswise1@gmail.com',
  retentionPeriod: 'up to 12 months',
  effectiveDate: '6 November 2026',
};

export const privacySections: readonly { title: string; paragraphs: readonly string[] }[] = [
  {
    title: 'Who operates PipWise',
    paragraphs: [
      `PipWise is operated by ${legalDetails.operator}. Contact ${legalDetails.contactEmail} with privacy questions or requests.`,
      'PipWise provides educational lessons, chart studies and a practice simulator using virtual funds. It does not accept deposits or execute brokerage trades.',
    ],
  },
  {
    title: 'Accounts and authentication',
    paragraphs: [
      'You can practice locally without creating an account. When you create an email account, Neon Auth processes your full name, email address, account identifier, password and verification or recovery information. Google sign-in, when selected, is processed by Google and Neon Auth. We use this information to create, verify and secure your account and restore access.',
      'Google sign-in can supply your Google profile-photo URL, which is stored with account metadata even though PipWise uses a separately selected illustrated avatar in the app. Authentication sessions also retain session identifiers, IP address and browser or device user-agent information for account access and security. We do not use these fields to track your device GPS location.',
      'Email registration asks for your country or region and an optional contact phone number. These details are stored privately with your account and displayed in your profile. Your phone number is not verified by SMS and is not used to sign in. You can correct your profile details in the app.',
      'Our authentication and email services process the technical information needed to deliver account messages and protect sign-in. The configured email relay uses Google Gmail SMTP for verification and recovery messages.',
    ],
  },
  {
    title: 'Practice information on your device',
    paragraphs: [
      'Your language, learning preferences, illustrated avatar, bookmarks, watchlist, lesson progress, chart-exercise answers and virtual wallet and trades are saved on your device. Practice records are not synced to our account database. This local practice storage is not encrypted by PipWise. Native sign-in credentials use secure device storage.',
      'Signing out keeps local practice records. Account deletion from the app also clears PipWise data on that installation. Deleting through this website clears data in that browser; it cannot remotely erase local-only practice records on your other devices. You can remove those records using the app deletion flow or Android app-storage controls.',
    ],
  },
  {
    title: 'Feedback and support',
    paragraphs: [
      'If you submit feedback while signed in, we store your account identifier, report identifier, rating, category, message, app version, platform, language and submission time. We use this information to investigate problems, provide support and improve PipWise. Feedback is private rather than a public community post. Avoid including passwords, payment information or other unnecessary sensitive details in a message.',
    ],
  },
  {
    title: 'Charts, files and optional AI reviews',
    paragraphs: [
      'TradingView supplies optional embedded market charts. Its chart requests include the embedding page address, widget type, displayed symbol and network information such as your IP address. Provider charts are separate from PipWise simulated prices and virtual orders. TradingView processes these requests under its own privacy practices.',
      'PipWise reads a chart file only after you select it. CSV and JSON candle studies run on your device. The app deletes its temporary picker copy after reading it into screen memory; your original file remains under your control. Imported files and reports are not saved into your virtual wallet.',
      'Preparing a manual ChatGPT prompt does not send text or an image to ChatGPT. You choose whether to share the text and separately attach a file there. Opening ChatGPT alone sends neither your prompt nor image. Information you choose to share is also subject to that service’s terms and privacy policy.',
      'If automatic photo reviews are enabled, the app identifies the provider and asks for your consent before a selected image and study notes are sent through our server to OpenAI or Google Gemini. Your account is used to authorize access and enforce usage limits. Our database stores account-linked monthly attempt counts, including failed attempts, but does not intentionally store the uploaded image or generated report. The model provider may retain processing information according to its own terms; server processing in memory is not a promise of immediate provider deletion.',
    ],
  },
  {
    title: 'Optional purchases and service providers',
    paragraphs: [
      'When mobile subscriptions are available, Google Play or the applicable app store and RevenueCat process purchase information and entitlements. RevenueCat associates entitlements with your PipWise account identifier when you sign in for purchases or restore. PipWise does not receive payment-card details. Manage subscription cancellation through your store account; account deletion must not be assumed to cancel store billing.',
      'Expo hosts the application and API routes. Neon provides account authentication and the account database. These hosting, database, authentication and email providers process information needed to deliver requested features and protect the service. Optional chart, model and purchase providers process the information described above. Information may be processed outside your country, in regions used by those providers.',
      'PipWise does not display third-party advertisements in this version. No standalone advertising, crash-reporting or behavioral analytics SDK is configured in the app source. Portfolio analytics are calculated from your local practice wallet.',
    ],
  },
  {
    title: 'Security and retention',
    paragraphs: [
      'Configured network services use HTTPS. Private account data is accessed through authenticated server routes; server credentials are not included in the app. No system can guarantee absolute security. Protect your account credentials and device access, and remember that local practice records are not encrypted by PipWise.',
      `Account information is kept while your account is active. We complete account-data deletion within 30 days of a deletion request. Confirmed self-service requests normally delete active database records immediately. Feedback is kept for ${legalDetails.retentionPeriod}, or removed earlier when you delete your account. Account-linked review usage is removed with the account.`,
      'Provider backups and security logs may persist until the provider’s retention schedule expires; account deletion does not immediately erase every infrastructure backup. Providers may retain limited operational records for security, fraud prevention or legal obligations under their published policies. Contact us for questions about a specific deletion request.',
      'The authentication email-delivery ledger stores delivery event and status metadata, not the recipient or verification code. Records older than 30 days are pruned when later email-delivery processing runs. Email, hosting, authentication and other providers may retain operational records under their own policies.',
    ],
  },
  {
    title: 'Intended audience',
    paragraphs: ['PipWise is intended for adult learners aged 18 and over. It is not directed to children. If you believe a child has supplied personal information, contact us so we can investigate and remove it as appropriate.'],
  },
  {
    title: 'Your choices, deletion and privacy requests',
    paragraphs: [
      'Request account and associated data deletion in Settings → Delete account, or use the self-service form at /delete-account in a browser without reinstalling PipWise. Sign in to verify ownership, review the account shown and confirm permanent deletion. The request removes the Neon authentication account and sessions, profile details, private feedback and account-linked chart-review usage from the active database.',
      'Deletion is permanent. It does not remove files you independently shared with another service or cancel an app-store subscription. Local-only records on other devices remain under your control as explained above. Aggregate counts that do not identify an account and provider security or backup records follow the retention terms above.',
      `Contact ${legalDetails.contactEmail} to ask about access, correction, deletion or other applicable privacy rights, or if you cannot regain access to your account. If you believe a child supplied personal information, contact us so we can investigate and remove it as appropriate. We publish policy changes on this page and update the effective date when needed.`,
    ],
  },
];
