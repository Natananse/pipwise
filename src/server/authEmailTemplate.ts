// Server-only rendering. Delivery and sender configuration belong to the caller.
export type PipWiseOtpType = 'sign-in' | 'email-verification' | 'forget-password';
export type PipWiseOtpEmailInput = { code: string; type: PipWiseOtpType };
export type PipWiseOtpEmail = { subject: string; html: string; text: string };

const intents = {
  'sign-in': {
    subject: 'Your PipWise sign-in code',
    heading: 'Sign in to PipWise',
    label: 'ACCOUNT ACCESS',
    instruction: 'Use this code in PipWise to finish signing in.',
  },
  'email-verification': {
    subject: 'Verify your email for PipWise',
    heading: 'Verify your PipWise email',
    label: 'VERIFY YOUR EMAIL',
    instruction: 'Use this code in PipWise to verify your email address.',
  },
  'forget-password': {
    subject: 'Reset your PipWise password',
    heading: 'Reset your PipWise password',
    label: 'PASSWORD RESET',
    instruction: 'Use this code in PipWise to continue resetting your password.',
  },
} as const;

/** Only an exact six-digit code and a supported purpose can enter the HTML. */
export function renderPipWiseOtpEmail(input: PipWiseOtpEmailInput): PipWiseOtpEmail {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some(key => key !== 'code' && key !== 'type'))
    throw new Error('Provide only a verification code and email purpose.');
  const { code, type } = input;
  if (typeof code !== 'string' || code.length !== 6 || !/^[0-9]{6}$/.test(code))
    throw new Error('A six-digit verification code is required.');
  if (typeof type !== 'string' || !Object.hasOwn(intents, type))
    throw new Error('Unsupported verification email purpose.');
  const intent = intents[type];
  const expiry = 'This code expires. If it no longer works, request a new code in PipWise.';
  const privacy = 'Do not share this code. PipWise will never ask you to send it to someone else.';
  const unsolicited = 'If you did not request this, you can ignore this email.';
  const text = [
    'PipWise', '', intent.heading, intent.instruction, '',
    `Your PipWise code: ${code}`, '', expiry, privacy, '', unsolicited, '',
    'PipWise · Educational market practice',
  ].join('\n');
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${intent.subject}</title></head>
<body style="margin:0;padding:0;background-color:#F4F3EF;color:#0D1011;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${intent.instruction} Keep your code private.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#F4F3EF;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background-color:#FFFFFF;border:1px solid #E1E6DE;border-radius:20px;">
        <tr><td style="padding:28px 28px 24px;background-color:#0D1011;border-radius:20px 20px 0 0;">
          <p style="margin:0;font-size:28px;line-height:36px;font-weight:700;color:#C8F169;">PipWise</p>
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 12px;font-size:11px;line-height:18px;font-weight:700;letter-spacing:1px;color:#5C615F;">${intent.label}</p>
          <h1 style="margin:0 0 16px;font-size:25px;line-height:33px;font-weight:700;color:#0D1011;">${intent.heading}</h1>
          <p style="margin:0 0 24px;font-size:16px;line-height:25px;color:#0D1011;">${intent.instruction}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#C8F169;border-radius:12px;">
            <tr><td align="center" style="padding:20px 12px;">
              <p style="margin:0 0 8px;font-size:12px;line-height:18px;color:#0D1011;">Your PipWise code</p>
              <p style="margin:0;font-family:Consolas,Monaco,monospace;font-size:32px;line-height:42px;font-weight:700;letter-spacing:6px;color:#0D1011;">${code}</p>
            </td></tr>
          </table>
          <p style="margin:24px 0 12px;font-size:14px;line-height:22px;color:#5C615F;">${expiry}</p>
          <p style="margin:0 0 20px;font-size:14px;line-height:22px;color:#0D1011;">${privacy}</p>
          <p style="margin:0;font-size:13px;line-height:21px;color:#5C615F;">${unsolicited}</p>
        </td></tr>
        <tr><td style="padding:20px 28px;border-top:1px solid #E1E6DE;">
          <p style="margin:0;font-size:12px;line-height:20px;color:#5C615F;">PipWise · Educational market practice</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return { subject: intent.subject, html, text };
}
