import { verifyNeonAuthEmailEnvelope } from './authEmailWebhook';

type Dependencies = {
  env?: Record<string, string | undefined>;
  verify?: (body: Uint8Array, headers: Headers, env: Record<string, string | undefined>) => Promise<void>;
  fetch?: typeof fetch;
};
const forwardedHeaders = ['signature', 'signature-kid', 'timestamp', 'event-id', 'event-type', 'delivery-attempt'];
const maximumBody = 32 * 1024;

function response(status: number) {
  return Response.json(status === 200 ? { delivered: true } : { error: {
    code: status === 401 ? 'INVALID_WEBHOOK' : 'EMAIL_UNAVAILABLE', message: 'The account email could not be delivered.',
  } }, { status, headers: { 'Cache-Control': 'no-store', ...(status === 503 ? { 'Retry-After': '1' } : {}) } });
}

async function rawBody(request: Request) {
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maximumBody)) throw new Error('Invalid body.');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Invalid body.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > maximumBody) { void reader.cancel().catch(() => {}); throw new Error('Invalid body.'); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(size);
  let position = 0;
  for (const chunk of chunks) { body.set(chunk, position); position += chunk.byteLength; }
  return body;
}

/** HTTPS-only hop. Gmail credentials stay solely in the Node mail function. */
export function createAuthEmailProxy(dependencies: Dependencies = {}) {
  return async (request: Request): Promise<Response> => {
    const env = dependencies.env || process.env;
    if (request.method !== 'POST') return response(405);
    const secret = env.PIPWISE_AUTH_EMAIL_RELAY_SECRET;
    if (env.PIPWISE_AUTH_EMAIL_ENABLED !== '1' || !secret || !/^[\x21-\x7e]{43,512}$/.test(secret)) return response(503);
    let destination: URL;
    try {
      destination = new URL(env.PIPWISE_AUTH_EMAIL_RELAY_URL || '');
      if (destination.protocol !== 'https:' || !destination.hostname.endsWith('.neon.tech') || destination.username || destination.password
        || destination.search || destination.hash || destination.pathname !== '/webhook') throw new Error();
    } catch { return response(503); }
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') || '')) return response(415);
    let body: Uint8Array;
    try { body = await rawBody(request); }
    catch { return response(400); }
    try { await (dependencies.verify || verifyNeonAuthEmailEnvelope)(body, request.headers, env); }
    catch (error) {
      return response(error && typeof error === 'object' && 'status' in error && error.status === 503 ? 503 : 401);
    }
    const headers = new Headers({ 'Content-Type': 'application/json', 'x-pipwise-origin': secret });
    for (const name of forwardedHeaders) {
      const value = request.headers.get(`x-neon-${name}`);
      if (!value || value.length > 4096) return response(401);
      headers.set(`x-pipwise-neon-${name}`, value);
    }
    try {
      const result = await (dependencies.fetch || fetch)(destination, {
        method: 'POST', headers, body: body as BodyInit, redirect: 'manual', signal: AbortSignal.timeout(9500),
      });
      // No redirect, provider response text, or operator diagnostics reaches Auth.
      return response(result.ok ? 200 : result.status >= 500 || [408, 429].includes(result.status) ? 503 : 400);
    } catch { return response(503); }
  };
}
