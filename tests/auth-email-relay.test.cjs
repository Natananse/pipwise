const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');
const jose = require('jose');

const originSecret = 'synthetic-relay-secret-0123456789-abcdefghijklmnop';
const eventId = '12345678-1234-4234-8234-123456789abc';
const kid = 'origin-branch-signing-key';
const suffixes = ['signature', 'signature-kid', 'timestamp', 'event-id', 'event-type', 'delivery-attempt'];
const fixtureEnv = {
  PIPWISE_AUTH_EMAIL_ENABLED: '1',
  PIPWISE_AUTH_EMAIL_RELAY_SECRET: originSecret,
  PIPWISE_SMTP_USER: 'fixture@gmail.com',
  PIPWISE_SMTP_APP_PASSWORD: 'synthetic-private-password',
  PIPWISE_ORIGIN_AUTH_BASE_URL: 'https://origin.example.test/auth',
  PIPWISE_ORIGIN_AUTH_JWKS_URL: 'https://origin.example.test/auth/.well-known/jwks.json',
  APP_RUNTIME_DATABASE_URL: 'postgresql://app_runtime:synthetic@origin.example.test/origin?sslmode=require',
  PIPWISE_AUTH_DATABASE_URL: 'postgresql://legacy_owner:must-not-be-used@origin.example.test/origin',
  // These injected relay-project values must never select the app's identity or ledger.
  DATABASE_URL: 'postgresql://relay:unused@relay.example.test/relay',
  DATABASE_URL_UNPOOLED: 'postgresql://relay_owner:must-not-be-used@relay.example.test/relay',
  NEON_AUTH_BASE_URL: 'https://relay.example.test/auth',
  NEON_AUTH_JWKS_URL: 'https://relay.example.test/auth/.well-known/jwks.json',
};

function load(file, imports, env = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module, exports: module.exports, Request, Response, Headers, URL, Date, Uint8Array, TextDecoder,
    setTimeout, clearTimeout, process: { env },
    console: new Proxy({}, { get() { return () => assert.fail('Relay must not log signatures, bodies, addresses, or secrets'); } }),
    fetch() { assert.fail('Relay tests must not make network requests'); },
    require(name) { assert.ok(Object.hasOwn(imports, name), `Unexpected import ${name}`); return imports[name]; },
  }, { filename: file });
  return module.exports;
}

async function harness(options = {}) {
  const env = options.env || { ...fixtureEnv, ...options.overrides };
  const keys = await jose.generateKeyPair('EdDSA');
  const localKeys = jose.createLocalJWKSet({ keys: [{ ...await jose.exportJWK(keys.publicKey), kid }] });
  const seen = { database: [], deliveryOwners: [], keyRequests: [], claims: [], completed: [], sent: [], transport: 0, verify: 0, comparisons: 0 };
  const states = new Map();
  const template = load('src/server/authEmailTemplate.ts', {});
  const webhook = load('src/server/authEmailWebhook.ts', {
    './authEmailTemplate': template,
    jose: { ...jose, createRemoteJWKSet(url) { seen.keyRequests.push(url.href); return localKeys; } },
  });
  const database = load('src/server/database.ts', {
    '@neondatabase/serverless': { neon(url) { seen.database.push(url); return {}; } },
  }, env);
  const adapter = load('src/functions/authEmail.ts', {
    'node:crypto': { ...crypto, timingSafeEqual(left, right) {
      seen.comparisons++;
      assert.equal(left.byteLength, 32);
      assert.equal(right.byteLength, 32);
      return crypto.timingSafeEqual(left, right);
    } },
    '../server/database': database,
    '../server/authEmailDelivery': { createAuthEmailDelivery() {
      const owner = {};
      seen.deliveryOwners.push(owner);
      return {
        async claim(id) { seen.claims.push({ id, owner }); return states.get(id) === 'sent' ? 'sent' : 'claimed'; },
        async complete(id) { seen.completed.push(id); states.set(id, 'sent'); },
        async release() {},
      };
    } },
    '../server/authEmailWebhook': webhook,
    '../server/authEmailTransport': { createGmailTransport() {
      seen.transport++;
      return {
        async verify() { seen.verify++; },
        async send(message) { seen.sent.push(message); },
      };
    } },
  }, env).default;
  async function signed({ headers = {}, body, timestamp = Date.now() } = {}) {
    const raw = body || new TextEncoder().encode(JSON.stringify({
      event_id: eventId, event_type: 'send.otp', timestamp: new Date(timestamp).toISOString(),
      user: { email: 'member@example.test' },
      event_data: { otp_code: '012345', otp_type: 'email-verification', expires_at: new Date(timestamp + 600000).toISOString() },
      extra: 'Unicode ✓ and whitespace are signed exactly',
    }, null, 2) + '\n');
    const payload = new TextEncoder().encode(`${timestamp}.${jose.base64url.encode(raw)}`);
    const compact = await new jose.CompactSign(payload).setProtectedHeader({ alg: 'EdDSA', kid }).sign(keys.privateKey);
    const [header, , signature] = compact.split('.');
    const forwarded = {
      'content-type': 'application/json; charset=utf-8', 'content-length': String(raw.byteLength),
      'x-pipwise-origin': originSecret,
      'x-pipwise-neon-signature': `${header}..${signature}`, 'x-pipwise-neon-signature-kid': kid,
      'x-pipwise-neon-timestamp': String(timestamp), 'x-pipwise-neon-event-id': eventId,
      'x-pipwise-neon-event-type': 'send.otp', 'x-pipwise-neon-delivery-attempt': '1',
      ...headers,
    };
    for (const name of Object.keys(forwarded)) if (forwarded[name] === null) delete forwarded[name];
    return new Request('https://relay.example.test/webhook', { method: 'POST', headers: forwarded, body: raw });
  }
  return { handler: adapter.fetch, signed, seen, env };
}

