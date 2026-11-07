// Server-only: this module must never be imported by a screen or native client.
import { runtimeDatabase } from './database';
import { authenticate, HttpError } from './authenticate';

type Dependencies = {
  authenticate?: typeof authenticate;
  remove?: (userId: string, sessionToken: string) => Promise<boolean>;
  env?: Record<string, string | undefined>;
};

const maximumBodyBytes = 512;
const reauthenticate = () => new HttpError(401, 'REAUTHENTICATION_REQUIRED', 'Sign in again, then confirm account deletion within 10 minutes.');

/**
 * The restricted database helper checks a fresh matching session, locks the
 * identity and removes its associated data atomically. Runtime has no direct
 * access to managed Auth tables. The helper owns its internal locking order.
 */
export async function deleteAccountData(userId: string, sessionToken: string, env: Record<string, string | undefined> = process.env): Promise<boolean> {
  const connection = env.APP_RUNTIME_DATABASE_URL;
  if (!connection) throw new HttpError(503, 'DATABASE_NOT_CONFIGURED', 'Account deletion is temporarily unavailable.');
  const sql = runtimeDatabase(env);
  // The VOLATILE helper takes the identity lock in a separate internal command
  // before its deletion snapshot. Keep READ COMMITTED explicit for that contract.
  const results = await sql.transaction(transaction => [
    transaction`SELECT pipwise_app.delete_account(${userId}::uuid, ${sessionToken}) AS deleted`,
  ], { isolationLevel: 'ReadCommitted' });
  return results[0]?.[0]?.deleted === true;
}

function allowedOrigin(request: Request, env: Record<string, string | undefined>): string | null {
  const origin = request.headers.get('origin');
  if (!origin) return null; // Native requests use explicit credentials, never cookies.
  const allowed = new Set([new URL(request.url).origin]);
  for (const value of [env.PIPWISE_APP_ORIGIN, env.EXPO_PUBLIC_APP_API_URL, env.EXPO_PUBLIC_NATIVE_AUTH_RETURN_URL]) {
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash) allowed.add(url.origin);
    } catch { /* An invalid server setting never expands the origin allowlist. */ }
  }
  if (!allowed.has(origin)) throw new HttpError(403, 'REQUEST_ORIGIN_REJECTED', 'Open the trusted PipWise application to request deletion.');
  return origin;
}

function response(body: unknown, status: number, origin: string | null = null) {
  const headers = {
    'Cache-Control': 'private, no-store',
    Vary: 'Origin, Authorization',
    ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Pipwise-Session',
    ...(status === 401 ? { 'WWW-Authenticate': 'Bearer' } : {}),
    ...(status === 405 ? { Allow: 'POST, OPTIONS' } : {}),
  };
  return status === 204 ? new Response(null, { status, headers }) : Response.json(body, { status, headers });
}

async function confirmed(request: Request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) {
    throw new HttpError(415, 'JSON_REQUIRED', 'Send the account deletion confirmation as JSON.');
  }
  const tooLarge = () => new HttpError(413, 'REQUEST_TOO_LARGE', 'The account deletion confirmation is too large.');
  const invalid = () => new HttpError(400, 'DELETION_CONFIRMATION_REQUIRED', 'Confirm permanent deletion by sending confirmation: DELETE.');
  if (Number(request.headers.get('content-length')) > maximumBodyBytes) throw tooLarge();
  const reader = request.body?.getReader();
  if (!reader) throw invalid();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let text = '';
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maximumBodyBytes) throw tooLarge();
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).length !== 1 || !('confirmation' in value) || value.confirmation !== 'DELETE') throw invalid();
  } catch (error) {
    await reader.cancel().catch(() => {});
    if (error instanceof HttpError) throw error;
    throw invalid();
  } finally { reader.releaseLock(); }
}

/** Self-service only: subject and recent session proof determine the account. */
export async function accountDeletionApi(request: Request, dependencies: Dependencies = {}) {
  let origin: string | null = null;
  try {
    const env = dependencies.env || process.env;
    origin = allowedOrigin(request, env);
    if (request.method === 'OPTIONS') return response(null, 204, origin);
    if (request.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Use POST to delete your account.');
    const user = await (dependencies.authenticate || authenticate)(request);
    const sessionToken = request.headers.get('x-pipwise-session');
    if (!sessionToken || sessionToken.length > 2048 || /\s|[\u0000-\u001f\u007f]/u.test(sessionToken)) throw reauthenticate();
    await confirmed(request);
    const removed = dependencies.remove
      ? await dependencies.remove(user.id, sessionToken)
      : await deleteAccountData(user.id, sessionToken, env);
    if (!removed) throw reauthenticate();
    return response({ deleted: true }, 200, origin);
  } catch (error) {
    return error instanceof HttpError
      ? response({ error: { code: error.code, message: error.message } }, error.status, origin)
      : response({ error: { code: 'ACCOUNT_DELETION_UNAVAILABLE', message: 'Your account could not be deleted. Please try again. Your local data has not been cleared.' } }, 503, origin);
  }
}
