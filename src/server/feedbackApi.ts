import { neon } from '@neondatabase/serverless';
import { feedbackAlreadyDelivered, feedbackPayload, type FeedbackCategory, type FeedbackPayload } from '../lib/feedback';
import { authenticate, HttpError } from './authenticate';

type Dependencies = {
  authenticate?: typeof authenticate;
  save?: (payload: FeedbackPayload) => Promise<void>;
};
const maximumBodyBytes = 16 * 1024;
const fields = ['user_id', 'client_report_id', 'rating', 'category', 'message', 'app_version', 'platform', 'language'];
const invalidFeedback = () => new HttpError(400, 'INVALID_FEEDBACK', 'Enter a valid rating, category and review.');

async function save(payload: FeedbackPayload): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new HttpError(503, 'DATABASE_NOT_CONFIGURED', 'Feedback is temporarily unavailable.');
  const sql = neon(url);
  // An authenticated server owns this insert. No review data is returned to clients.
  await sql`
    insert into public.beta_feedback
      (user_id, client_report_id, rating, category, message, app_version, platform, language)
    values (${payload.user_id}::uuid, ${payload.client_report_id}, ${payload.rating},
      ${payload.category}, ${payload.message}, ${payload.app_version}, ${payload.platform}, ${payload.language})
  `;
}

function response(body: unknown, status = 200) {
  return Response.json(body, { status, headers: {
    'Cache-Control': 'private, no-store', Vary: 'Authorization',
    ...(status === 401 ? { 'WWW-Authenticate': 'Bearer' } : {}),
    ...(status === 405 ? { Allow: 'POST' } : {}),
  } });
}

async function readBody(request: Request): Promise<string> {
  const tooLarge = () => new HttpError(413, 'REQUEST_TOO_LARGE', 'Keep your review within 2,000 characters.');
  if (Number(request.headers.get('content-length')) > maximumBodyBytes) throw tooLarge();
  const reader = request.body?.getReader();
  if (!reader) throw invalidFeedback();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let length = 0;
  let text = '';
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > maximumBodyBytes) throw tooLarge();
      text += decoder.decode(part.value, { stream: true });
    }
    return text + decoder.decode();
  } catch (error) {
    await reader.cancel().catch(() => {});
    if (error instanceof HttpError) throw error;
    throw invalidFeedback();
  } finally { reader.releaseLock(); }
}

function normalizeFeedback(value: unknown, userId: string): FeedbackPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidFeedback();
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some(key => !fields.includes(key))
    || typeof body.rating !== 'number'
    || fields.filter(key => key !== 'rating').some(key => typeof body[key] !== 'string')) throw invalidFeedback();
  if (body.user_id !== userId) {
    throw new HttpError(403, 'ACCOUNT_CHANGED', 'Your account changed. Reopen feedback and try again.');
  }
  const message = body.message as string;
  const appVersion = body.app_version as string;
  const platform = body.platform as string;
  const language = body.language as string;
  if (appVersion.length > 80 || platform.length > 20 || language.length > 10
    || [message, appVersion, platform, language].some(text => text.includes('\u0000'))) throw invalidFeedback();
  try {
    return feedbackPayload({ rating: body.rating as number, category: body.category as FeedbackCategory, message },
      userId, body.client_report_id as string, { appVersion, platform, language });
  } catch { throw invalidFeedback(); }
}

function duplicateReport(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const failure = error as { code?: string; constraint?: string; message?: string };
  if (failure.code !== '23505') return false;
  return failure.constraint === 'beta_feedback_user_report_key'
    || (failure.constraint === undefined && feedbackAlreadyDelivered(failure));
}

/** Feedback is private and insert-only; the verified JWT determines ownership. */
export async function feedbackApi(request: Request, dependencies: Dependencies = {}) {
  try {
    const user = await (dependencies.authenticate || authenticate)(request);
    if (request.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Use POST to send feedback.');
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) {
      throw new HttpError(415, 'JSON_REQUIRED', 'Send feedback as JSON.');
    }
    const text = await readBody(request);
    let body: unknown;
    try { body = JSON.parse(text); }
    catch { throw invalidFeedback(); }
    const payload = normalizeFeedback(body, user.id);
    try { await (dependencies.save || save)(payload); }
    catch (error) { if (!duplicateReport(error)) throw error; }
    return response({ delivered: true });
  } catch (error) {
    return error instanceof HttpError ? response({ error: { code: error.code, message: error.message } }, error.status)
      : response({ error: { code: 'FEEDBACK_UNAVAILABLE', message: 'Your review could not be delivered. Please try again.' } }, 503);
  }
}