function noDeliveryWork(seen) {
  assert.equal(seen.database.length, 0);
  assert.equal(seen.deliveryOwners.length, 0);
  assert.equal(seen.transport, 0);
  assert.equal(seen.keyRequests.length, 0);
  assert.equal(seen.claims.length, 0);
  assert.equal(seen.sent.length, 0);
}

test('trusted relay preserves JSON Content-Type and exact signed Unicode/whitespace bytes', async () => {
  const h = await harness();
  const response = await h.handler(await h.signed());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { delivered: true });
  assert.deepEqual(h.seen.keyRequests, [fixtureEnv.PIPWISE_ORIGIN_AUTH_JWKS_URL]);
  assert.deepEqual(h.seen.database, [fixtureEnv.APP_RUNTIME_DATABASE_URL]);
  assert.equal(h.seen.sent.length, 1);
  assert.equal(h.seen.sent[0].to, 'member@example.test');
  assert.match(h.seen.sent[0].text, /012345/);
  assert.deepEqual(h.seen.completed, [eventId]);
  assert.equal(h.seen.comparisons, 1);
  assert.equal(h.seen.verify, 0);
});

test('missing or non-JSON Content-Type stays rejected instead of receiving a permissive fallback', async () => {
  const h = await harness();
  for (const type of [null, 'text/plain', 'application/x-www-form-urlencoded']) {
    const response = await h.handler(await h.signed({ headers: { 'content-type': type } }));
    assert.equal(response.status, 415);
    assert.equal((await response.json()).error.code, 'JSON_REQUIRED');
  }
  assert.equal(h.seen.keyRequests.length, 0);
  assert.equal(h.seen.claims.length, 0);
  assert.equal(h.seen.sent.length, 0);
});

test('relay retains Content-Length bounds before signature resolution or delivery claims', async () => {
  const h = await harness();
  const response = await h.handler(await h.signed({ headers: { 'content-length': String(32 * 1024 + 1) } }));
  assert.equal(response.status, 413);
  assert.equal(h.seen.keyRequests.length, 0);
  assert.equal(h.seen.claims.length, 0);
  assert.equal(h.seen.sent.length, 0);
});

test('one changed raw byte invalidates the real detached signature before claiming or sending', async () => {
  const h = await harness();
  const signed = await h.signed();
  const raw = new Uint8Array(await signed.arrayBuffer());
  const changed = new Request(signed.url, { method: 'POST', headers: signed.headers, body: new Uint8Array([...raw, 32]) });
  assert.equal((await h.handler(changed)).status, 401);
  assert.equal(h.seen.claims.length, 0);
  assert.equal(h.seen.sent.length, 0);
});

