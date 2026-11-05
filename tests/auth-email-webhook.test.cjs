const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jose = require('jose');

const now = Date.parse('2026-11-05T12:00:00.000Z');
const eventId = '12345678-1234-4234-8234-123456789abc';
const baseUrl = 'https://auth.example.test/neondb/auth';
const kid = 'branch-signing-key';
const env = {
  PIPWISE_AUTH_EMAIL_ENABLED: '1', PIPWISE_SMTP_USER: 'pipwise@example.test',
  PIPWISE_SMTP_APP_PASSWORD: 'synthetic-private-password', NEON_AUTH_BASE_URL: baseUrl,
};
const example = () => ({
  event_id: eventId, event_type: 'send.otp', timestamp: new Date(now).toISOString(),
  context: { endpoint_id: 'ep-example-1234', project_name: 'Untrusted display name' },
  user: { id: 'account-id', email: 'member@example.test', name: '<img src=x>' },
  event_data: { otp_code: '012345', otp_type: 'email-verification', expires_at: new Date(now + 600000).toISOString() },
});

function load(file, imports, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module, exports: module.exports, URL, Response, Uint8Array, TextDecoder, Date,
    console: new Proxy({}, { get() { return () => assert.fail('Webhook must not log codes, recipients, raw payloads, or provider errors'); } }),
    process: { get env() { assert.fail('Tests must supply explicit synthetic configuration'); } },
    fetch() { assert.fail('Webhook tests must not make network requests'); },
    require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; },
    ...globals,
  }, { filename: file });
  return module.exports;
}
const templates = load('src/server/authEmailTemplate.ts', {});

async function harness(options = {}) {
  const keys = await jose.generateKeyPair('EdDSA');
  const publicJwk = { ...await jose.exportJWK(keys.publicKey), kid };
  const localKeys = jose.createLocalJWKSet({ keys: [publicJwk] });
  const keyRequests = [], claims = [], completed = [], released = [], sent = [];
  const states = new Map();
  const { resolveKey = localKeys, ...overrides } = options;
  const imports = {
    jose: { ...jose, createRemoteJWKSet(url) { keyRequests.push(url.href); return resolveKey; } },
    './authEmailTemplate': templates,
  };
  const { createAuthEmailWebhook } = load('src/server/authEmailWebhook.ts', imports);
  const dependencies = {
    env: { ...env }, now: () => now,
    claim: async id => {
      claims.push(id);
      const state = states.get(id);
      if (state) return state;
      states.set(id, 'busy'); return 'claimed';
    },
    complete: async id => { completed.push(id); states.set(id, 'sent'); },
    release: async id => { released.push(id); states.delete(id); },
    send: async message => { sent.push(message); },
    ...overrides,
  };
  const handler = createAuthEmailWebhook(dependencies);
  async function signed(body = example(), overrides = {}) {
    const rawBody = typeof body === 'string' || body instanceof Uint8Array ? body : JSON.stringify(body);
    const bytes = typeof rawBody === 'string' ? new TextEncoder().encode(rawBody) : rawBody;
    const timestamp = overrides.timestamp ?? String(now);
    const signedPayload = new TextEncoder().encode(`${timestamp}.${jose.base64url.encode(bytes)}`);
    const protectedHeader = overrides.protectedHeader ?? { alg: 'EdDSA', kid, typ: 'JWS' };
    const compact = await new jose.CompactSign(signedPayload).setProtectedHeader(protectedHeader).sign(overrides.privateKey ?? keys.privateKey);
    const [header, , signature] = compact.split('.');
    const headers = {
      'content-type': 'application/json', 'x-neon-signature': `${header}..${signature}`,
      'x-neon-signature-kid': protectedHeader.kid ?? kid, 'x-neon-timestamp': timestamp,
      'x-neon-event-type': 'send.otp', 'x-neon-event-id': eventId, 'x-neon-delivery-attempt': '1',
      ...overrides.headers,
    };
    return new Request('https://app.example.test/api/auth-email', { method: 'POST', headers, body: rawBody });
  }
  return { handler, signed, keys, keyRequests, claims, completed, released, sent, states, dependencies, newHandler: () => createAuthEmailWebhook(dependencies) };
}

