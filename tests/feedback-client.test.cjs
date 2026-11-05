const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

const flush = () => new Promise(resolve => setImmediate(resolve));
const member = { user: { id: '12345678-1234-4234-8234-123456789abc' } };
const payload = {
  user_id: member.user.id, client_report_id: 'client-report-12345',
  rating: 4, category: 'bug', message: 'The lesson button was hard to tap.',
  app_version: '1.0.0', platform: 'android', language: 'en',
};

function upstreamSignal() {
  const listeners = new Set();
  const signal = {
    aborted: false,
    addEventListener(event, listener) { assert.equal(event, 'abort'); listeners.add(listener); },
    removeEventListener(event, listener) { assert.equal(event, 'abort'); listeners.delete(listener); },
  };
  return { signal, listeners, abort() { signal.aborted = true; listeners.forEach(listener => listener()); } };
}

function harness({ platform = 'android', env = { EXPO_PUBLIC_NATIVE_AUTH_RETURN_URL: 'https://pipwise.example/native-auth.html' } } = {}) {
  let session = member;
  let authRead = async () => session;
  let token = async () => 'signed-account-token';
  let reply = async () => ({ ok: true, status: 200, json: async () => ({ delivered: true }) });
  let now = 0;
  let timerId = 0;
  const timers = new Map(), listeners = new Set(), requests = [], authReads = [], tokenReads = [], deadlines = [];
  const imports = {
    'react-native': { Platform: { OS: platform } },
    './startupTasks': { withStartupTimeout: (value, _message, deadline) => { deadlines.push(deadline); return value; } },
    './neonAuth': {
      getAuthSession: options => { authReads.push(options); return authRead(); },
      getAuthToken: () => { tokenReads.push(true); return token(); },
      subscribeAuth: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/feedbackClient.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module, exports: module.exports, URL, AbortController, process: { env },
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    fetch: async (url, options) => { requests.push({ url, options }); return reply(url, options); },
    require(name) { assert.ok(name in imports, `Unexpected client import ${name}`); return imports[name]; },
  });
  return {
    api: module.exports, requests, listeners, timers, authReads, tokenReads, deadlines,
    setAuthRead: value => { authRead = value; }, setToken: value => { token = value; }, setReply: value => { reply = value; },
    emit(next) { session = next; listeners.forEach(listener => listener(next)); },
    advance(milliseconds) {
      now += milliseconds;
      for (const [id, timer] of timers) if (timer.at <= now) { timers.delete(id); timer.callback(); }
    },
    call: signal => module.exports.submitFeedback(payload, signal),
  };
}

test('same-account feedback uses the app API and requires an explicit delivery acknowledgement', async () => {
  for (const platform of ['android', 'web']) {
    const h = harness({ platform });
    const upstream = upstreamSignal();
    const result = await h.call(upstream.signal);
    assert.equal(result.error, null);
    assert.equal(h.requests[0].url, platform === 'web' ? '/api/feedback' : 'https://pipwise.example/api/feedback');
    assert.equal(h.requests[0].options.method, 'POST');
    assert.equal(h.requests[0].options.headers.Authorization, 'Bearer signed-account-token');
    assert.equal(h.requests[0].options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(h.requests[0].options.body), payload);
    assert.equal(h.authReads[0].timeout, 10000);
    assert.deepEqual(h.deadlines, [10000]);
    assert.equal(h.listeners.size, 0);
    assert.equal(h.timers.size, 0);
    assert.equal(upstream.listeners.size, 0);
  }
});

test('native feedback reads only public app origins, never private database or legacy Data API credentials', async () => {
  const env = {
    EXPO_PUBLIC_APP_API_URL: 'https://api.pipwise.example/service-path',
    EXPO_PUBLIC_NATIVE_AUTH_RETURN_URL: 'https://other.pipwise.example/native-auth.html',
  };
  for (const name of ['DATABASE_URL', 'DATABASE_URL_UNPOOLED', 'NEON_DATA_API_URL', 'EXPO_PUBLIC_NEON_DATA_API_URL']) {
    Object.defineProperty(env, name, { get() { throw new Error(`Client must not read ${name}`); } });
  }
  const h = harness({ env });
  assert.equal(h.api.feedbackConfigured, true);
  await h.call();
  assert.equal(h.requests[0].url, 'https://api.pipwise.example/api/feedback');
  assert.deepEqual(Object.keys(h.requests[0].options.headers).sort(), ['Accept', 'Authorization', 'Content-Type']);
  for (const url of [
    '', 'http://api.pipwise.example', 'https://user:private-password@api.pipwise.example',
    'https://api.pipwise.example?secret=private-token', 'https://api.pipwise.example#private-token', 'not-a-url',
  ]) {
    const invalid = harness({ env: { EXPO_PUBLIC_APP_API_URL: url } });
    assert.equal(invalid.api.feedbackConfigured, false);
    await assert.rejects(invalid.call(), error => /unavailable/.test(error.message) && !/private-password|private-token/.test(error.message));
    assert.equal(invalid.authReads.length, 0);
    assert.equal(invalid.requests.length, 0);
  }
  const web = harness({ platform: 'web', env: {} });
  assert.equal(web.api.feedbackConfigured, true);
  await web.call();
  assert.equal(web.requests[0].url, '/api/feedback');
});