test('all six signature headers come only from the authenticated forwarding namespace', async () => {
  const h = await harness();
  const headers = Object.fromEntries(suffixes.map(suffix => [`x-neon-${suffix}`, 'untrusted-original-header']));
  assert.equal((await h.handler(await h.signed({ headers }))).status, 200);
  assert.equal(h.seen.sent.length, 1);
  for (const suffix of suffixes) {
    const request = await h.signed();
    request.headers.set(`x-neon-${suffix}`, request.headers.get(`x-pipwise-neon-${suffix}`));
    request.headers.delete(`x-pipwise-neon-${suffix}`);
    assert.equal((await h.handler(request)).status, 401, suffix);
  }
  assert.equal(h.seen.claims.length, 1);
  assert.equal(h.seen.sent.length, 1);
});

test('untrusted origin cannot read the body, other configuration, resolve keys, or initialize delivery', async () => {
  const env = new Proxy({}, { get(_target, name) {
    assert.equal(name, 'PIPWISE_AUTH_EMAIL_RELAY_SECRET', 'origin authorization must precede all delivery configuration');
    return originSecret;
  } });
  const h = await harness({ env });
  for (const supplied of [undefined, '', 'wrong', 'x'.repeat(originSecret.length), 'x'.repeat(513)]) {
    const request = new Request('https://relay.example.test/webhook', {
      method: 'POST', headers: supplied === undefined ? {} : { 'x-pipwise-origin': supplied }, body: 'must remain unread',
    });
    const response = await h.handler(request);
    assert.equal(response.status, 401);
    assert.equal(request.bodyUsed, false);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.ok(!(await response.text()).includes(originSecret));
  }
  noDeliveryWork(h.seen);
  assert.equal(h.seen.comparisons, 2, 'bounded nonempty credentials use constant-length hash comparisons');
});

test('missing or weak origin secrets and disabled/missing origin service configuration fail closed', async () => {
  for (const secret of [undefined, '', 'x'.repeat(42), 'x'.repeat(513), 'x'.repeat(43) + '\n']) {
    const h = await harness({ overrides: { PIPWISE_AUTH_EMAIL_RELAY_SECRET: secret } });
    const request = await h.signed();
    assert.equal((await h.handler(request)).status, 503);
    assert.equal(request.bodyUsed, false);
    noDeliveryWork(h.seen);
  }
  for (const overrides of [
    { PIPWISE_AUTH_EMAIL_ENABLED: '0' }, { PIPWISE_AUTH_EMAIL_ENABLED: undefined },
    { APP_RUNTIME_DATABASE_URL: undefined }, { PIPWISE_ORIGIN_AUTH_BASE_URL: undefined }, { PIPWISE_ORIGIN_AUTH_JWKS_URL: undefined },
  ]) {
    const h = await harness({ overrides });
    assert.equal((await h.handler(await h.signed())).status, 503);
    noDeliveryWork(h.seen);
  }
});

test('relay rejects owner or overridden runtime credentials without falling back to injected or legacy URLs', async () => {
  for (const APP_RUNTIME_DATABASE_URL of [
    undefined,
    fixtureEnv.DATABASE_URL,
    fixtureEnv.PIPWISE_AUTH_DATABASE_URL,
    fixtureEnv.APP_RUNTIME_DATABASE_URL + '&user=owner',
  ]) {
    const h = await harness({ overrides: { APP_RUNTIME_DATABASE_URL } });
    const response = await h.handler(await h.signed());
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'EMAIL_UNAVAILABLE');
    noDeliveryWork(h.seen);
  }
});

test('unknown paths, webhook query strings and unsupported methods do no delivery work', async () => {
  const env = new Proxy({}, { get() { assert.fail('Unrouted requests must not read private configuration'); } });
  const h = await harness({ env });
  for (const path of ['/', '/unknown', '/webhook/', '/webhook?recipient=caller%40example.test']) {
    assert.equal((await h.handler(new Request(`https://relay.example.test${path}`, { method: 'POST' }))).status, 404);
  }
  for (const method of ['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS']) {
    const response = await h.handler(new Request('https://relay.example.test/webhook', { method }));
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'POST');
  }
  noDeliveryWork(h.seen);
});

test('each request receives a fresh ledger owner and sent duplicates acknowledge without resending', async () => {
  const h = await harness();
  const request = await h.signed();
  assert.equal((await h.handler(request.clone())).status, 200);
  assert.equal((await h.handler(request.clone())).status, 200);
  assert.equal(h.seen.deliveryOwners.length, 2);
  assert.notEqual(h.seen.deliveryOwners[0], h.seen.deliveryOwners[1]);
  assert.equal(h.seen.claims.length, 2);
  assert.equal(h.seen.sent.length, 1);
  assert.deepEqual(h.seen.completed, [eventId]);
});

