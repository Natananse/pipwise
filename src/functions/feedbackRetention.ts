/// <reference types="node" />
import { createHash, timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { parseTriggerDelivery } from '@neon/functions/triggers';
import { databaseConnectionString } from '../../scripts/database-config.mjs';
import { countExpiredFeedback, purgeExpiredFeedback } from '../server/feedbackRetention';

const triggerName = 'pipwise-feedback-retention';
const maximumBodyBytes = 64 * 1024;
const validSecret = (value: string | null | undefined): value is string =>
  typeof value === 'string' && /^[\x21-\x7e]{43,512}$/.test(value);

class RequestError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}

function response(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: {
    'Cache-Control': 'no-store',
    ...(status === 405 ? { Allow: 'POST' } : {}),
    ...(status === 503 ? { 'Retry-After': '60' } : {}),
  } });
}

async function readBody(request: Request): Promise<unknown> {
  const declaredLength = request.headers.get('content-length');
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maximumBodyBytes)) {
    throw new RequestError(413, 'REQUEST_TOO_LARGE');
  }
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError(400, 'INVALID_BODY');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0;
  let text = '';
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maximumBodyBytes) {
        void reader.cancel().catch(() => {});
        throw new RequestError(413, 'REQUEST_TOO_LARGE');
      }
      text += decoder.decode(part.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError(400, 'INVALID_BODY');
  } finally { reader.releaseLock(); }
}

/** Only Neon's native edge may supply the scheduled route's X-Neon-* proof. */
export default {
  async fetch(request: Request): Promise<Response> {
    let mode: 'dry-run' | 'execute' | undefined;
    let invocationId: string | undefined;
    try {
      const url = new URL(request.url);
      if (!['/scheduled', '/dry-run'].includes(url.pathname) || url.search) {
        throw new RequestError(404, 'NOT_FOUND');
      }
      if (request.method !== 'POST') throw new RequestError(405, 'METHOD_NOT_ALLOWED');
      if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) {
        throw new RequestError(415, 'JSON_REQUIRED');
      }

      if (url.pathname === '/dry-run') {
        const expected = process.env.PIPWISE_RETENTION_CHECK_SECRET;
        if (!validSecret(expected)) throw new RequestError(503, 'RETENTION_UNAVAILABLE');
        const supplied = request.headers.get('x-pipwise-retention-check');
        if (!validSecret(supplied) || !timingSafeEqual(
          createHash('sha256').update(expected).digest(), createHash('sha256').update(supplied).digest(),
        )) throw new RequestError(401, 'UNAUTHORIZED');
        const body = await readBody(request);
        // This route has no execution option, even for an authenticated operator.
        if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 0) {
          throw new RequestError(400, 'INVALID_BODY');
        }
        mode = 'dry-run';
      } else {
        // The edge strips externally supplied X-Neon-* headers. Check before
        // reading a body; the official parser then checks its envelope and ID.
        if (!request.headers.get('x-neon-trigger-invocation-id')?.trim()) {
          throw new RequestError(401, 'UNAUTHORIZED');
        }
        const parsed = parseTriggerDelivery({ headers: request.headers, body: await readBody(request) });
        if (!parsed.ok) throw new RequestError(parsed.error === 'invalid_body' ? 400 : 401, 'INVALID_TRIGGER');
        if (parsed.invocation.type !== 'schedule' || parsed.invocation.trigger.name !== triggerName) {
          throw new RequestError(401, 'INVALID_TRIGGER');
        }
        mode = 'execute';
        invocationId = parsed.invocation.invocationId;
      }

      // Never fall back to an injected connection or application/migration role.
      const sql = neon(databaseConnectionString(process.env, {
        variable: 'RETENTION_JOB_DATABASE_URL', role: 'retention_job',
      }));
      const result = mode === 'execute'
        ? { mode, removed: await purgeExpiredFeedback(sql) }
        : { mode, eligible: await countExpiredFeedback(sql) };
      console.info(JSON.stringify({ event: 'feedback-retention', ok: true, ...result, ...(invocationId ? { invocationId } : {}) }));
      return response(result);
    } catch (error) {
      if (error instanceof RequestError) return response({ error: { code: error.code } }, error.status);
      // Raw driver errors can contain credentials or data. Only fixed metadata
      // belongs in the response, trigger retry history and platform logs.
      console.error(JSON.stringify({ event: 'feedback-retention', ok: false, ...(mode ? { mode } : {}) }));
      return response({ error: { code: 'RETENTION_UNAVAILABLE' } }, 503);
    }
  },
};
