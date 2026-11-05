const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const secret = 'synthetic-private-relay-secret-0123456789-abcdefghijklmnopqrstuvwxyz';
const destination = 'https://pipwise-mail.functions.neon.tech/webhook';
const env = {
  PIPWISE_AUTH_EMAIL_ENABLED: '1', PIPWISE_AUTH_EMAIL_RELAY_SECRET: secret,
  PIPWISE_AUTH_EMAIL_RELAY_URL: destination, NEON_AUTH_BASE_URL: 'https://auth.example.test/auth',
};
const signed = {
  'x-neon-signature': 'signed-header..signed-by-neon', 'x-neon-signature-kid': 'branch-key',
  'x-neon-timestamp': '1793870400000', 'x-neon-event-id': '12345678-1234-4234-8234-123456789abc',
  'x-neon-event-type': 'send.otp', 'x-neon-delivery-attempt': '1',
};
const raw = new TextEncoder().encode('{\n  "event_type": "send.otp", "note": "እንኳን", "code": "012345"\n}\n');
const makeRequest = ({ body = raw, headers = {}, method = 'POST' } = {}) => new Request('https://app.example.test/api/auth-email', {
  method, headers: { 'content-type': 'application/json', ...signed, ...headers },
  ...(method === 'GET' || method === 'HEAD' ? {} : { body }),
});

function load(defaultVerify = async () => assert.fail('Expected an injected verifier')) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/server/authEmailProxy.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module, exports: module.exports, URL, Response, Headers, Uint8Array, AbortSignal,
    process: { get env() { assert.fail('Proxy tests must use explicit synthetic configuration'); } },
    console: new Proxy({}, { get() { return () => assert.fail('Proxy must not log OTPs, recipients or private relay diagnostics'); } }),
    fetch() { assert.fail('Proxy tests must not make real network requests'); },
    require(name) { assert.equal(name, './authEmailWebhook'); return { verifyNeonAuthEmailEnvelope: defaultVerify }; },
  });
  return module.exports;
}

function harness(overrides = {}) {
  const verifies = [], relays = [];
  const { createAuthEmailProxy } = load(overrides.defaultVerify);
  const dependencies = {
    env: { ...env },
    verify: async (...args) => { verifies.push(args); },
    fetch: async (url, options) => { relays.push({ url: String(url), options }); return Response.json({ private: 'must not be reflected' }); },
    ...overrides,
  };
  return { handler: createAuthEmailProxy(dependencies), verifies, relays, dependencies };
}

test('disabled or incomplete private configuration cannot verify or contact a relay', async () => {
  for (const patch of [
    { PIPWISE_AUTH_EMAIL_ENABLED: undefined }, { PIPWISE_AUTH_EMAIL_ENABLED: '0' }, { PIPWISE_AUTH_EMAIL_ENABLED: 'true' },
    { PIPWISE_AUTH_EMAIL_RELAY_SECRET: undefined }, { PIPWISE_AUTH_EMAIL_RELAY_SECRET: '' },
    { PIPWISE_AUTH_EMAIL_RELAY_SECRET: 'x'.repeat(42) }, { PIPWISE_AUTH_EMAIL_RELAY_SECRET: 'x'.repeat(513) },
    { PIPWISE_AUTH_EMAIL_RELAY_SECRET: `${secret}\n` }, { PIPWISE_AUTH_EMAIL_RELAY_URL: undefined },
  ]) {
    const h = harness({ env: { ...env, ...patch } });
    const response = await h.handler(makeRequest());
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('retry-after'), '1');
    assert.doesNotMatch(await response.text(), /synthetic-private|012345|neon\.tech/);
    assert.equal(h.verifies.length, 0);
    assert.equal(h.relays.length, 0);
  }
});

test('malformed, credentialed or untrusted relay destinations fail closed before verification', async () => {
  for (const url of [
    '', 'not-a-url', 'http://pipwise-mail.functions.neon.tech/webhook',
    'https://attacker.example.test/webhook', 'https://neon.tech.attacker.test/webhook',
    'https://attackerneon.tech/webhook', 'https://127.0.0.1/webhook',
    'https://operator:private-password@pipwise-mail.functions.neon.tech/webhook',
    `${destination}?token=private-password`, `${destination}#private-password`,
    'https://pipwise-mail.functions.neon.tech/', 'https://pipwise-mail.functions.neon.tech/webhook/other',
  ]) {
    const h = harness({ env: { ...env, PIPWISE_AUTH_EMAIL_RELAY_URL: url } });
    const response = await h.handler(makeRequest());
    assert.equal(response.status, 503, url);
    assert.doesNotMatch(await response.text(), /private-password|attacker|neon\.tech/);
    assert.equal(h.verifies.length, 0);
    assert.equal(h.relays.length, 0);
  }
});

test('the exact signed bytes are relayed only after asynchronous verification completes', async () => {
  let finishVerification;
  const events = [];
  const h = harness({ verify: async (bytes, headers, config) => {
    assert.deepEqual(Array.from(bytes), Array.from(raw));
    assert.equal(headers.get('x-neon-signature'), signed['x-neon-signature']);
    assert.equal(config.NEON_AUTH_BASE_URL, env.NEON_AUTH_BASE_URL);
    events.push('verification-started');
    await new Promise(resolve => { finishVerification = resolve; });
    events.push('verification-finished');
  }, fetch: async (url, options) => {
    events.push('relay');
    assert.equal(String(url), destination);
    assert.deepEqual(Array.from(options.body), Array.from(raw), 'never parse or reserialize a signed envelope');
    return new Response('private relay diagnostic', { status: 200 });
  } });
  const pending = h.handler(makeRequest());
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(events, ['verification-started']);
  finishVerification();
  const response = await pending;
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { delivered: true });
  assert.deepEqual(events, ['verification-started', 'verification-finished', 'relay']);
});