test('a changed or missing account before token acquisition never sends the previous account review', async () => {
  for (const next of [null, { user: { id: 'different-account' } }]) {
    const h = harness(); h.emit(next);
    await assert.rejects(h.call(), /account changed/);
    assert.equal(h.tokenReads.length, 0);
    assert.equal(h.requests.length, 0);
    assert.equal(h.listeners.size, 0);
    assert.equal(h.timers.size, 0);
  }
  for (const next of [null, { user: { id: 'different-account' } }]) {
    const h = harness(); let release;
    h.setToken(() => new Promise(resolve => { release = resolve; }));
    const pending = h.call(); await flush();
    h.emit(next); release('new-account-token');
    await assert.rejects(pending, /account changed/);
    assert.equal(h.requests.length, 0);
    assert.equal(h.listeners.size, 0);
    assert.equal(h.timers.size, 0);
  }
});

test('sign-out aborts an in-flight request and suppresses a late success even if fetch ignores cancellation', async () => {
  const h = harness(); let release;
  const upstream = upstreamSignal();
  h.setReply(() => new Promise(resolve => { release = resolve; }));
  const pending = h.call(upstream.signal); await flush();
  h.emit(null);
  assert.equal(h.requests[0].options.signal.aborted, true);
  release({ ok: true, json: async () => ({ delivered: true }) });
  await assert.rejects(pending, /account changed/);
  assert.equal(h.listeners.size, 0);
  assert.equal(h.timers.size, 0);
  assert.equal(upstream.listeners.size, 0);
});

test('same-account session refreshes preserve a pending review', async () => {
  const h = harness(); let release;
  h.setToken(() => new Promise(resolve => { release = resolve; }));
  const pending = h.call(); await flush();
  h.emit({ user: { id: member.user.id, name: 'Updated name' } });
  release('refreshed-token');
  assert.equal((await pending).error, null);
  assert.equal(h.requests[0].options.signal.aborted, false);
  assert.equal(h.requests[0].options.headers.Authorization, 'Bearer refreshed-token');
});

test('a successful HTTP response without delivered:true never reports the review as sent', async () => {
  for (const body of [null, [], {}, { delivered: false }, { delivered: 'true' }, { delivered: 1 }]) {
    const h = harness();
    h.setReply(async () => ({ ok: true, json: async () => body }));
    await assert.rejects(h.call(), /did not confirm delivery/);
    assert.equal(h.listeners.size, 0);
    assert.equal(h.timers.size, 0);
  }
  const h = harness();
  h.setReply(async () => ({ ok: true, json: async () => { throw new Error('Not JSON'); } }));
  await assert.rejects(h.call(), /did not confirm delivery/);
});

test('initial abort, upstream cancellation, and delivery deadline stop success and release subscriptions', async () => {
  const initial = harness(), canceled = upstreamSignal(); canceled.abort();
  await assert.rejects(initial.call(canceled.signal), /canceled/);
  assert.equal(initial.authReads.length, 0);
  assert.equal(initial.tokenReads.length, 0);
  assert.equal(initial.requests.length, 0);
  assert.equal(initial.listeners.size, 0);
  assert.equal(initial.timers.size, 0);
  assert.equal(canceled.listeners.size, 0);

  for (const cause of ['upstream', 'deadline']) {
    const h = harness(), upstream = upstreamSignal(); let release;
    h.setReply(() => new Promise(resolve => { release = resolve; }));
    const pending = h.call(upstream.signal); await flush();
    if (cause === 'upstream') upstream.abort();
    else { h.advance(11999); assert.equal(h.requests[0].options.signal.aborted, false); h.advance(1); }
    assert.equal(h.requests[0].options.signal.aborted, true);
    release({ ok: true, json: async () => ({ delivered: true }) });
    await assert.rejects(pending, /canceled or timed out/);
    assert.equal(h.listeners.size, 0);
    assert.equal(h.timers.size, 0);
    assert.equal(upstream.listeners.size, 0);
  }
});

test('bounded service failures remain retryable and do not become a delivery acknowledgement', async () => {
  const h = harness();
  h.setReply(async () => ({ ok: false, status: 503, json: async () => ({ error: { code: 'UNAVAILABLE', message: 'Please try again.' } }) }));
  const result = await h.call();
  assert.equal(result.error.code, 'UNAVAILABLE');
  assert.equal(result.error.message, 'Please try again.');
  h.setReply(async () => ({ ok: false, status: 503, json: async () => ({ error: { code: 503, message: 'x'.repeat(501) } }) }));
  assert.equal((await h.call()).error.message, 'Review delivery failed.');
  assert.equal(h.listeners.size, 0);
  assert.equal(h.timers.size, 0);
});