test('real Ed25519 detached JWS delivers all three supported PipWise OTP purposes from exact verified bytes', async () => {
  const h = await harness();
  for (const [index, type] of ['sign-in', 'email-verification', 'forget-password'].entries()) {
    const body = example();
    body.event_id = `12345678-1234-4234-8234-123456789ab${index}`;
    body.event_data.otp_type = type;
    body.to = 'attacker@example.test'; body.subject = 'Untrusted'; body.html = '<script>bad</script>';
    const response = await h.handler(await h.signed(JSON.stringify(body, null, 2), { headers: { 'x-neon-event-id': body.event_id } }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { delivered: true });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const message = h.sent[index];
    assert.equal(message.to, 'member@example.test');
    assert.deepEqual(Object.keys(message).sort(), ['html', 'messageId', 'subject', 'text', 'to']);
    assert.match(message.text, /012345/);
    assert.match(message.subject, /PipWise/);
    assert.doesNotMatch(message.html, /Neon|Untrusted display name|<img|<script/);
    assert.equal(message.messageId, `<pipwise.auth.${body.event_id}@gmail.com>`);
  }
  assert.equal(h.completed.length, 3);
  assert.deepEqual(h.released, []);
  assert.deepEqual(h.keyRequests, [`${baseUrl}/.well-known/jwks.json`], 'cache the trusted branch resolver');
});

test('body and timestamp tampering or another branch key never reach claim or delivery', async () => {
  const h = await harness();
  const other = await jose.generateKeyPair('EdDSA');
  const wrongKey = await h.signed(example(), { privateKey: other.privateKey });
  assert.equal((await h.handler(wrongKey)).status, 401);
  for (const mutate of [
    request => { request.headers.set('x-neon-timestamp', String(now + 1)); return request; },
    request => { request.headers.set('x-neon-signature-kid', 'other-branch-key'); return request; },
    async request => new Request(request.url, { method: 'POST', headers: request.headers, body: (await request.text()).replace('012345', '999999') }),
    async request => new Request(request.url, { method: 'POST', headers: request.headers, body: `${await request.text()} ` }),
  ]) assert.equal((await h.handler(await mutate(await h.signed()))).status, 401);
  assert.deepEqual(h.claims, []);
  assert.deepEqual(h.sent, []);
});

test('unsupported algorithms and header key URLs cannot redirect verification to a caller-selected key service', async () => {
  const h = await harness();
  const forged = await h.signed(example(), {
    protectedHeader: { alg: 'HS256', kid, jku: 'https://attacker.example.test/jwks' },
    privateKey: new Uint8Array(32),
  });
  assert.equal((await h.handler(forged)).status, 401);
  assert.deepEqual(h.keyRequests, []);
  const actual = await h.signed(example(), { protectedHeader: { alg: 'EdDSA', kid, jku: 'https://attacker.example.test/jwks' } });
  assert.equal((await h.handler(actual)).status, 200);
  assert.deepEqual(h.keyRequests, [`${baseUrl}/.well-known/jwks.json`]);
});

test('per-request handler instances reuse the trusted public-key resolver without sharing delivery claims', async () => {
  const h = await harness();
  assert.equal((await h.handler(await h.signed())).status, 200);
  assert.equal((await h.newHandler()(await h.signed())).status, 200);
  assert.deepEqual(h.keyRequests, [`${baseUrl}/.well-known/jwks.json`]);
  assert.equal(h.sent.length, 1);
});

test('unknown signing keys fail authentication while temporary key service failures remain retryable', async () => {
  const h = await harness();
  const unknown = await h.signed(example(), { protectedHeader: { alg: 'EdDSA', kid: 'unknown-key' } });
  assert.equal((await h.handler(unknown)).status, 401);
  assert.deepEqual(h.claims, []);
  const offline = await harness({ resolveKey: async () => { throw new Error('private key server diagnostic'); } });
  const response = await offline.handler(await offline.signed());
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private key server/);
  assert.deepEqual(offline.claims, []);
  assert.deepEqual(offline.sent, []);
});