test('removed health probe returns 404 without reading private settings or touching SMTP', async () => {
  const env = new Proxy({}, { get() { assert.fail('Removed health probe must not read private configuration'); } });
  const h = await harness({ env });
  for (const path of ['/health', '/health?verify=1']) {
    for (const method of ['GET', 'POST']) {
      const response = await h.handler(new Request(`https://relay.example.test${path}`, {
        method, headers: { authorization: 'Bearer obsolete-private-probe-token' },
      }));
      assert.equal(response.status, 404);
      assert.equal(response.headers.get('cache-control'), 'no-store');
    }
  }
  noDeliveryWork(h.seen);
  assert.equal(h.seen.verify, 0);
});

test('optional policy declares only authmail and requires explicit gate and strong private configuration', () => {
  const database = load('src/server/database.ts', {
    '@neondatabase/serverless': { neon() { assert.fail('Loading the mail policy must not construct a database client'); } },
  });
  const imports = { '@neon/config/v1': { defineConfig: value => value }, './src/server/database': database };
  const env = { ...fixtureEnv, PIPWISE_AUTH_EMAIL_ENABLED: '0' };
  const policy = load('neon.email.ts', imports, env).default;
  assert.deepEqual(Object.keys(policy), ['functions']);
  assert.deepEqual(Object.keys(policy.functions), ['authmail']);
  const fn = policy.functions.authmail;
  assert.equal(fn.source, 'src/functions/authEmail.ts');
  assert.equal(fn.env.PIPWISE_AUTH_EMAIL_ENABLED, '0');
  assert.equal(Object.keys(fn.env).length, 9);
  assert.equal(Object.hasOwn(fn.env, 'PIPWISE_AUTH_EMAIL_HEALTH_TOKEN'), false);
  assert.equal(Object.keys(fn.env).some(key => key.startsWith('NEON_')), false);
  assert.equal(fn.env.APP_RUNTIME_DATABASE_URL, fixtureEnv.APP_RUNTIME_DATABASE_URL);
  assert.equal(fn.env.DATABASE_URL, fixtureEnv.APP_RUNTIME_DATABASE_URL);
  assert.equal(new URL(fn.env.DATABASE_URL_UNPOOLED).username, 'app_runtime');
  assert.equal(new URL(fn.env.DATABASE_URL_UNPOOLED).hostname, new URL(fixtureEnv.APP_RUNTIME_DATABASE_URL).hostname);
  assert.notEqual(fn.env.DATABASE_URL, fixtureEnv.DATABASE_URL);
  assert.equal(Object.hasOwn(fn.env, 'PIPWISE_AUTH_DATABASE_URL'), false);
  for (const name of Object.keys(fn.env).filter(name => name !== 'DATABASE_URL' && name !== 'DATABASE_URL_UNPOOLED')) {
    assert.throws(() => load('neon.email.ts', imports, { ...env, [name]: '' }), /Missing relay configuration/);
  }
  assert.throws(() => load('neon.email.ts', imports, { ...env, PIPWISE_AUTH_EMAIL_ENABLED: 'true' }), /explicitly 0 or 1/);
  assert.throws(() => load('neon.email.ts', imports, { ...env, PIPWISE_AUTH_EMAIL_RELAY_SECRET: 'short' }), /at least 43 printable characters/);
  assert.throws(() => load('neon.email.ts', imports, { ...env, APP_RUNTIME_DATABASE_URL: fixtureEnv.DATABASE_URL }), /app_runtime database role/);

  const pooled = 'postgresql://app_runtime:synthetic@ep-origin-pooler.example.test/neondb?sslmode=require';
  const overrides = load('neon.email.ts', imports, { ...env, APP_RUNTIME_DATABASE_URL: pooled }).default.functions.authmail.env;
  assert.equal(overrides.DATABASE_URL, pooled, 'Injected pooled credentials must use the scoped application login');
  const direct = new URL(overrides.DATABASE_URL_UNPOOLED);
  assert.equal(direct.username, 'app_runtime');
  assert.equal(direct.hostname, 'ep-origin.example.test');
  assert.equal(direct.pathname, '/neondb');
  assert.equal(direct.searchParams.get('sslmode'), 'require');
});
