/// <reference types="node" />
// Optional server-only relay. The app continues using its existing London Auth
// and delivery ledger; a relay project's injected service credentials are ignored.
import { createHash, timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { createAuthEmailDelivery } from '../server/authEmailDelivery';
import { createGmailTransport } from '../server/authEmailTransport';
import { createAuthEmailWebhook } from '../server/authEmailWebhook';

function emailEnv(): Record<string, string | undefined> {
  return {
    PIPWISE_AUTH_EMAIL_ENABLED: process.env.PIPWISE_AUTH_EMAIL_ENABLED,
    PIPWISE_SMTP_USER: process.env.PIPWISE_SMTP_USER,
    PIPWISE_SMTP_APP_PASSWORD: process.env.PIPWISE_SMTP_APP_PASSWORD,
    NEON_AUTH_BASE_URL: process.env.PIPWISE_ORIGIN_AUTH_BASE_URL,
    NEON_AUTH_JWKS_URL: process.env.PIPWISE_ORIGIN_AUTH_JWKS_URL,
  };
}

function unavailable() {
  return Response.json({ error: {
    code: 'EMAIL_UNAVAILABLE', message: 'The account email could not be delivered.',
  } }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '1' } });
}

function trustedOrigin(request: Request): 'trusted' | 'unauthorized' | 'unconfigured' {
  const expected = process.env.PIPWISE_AUTH_EMAIL_RELAY_SECRET;
  if (!expected || !/^[\x21-\x7e]{43,512}$/.test(expected)) return 'unconfigured';
  const supplied = request.headers.get('x-pipwise-origin');
  if (!supplied || !/^[\x21-\x7e]{1,512}$/.test(supplied)) return 'unauthorized';
  return timingSafeEqual(createHash('sha256').update(supplied).digest(), createHash('sha256').update(expected).digest())
    ? 'trusted' : 'unauthorized';
}

function originalWebhook(request: Request): Request {
  // Functions strips client X-Neon-* headers. Only the authenticated app-server
  // hop may forward them under this separate namespace; body bytes stay intact.
  const headers = new Headers();
  for (const name of ['content-type', 'content-length']) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  for (const suffix of ['signature', 'signature-kid', 'timestamp', 'event-id', 'event-type', 'delivery-attempt']) {
    const value = request.headers.get(`x-pipwise-neon-${suffix}`);
    if (value !== null) headers.set(`x-neon-${suffix}`, value);
  }
  return new Request(request, { headers });
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/webhook' || url.search) {
      return new Response('Not Found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } });
    }
    const origin = trustedOrigin(request);
    if (origin === 'unconfigured') return unavailable();
    if (origin !== 'trusted') {
      return new Response('Unauthorized', { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }
    try {
      const env = emailEnv();
      const databaseUrl = process.env.PIPWISE_AUTH_DATABASE_URL;
      if (env.PIPWISE_AUTH_EMAIL_ENABLED !== '1' || !databaseUrl || !env.NEON_AUTH_BASE_URL || !env.NEON_AUTH_JWKS_URL) {
        return unavailable();
      }
      // A fresh delivery owner for each request protects the ledger's lease.
      const delivery = createAuthEmailDelivery(neon(databaseUrl));
      const transport = createGmailTransport(env);
      return await createAuthEmailWebhook({ env, ...delivery, send: transport.send })(originalWebhook(request));
    } catch { return unavailable(); }
  },
};