test('missing, malformed, stale and future signature headers fail before claiming events', async () => {
  const h = await harness();
  for (const name of ['x-neon-signature', 'x-neon-signature-kid', 'x-neon-timestamp', 'x-neon-event-type', 'x-neon-event-id', 'x-neon-delivery-attempt']) {
    const request = await h.signed(); request.headers.delete(name);
    assert.equal((await h.handler(request)).status, 401, name);
  }
  for (const timestamp of [String(now - 300001), String(now + 30001), String(now / 1000), 'NaN', `${now}junk`]) {
    const request = await h.signed(); request.headers.set('x-neon-timestamp', timestamp);
    assert.equal((await h.handler(request)).status, 401);
  }
  for (const [name, value] of [['x-neon-event-type', 'send.magic_link'], ['x-neon-event-id', 'bad-id'], ['x-neon-delivery-attempt', '4'], ['x-neon-signature', 'a.b.c']]) {
    const request = await h.signed(); request.headers.set(name, value);
    assert.equal((await h.handler(request)).status, 401);
  }
  assert.deepEqual(h.claims, []);
  assert.deepEqual(h.keyRequests, []);
});

test('configuration fails closed and never fetches caller or cross-origin JWKS URLs', async () => {
  for (const override of [
    { PIPWISE_AUTH_EMAIL_ENABLED: '0' }, { PIPWISE_SMTP_USER: '' }, { PIPWISE_SMTP_APP_PASSWORD: '' },
    { NEON_AUTH_BASE_URL: '' }, { NEON_AUTH_BASE_URL: 'http://auth.example.test/auth' },
    { NEON_AUTH_BASE_URL: 'https://user:synthetic-private-password@auth.example.test/auth' },
    { NEON_AUTH_BASE_URL: 'https://127.0.0.1/auth' },
    { NEON_AUTH_JWKS_URL: 'https://attacker.example.test/keys' },
    { NEON_AUTH_JWKS_URL: 'https://auth.example.test/other-branch/.well-known/jwks.json' },
    { NEON_AUTH_JWKS_URL: `${baseUrl}/.well-known/jwks.json?secret=synthetic-private-password` },
  ]) {
    const h = await harness({ env: { ...env, ...override } });
    const response = await h.handler(await h.signed());
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('retry-after'), '1');
    assert.doesNotMatch(await response.text(), /synthetic-private-password|member@example|012345|https:/);
    assert.deepEqual(h.keyRequests, []);
    assert.deepEqual(h.claims, []);
    assert.deepEqual(h.sent, []);
  }
});

test('signed payload validation rejects SMS, unsupported purposes, expired OTPs and header/body event mismatches', async () => {
  const h = await harness();
  for (const change of [
    body => { body.event_type = 'send.magic_link'; },
    body => { body.event_id = 'abcdefab-1234-4234-8234-123456789abc'; },
    body => { body.event_data.otp_type = 'constructor'; },
    body => { body.event_data.otp_code = '012345\n'; },
    body => { body.event_data.otp_code = 123456; },
    body => { body.event_data.delivery_preference = 'sms'; },
    body => { body.event_data.expires_at = new Date(now).toISOString(); },
    body => { body.event_data.expires_at = 'tomorrow'; },
    body => { body.user.email = 'member@example.test\r\nBcc:attacker@example.test'; },
    body => { body.user.email = 'Someone <member@example.test>'; },
    body => { body.user.email = 'member@example.test,attacker@example.test'; },
    body => { delete body.user; },
    body => { delete body.event_data; },
  ]) {
    const body = example(); change(body);
    assert.equal((await h.handler(await h.signed(body))).status, 400);
  }
  assert.equal((await h.handler(await h.signed('{malformed'))).status, 400);
  assert.deepEqual(h.claims, []);
  assert.deepEqual(h.sent, []);
});