test('only six renamed Neon headers and the configured origin secret cross the HTTPS hop', async () => {
  const h = harness();
  const response = await h.handler(makeRequest({ headers: {
    authorization: 'Bearer caller-token', origin: 'https://attacker.example.test', cookie: 'private-session',
    'x-pipwise-origin': 'caller-origin-secret', 'x-pipwise-neon-signature': 'caller-signature',
    'x-pipwise-neon-event-type': 'caller-type', 'x-neon-extra': 'caller-extra',
  } }));
  assert.equal(response.status, 200);
  const forwarded = Object.fromEntries(h.relays[0].options.headers.entries());
  assert.deepEqual(forwarded, {
    'content-type': 'application/json', 'x-pipwise-origin': secret,
    ...Object.fromEntries(Object.entries(signed).map(([name, value]) => [name.replace('x-neon-', 'x-pipwise-neon-'), value])),
  });
  assert.equal(Object.keys(forwarded).length, 8);
  assert.equal(h.relays[0].options.method, 'POST');
  assert.equal(h.relays[0].options.redirect, 'manual');
  assert.ok(h.relays[0].options.signal instanceof AbortSignal);
});

test('invalid signatures never reach the relay and key-service failures remain retryable', async () => {
  for (const failure of [new Error('private branch diagnostic 012345 member@example.test'), { status: 401 }, { status: 503 }]) {
    const h = harness({ verify: async () => { throw failure; } });
    const response = await h.handler(makeRequest());
    assert.equal(response.status, failure.status === 503 ? 503 : 401);
    assert.doesNotMatch(await response.text(), /private branch|012345|member@example/);
    assert.equal(h.relays.length, 0);
  }
});

test('missing or excessive signed headers cannot be forwarded even with a permissive injected verifier', async () => {
  for (const name of Object.keys(signed)) {
    for (const value of [null, 'x'.repeat(4097)]) {
      const h = harness();
      const request = makeRequest();
      if (value === null) request.headers.delete(name);
      else request.headers.set(name, value);
      assert.equal((await h.handler(request)).status, 401, name);
      assert.equal(h.relays.length, 0);
    }
  }
});

test('method, content type and declared-size errors cannot verify or relay', async () => {
  const h = harness();
  assert.equal((await h.handler(makeRequest({ method: 'GET' }))).status, 405);
  assert.equal((await h.handler(makeRequest({ headers: { 'content-type': 'text/plain' } }))).status, 415);
  for (const length of ['32769', '-1', 'NaN', '1x']) {
    assert.equal((await h.handler(makeRequest({ headers: { 'content-length': length } }))).status, 400);
  }
  assert.equal((await h.handler(makeRequest({ body: new Uint8Array(32769) }))).status, 400);
  assert.equal((await h.handler(makeRequest({ body: 'አ'.repeat(11000) }))).status, 400, 'size is bounded by bytes');
  assert.equal(h.verifies.length, 0);
  assert.equal(h.relays.length, 0);
});

test('oversized chunked requests cancel without waiting for a stalled source cancel', async () => {
  const h = harness();
  let cancelled = false;
  const body = new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(17000)); },
    cancel() { cancelled = true; return new Promise(() => {}); },
  });
  const request = new Request('https://app.example.test/api/auth-email', {
    method: 'POST', headers: { 'content-type': 'application/json', ...signed }, body, duplex: 'half',
  });
  assert.equal((await h.handler(request)).status, 400);
  assert.equal(cancelled, true);
  assert.equal(h.verifies.length, 0);
  assert.equal(h.relays.length, 0);
});

test('redirects are not followed or acknowledged and their locations or response bodies never leak', async () => {
  for (const status of [301, 302, 303, 307, 308]) {
    let calls = 0;
    const h = harness({ fetch: async (_url, options) => {
      calls++;
      assert.equal(options.redirect, 'manual');
      return new Response('private provider detail 012345', { status, headers: { location: 'https://attacker.example.test/private-token' } });
    } });
    const response = await h.handler(makeRequest());
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('location'), null);
    assert.doesNotMatch(await response.text(), /provider|012345|attacker|private-token/);
    assert.equal(calls, 1);
  }
});

test('relay outages, rate limits and network exceptions return only generic retryable failures', async () => {
  for (const status of [408, 429, 500, 502, 503]) {
    const h = harness({ fetch: async () => new Response('smtp://private-user:private-password@private-host 012345', { status }) });
    const response = await h.handler(makeRequest());
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('retry-after'), '1');
    assert.doesNotMatch(await response.text(), /private-user|private-password|private-host|012345/);
  }
  const h = harness({ fetch: async () => { throw new Error(`private network error ${secret} member@example.test 012345`); } });
  const response = await h.handler(makeRequest());
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private network|synthetic-private|member@example|012345/);
});

test('default envelope verification is used when a verifier is not injected', async () => {
  const verified = [];
  const h = harness({ verify: undefined, defaultVerify: async (...args) => { verified.push(args); } });
  assert.equal((await h.handler(makeRequest())).status, 200);
  assert.equal(verified.length, 1);
  assert.deepEqual(Array.from(verified[0][0]), Array.from(raw));
  assert.equal(h.relays.length, 1);
});
