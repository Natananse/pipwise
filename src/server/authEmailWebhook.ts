// Server entry point only. Never import this delivery handler in app screens.
import { base64url, compactVerify, createRemoteJWKSet, decodeProtectedHeader } from 'jose';
import { renderPipWiseOtpEmail, type PipWiseOtpType } from './authEmailTemplate';

export type AuthEmailMessage = { to: string; subject: string; text: string; html: string; messageId: string };
export type AuthEmailVerification = { rawBody: Uint8Array; headers: Headers; jwksUrl: string };
export type AuthEmailWebhookDependencies = {
  env?: Record<string, string | undefined>;
  now?: () => number;
  verify?: (input: AuthEmailVerification) => Promise<void>;
  claim: (eventId: string) => Promise<'claimed' | 'sent' | 'busy'>;
  complete: (eventId: string) => Promise<void>;
  release: (eventId: string) => Promise<void>;
  send: (message: AuthEmailMessage) => Promise<void>;
};

const maxBodyBytes = 32 * 1024;
const maxSignatureAge = 5 * 60 * 1000;
const maxFutureSkew = 30 * 1000;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const nonempty = (value: unknown): value is string => typeof value === 'string' && !!value.trim();

class WebhookError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}
const unauthorized = () => new WebhookError(401, 'INVALID_WEBHOOK');
const unavailable = () => new WebhookError(503, 'EMAIL_UNAVAILABLE');
const invalid = () => new WebhookError(400, 'INVALID_EMAIL_EVENT');

function authKeysConfiguration(env: Record<string, string | undefined>) {
  try {
    const base = new URL(env.NEON_AUTH_BASE_URL || '');
    const expectedKeys = `${base.pathname.replace(/\/$/, '')}/.well-known/jwks.json`;
    const keys = new URL(env.NEON_AUTH_JWKS_URL || `${base.origin}${expectedKeys}`);
    if (base.protocol !== 'https:' || keys.protocol !== 'https:' || base.username || base.password || base.search || base.hash
      || keys.username || keys.password || keys.search || keys.hash || base.origin !== keys.origin || keys.pathname !== expectedKeys
      || !base.hostname.includes('.') || base.hostname.endsWith('.localhost') || /^\d+(?:\.\d+){3}$/.test(base.hostname)
      || /^(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(base.hostname)) throw new Error();
    return { jwksUrl: keys.href };
  } catch { throw new WebhookError(503, 'EMAIL_NOT_CONFIGURED'); }
}

function configuration(env: Record<string, string | undefined>) {
  if (env.PIPWISE_AUTH_EMAIL_ENABLED !== '1' || !nonempty(env.PIPWISE_SMTP_USER) || !nonempty(env.PIPWISE_SMTP_APP_PASSWORD))
    throw new WebhookError(503, 'EMAIL_NOT_CONFIGURED');
  return authKeysConfiguration(env);
}

function signedHeaders(headers: Headers, now: number) {
  const signature = headers.get('x-neon-signature');
  const kid = headers.get('x-neon-signature-kid');
  const timestamp = headers.get('x-neon-timestamp');
  const eventId = headers.get('x-neon-event-id');
  if (!signature || signature.length > 4096 || !/^[A-Za-z0-9_-]+\.\.[A-Za-z0-9_-]+$/.test(signature)
    || !kid || !/^[A-Za-z0-9._-]{1,200}$/.test(kid) || !timestamp || !/^[0-9]{13}$/.test(timestamp)
    || !eventId || !uuid.test(eventId) || headers.get('x-neon-event-type') !== 'send.otp'
    || !/^[123]$/.test(headers.get('x-neon-delivery-attempt') || '')) throw unauthorized();
  const sentAt = Number(timestamp);
  if (!Number.isSafeInteger(sentAt) || sentAt < now - maxSignatureAge || sentAt > now + maxFutureSkew) throw unauthorized();
  return { eventId, timestamp };
}

async function readRawBody(request: Request): Promise<Uint8Array> {
  const declaredLength = request.headers.get('content-length');
  if (declaredLength !== null && (!/^[0-9]+$/.test(declaredLength) || Number(declaredLength) > maxBodyBytes))
    throw new WebhookError(413, 'EMAIL_EVENT_TOO_LARGE');
  const reader = request.body?.getReader();
  if (!reader) throw invalid();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBodyBytes) {
        await reader.cancel().catch(() => undefined);
        throw new WebhookError(413, 'EMAIL_EVENT_TOO_LARGE');
      }
      chunks.push(part.value);
    }
  } catch (error) {
    if (error instanceof WebhookError) throw error;
    throw invalid();
  } finally { reader.releaseLock(); }
  const raw = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { raw.set(chunk, offset); offset += chunk.byteLength; }
  return raw;
}