test('verification happens before JSON parsing or delivery, with untrusted exceptions sanitized', async () => {
  const h = await harness({ verify: async () => { throw new Error('private provider response member@example.test 012345'); } });
  const response = await h.handler(await h.signed('{not-json'));
  assert.equal(response.status, 401, 'invalid signature must be rejected before parsing the malformed body');
  assert.doesNotMatch(await response.text(), /private provider|member@example|012345/);
  assert.deepEqual(h.claims, []);
  assert.deepEqual(h.sent, []);
});

test('raw bodies are bounded by bytes including chunked requests, before verification or parsing', async () => {
  let verifies = 0;
  const h = await harness({ verify: async () => { verifies++; } });
  const tooLarge = await h.signed('x'.repeat(32769));
  assert.equal((await h.handler(tooLarge)).status, 413);
  const declared = await h.signed(); declared.headers.set('content-length', '32769');
  assert.equal((await h.handler(declared)).status, 413);
  const multibyte = await h.signed('አ'.repeat(11000));
  assert.equal((await h.handler(multibyte)).status, 413);
  let canceled = false;
  const signed = await h.signed();
  const chunked = new Request(signed.url, {
    method: 'POST', headers: signed.headers, duplex: 'half',
    body: new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(17000)); }, cancel() { canceled = true; } }),
  });
  assert.equal((await h.handler(chunked)).status, 413);
  assert.equal(canceled, true);
  assert.equal(verifies, 0);
  assert.deepEqual(h.claims, []);
});

test('duplicate completed deliveries acknowledge success and in-progress deliveries request a retry without sending', async () => {
  const h = await harness();
  const first = await h.handler(await h.signed());
  assert.equal(first.status, 200);
  assert.equal((await h.handler(await h.signed())).status, 200);
  assert.equal(h.sent.length, 1);
  assert.equal(h.completed.length, 1);
  h.states.set(eventId, 'busy');
  const busy = await h.handler(await h.signed());
  assert.equal(busy.status, 503);
  assert.equal(busy.headers.get('retry-after'), '1');
  assert.equal(h.sent.length, 1);
  assert.deepEqual(h.released, []);
});

test('sender failure releases only its claim, returns retryable failure, and never leaks message or credentials', async () => {
  let fail = true;
  const h = await harness({ send: async () => { if (fail) throw new Error('SMTP synthetic-private-password member@example.test 012345'); } });
  const response = await h.handler(await h.signed());
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /SMTP|synthetic-private-password|member@example|012345/);
  assert.deepEqual(h.released, [eventId]);
  assert.deepEqual(h.completed, []);
  fail = false;
  assert.equal((await h.handler(await h.signed())).status, 200);
  assert.deepEqual(h.completed, [eventId]);
});

test('a successful send with failed ledger completion stays claimed so an immediate retry cannot knowingly resend it', async () => {
  const h = await harness({ complete: async () => { throw new Error('private database response'); } });
  const response = await h.handler(await h.signed());
  assert.equal(response.status, 503);
  assert.deepEqual(h.released, []);
  assert.equal(h.sent.length, 1);
  assert.equal((await h.handler(await h.signed())).status, 503);
  assert.equal(h.sent.length, 1);
  assert.doesNotMatch(await response.text(), /private database/);
});

test('HTTP method and content type validation cannot acknowledge delivery', async () => {
  const h = await harness();
  const get = await h.handler(new Request('https://app.example.test/api/auth-email'));
  assert.equal(get.status, 405);
  assert.equal(get.headers.get('allow'), 'POST');
  const request = await h.signed(); request.headers.set('content-type', 'text/plain');
  assert.equal((await h.handler(request)).status, 415);
  assert.deepEqual(h.claims, []);
  assert.deepEqual(h.sent, []);
});