function createVerifier() {
  let keys: { url: string; resolve: ReturnType<typeof createRemoteJWKSet> } | null = null;
  return async ({ rawBody, headers, jwksUrl }: AuthEmailVerification) => {
    const detached = headers.get('x-neon-signature')!;
    const kid = headers.get('x-neon-signature-kid')!;
    const timestamp = headers.get('x-neon-timestamp')!;
    const [protectedPart, , signaturePart] = detached.split('.');
    try {
      const header = decodeProtectedHeader(detached);
      if (header.alg !== 'EdDSA' || (header.kid !== undefined && header.kid !== kid) || header.b64 === false) throw unauthorized();
    } catch { throw unauthorized(); }
    if (!keys || keys.url !== jwksUrl) keys = {
      url: jwksUrl,
      resolve: createRemoteJWKSet(new URL(jwksUrl), { timeoutDuration: 2500, cooldownDuration: 30000, cacheMaxAge: 10 * 60 * 1000 }),
    };
    // Neon signs base64url(timestamp + '.' + base64url(the exact raw bytes)).
    // The original body must never be parsed or reserialized before this step.
    const signingPayload = base64url.encode(`${timestamp}.${base64url.encode(rawBody)}`);
    try {
      await compactVerify(`${protectedPart}.${signingPayload}.${signaturePart}`, async (header, token) => {
        let key;
        try { key = await keys!.resolve({ ...header, kid }, token); }
        catch (error) {
          if (record(error) && error.code === 'ERR_JWKS_NO_MATCHING_KEY') throw unauthorized();
          throw unavailable();
        }
        if (key.algorithm.name !== 'Ed25519') throw unauthorized();
        return key;
      }, { algorithms: ['EdDSA'] });
    } catch (error) {
      if (error instanceof WebhookError) throw error;
      throw unauthorized();
    }
  };
}

// A route may create a handler per delivery to scope its ledger owner. Keep
// only the public-key resolver shared so cache/cooldown survive those handlers.
const defaultVerifier = createVerifier();

/** The trusted app host authenticates a webhook before invoking the mail relay. */
export async function verifyNeonAuthEmailEnvelope(rawBody: Uint8Array, headers: Headers, env: Record<string, string | undefined> = process.env) {
  signedHeaders(headers, Date.now());
  await defaultVerifier({ rawBody, headers, jwksUrl: authKeysConfiguration(env).jwksUrl });
}

function eventDetails(raw: Uint8Array, eventId: string, now: number) {
  let value: unknown;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)); }
  catch { throw invalid(); }
  if (!record(value) || value.event_type !== 'send.otp' || value.event_id !== eventId || !record(value.user) || !record(value.event_data)) throw invalid();
  const { email } = value.user;
  const { otp_code: code, otp_type: type, delivery_preference: channel, expires_at: expiry } = value.event_data;
  if (typeof email !== 'string' || email.length > 254 || !/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+$/i.test(email)
    || email.slice(0, email.indexOf('@')).length > 64 || typeof code !== 'string' || !/^[0-9]{6}$/.test(code)
    || !['sign-in', 'email-verification', 'forget-password'].includes(type as string) || (channel !== undefined && channel !== 'email')
    || typeof expiry !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(expiry)
    || !Number.isFinite(Date.parse(expiry)) || Date.parse(expiry) <= now) throw invalid();
  return { email, code, type: type as PipWiseOtpType };
}

function response(status: number, body: unknown) {
  return Response.json(body, { status, headers: {
    'Cache-Control': 'no-store', ...(status === 503 ? { 'Retry-After': '1' } : {}), ...(status === 405 ? { Allow: 'POST' } : {}),
  } });
}

/** Verify first; only claimed, signed email OTP events can reach the sender. */
export function createAuthEmailWebhook(dependencies: AuthEmailWebhookDependencies) {
  const verify = dependencies.verify || defaultVerifier;
  return async (request: Request): Promise<Response> => {
    let claimedEvent: string | null = null;
    let acceptedBySender = false;
    try {
      if (request.method !== 'POST') throw new WebhookError(405, 'METHOD_NOT_ALLOWED');
      const config = configuration(dependencies.env || process.env);
      if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) throw new WebhookError(415, 'JSON_REQUIRED');
      const now = (dependencies.now || Date.now)();
      const { eventId } = signedHeaders(request.headers, now);
      const rawBody = await readRawBody(request);
      try { await verify({ rawBody, headers: request.headers, jwksUrl: config.jwksUrl }); }
      catch (error) { if (error instanceof WebhookError) throw error; throw unauthorized(); }
      const event = eventDetails(rawBody, eventId, now);
      const state = await dependencies.claim(eventId);
      if (state === 'sent') return response(200, { delivered: true });
      if (state !== 'claimed') throw unavailable();
      claimedEvent = eventId;
      const rendered = renderPipWiseOtpEmail({ code: event.code, type: event.type });
      await dependencies.send({ to: event.email, ...rendered, messageId: `<pipwise.auth.${eventId}@gmail.com>` });
      acceptedBySender = true;
      await dependencies.complete(eventId);
      return response(200, { delivered: true });
    } catch (error) {
      // An accepted message with a failed ledger commit stays claimed. Releasing
      // it here would knowingly permit another send on an immediate retry.
      if (claimedEvent && !acceptedBySender) await dependencies.release(claimedEvent).catch(() => undefined);
      const failure = error instanceof WebhookError ? error : unavailable();
      return response(failure.status, { error: { code: failure.code, message: 'The account email could not be delivered.' } });
    }
  };
}
