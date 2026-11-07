const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const flush = () => new Promise(resolve => setImmediate(resolve));
const member = { user: { id: 'member-a' } };
const input = { symbol: 'EUR/USD', timeframe: '1h', strategy: 'SMC', context: '' };
const upload = { name: 'chart.png', mimeType: 'image/png', base64: 'aW1hZ2U=', uri: 'data:image/png;base64,aW1hZ2U=', size: 5 };
const review = { review: 'Observable chart details and conditional scenarios.', source: 'Google Gemini', generatedAt: 1800000000000 };

function harness({ platform = 'android', env = { EXPO_PUBLIC_NATIVE_AUTH_RETURN_URL: 'https://pipwise.example/native-auth.html' } } = {}) {
  let session = member;
  let token = async () => 'signed-token';
  let reply = async () => ({ ok: true, json: async () => review });
  const listeners = new Set(), requests = [];
  const imports = {
    'react-native': { Platform: { OS: platform } },
    './startupTasks': { withStartupTimeout: value => value },
    './neonAuth': {
      getAuthSession: async () => session,
      getBackendCredentials: async expected => {
        assert.equal(expected, session.user.id);
        return { accountId: expected, token: await token(), sessionToken: 'SESSION_PROOF_PLACEHOLDER' };
      },
      subscribeAuth: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/chartCoachClient.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module, exports: module.exports, URL, AbortController, process: { env },
    fetch: async (url, options) => { requests.push({ url, options }); return reply(url, options); },
    require: name => { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; },
  });
  return { api: module.exports, requests, listeners, setToken: value => { token = value; }, setReply: value => { reply = value; },
    emit(next) { session = next; listeners.forEach(listener => listener(next)); },
    call: (signal = new AbortController().signal) => module.exports.reviewChartPhoto(input, upload, signal, member.user.id, 'gemini'),
  };
}

test('photo requests bind to the initiating account and send consent and only image/prompt fields', async () => {
  for (const platform of ['android', 'web']) {
    const h = harness({ platform });
    assert.deepEqual(JSON.parse(JSON.stringify(await h.call())), review);
    assert.equal(h.requests[0].url, platform === 'web' ? '/api/chart-coach' : 'https://pipwise.example/api/chart-coach');
    assert.equal(h.requests[0].options.headers.Authorization, 'Bearer signed-token');
    assert.equal(h.requests[0].options.headers['X-Pipwise-Session'], 'SESSION_PROOF_PLACEHOLDER');
    assert.deepEqual(JSON.parse(h.requests[0].options.body), { input, image: { mimeType: upload.mimeType, base64: upload.base64 }, consent: true, provider: 'gemini' });
    assert.equal(h.listeners.size, 0);
  }
});

test('switching accounts or canceling during token acquisition never uploads the previous image', async () => {
  for (const action of ['switch', 'sign-out', 'cancel']) {
    const h = harness();
    const controller = new AbortController();
    let release;
    h.setToken(() => new Promise(resolve => { release = resolve; }));
    const pending = h.call(controller.signal);
    await flush();
    if (action === 'cancel') controller.abort();
    else h.emit(action === 'sign-out' ? null : { user: { id: 'member-b' } });
    release('another-session-token');
    await assert.rejects(pending, action === 'cancel' ? /canceled/ : /account changed/);
    assert.equal(h.requests.length, 0);
    assert.equal(h.listeners.size, 0);
  }
});

test('an already changed account and an already canceled request fail before any upload', async () => {
  const changed = harness(); changed.emit({ user: { id: 'member-b' } });
  await assert.rejects(changed.call(), /account changed/);
  assert.equal(changed.requests.length, 0);
  const canceled = harness(); const controller = new AbortController(); controller.abort();
  await assert.rejects(canceled.call(controller.signal), /canceled/);
  assert.equal(canceled.requests.length, 0);
  assert.equal(canceled.listeners.size, 0);
});

test('account changes abort in-flight uploads and suppress late responses even if fetch ignores abort', async () => {
  const h = harness(); let release;
  h.setReply(() => new Promise(resolve => { release = resolve; }));
  const pending = h.call(); await flush();
  h.emit({ user: { id: 'member-b' } });
  assert.equal(h.requests[0].options.signal.aborted, true);
  release({ ok: true, json: async () => review });
  await assert.rejects(pending, /account changed/);
  assert.equal(h.listeners.size, 0);
});

test('same-account refreshes do not cancel a review and failures always release the auth subscription', async () => {
  const h = harness(); let release;
  h.setToken(() => new Promise(resolve => { release = resolve; }));
  const pending = h.call(); await flush(); h.emit({ user: { id: member.user.id } }); release('refreshed-token');
  await pending;
  assert.equal(h.requests[0].options.signal.aborted, false);
  h.setToken(async () => { throw new Error('Unavailable'); });
  await assert.rejects(h.call(), /Unavailable/);
  assert.equal(h.listeners.size, 0);
});

test('malformed, empty and oversized service responses cannot become status or a chart report', async () => {
  for (const value of [null, [], {}, { available: true, monthlyLimit: 0, message: 'Connected' }, { available: true, monthlyLimit: 51, message: 'Connected' }]) {
    const h = harness(); h.setReply(async () => ({ ok: true, json: async () => value }));
    await assert.rejects(h.api.getCoachStatus(new AbortController().signal), /connection could not be checked/);
  }
  for (const value of [null, [], {}, { ...review, review: ' ' }, { ...review, review: 'x'.repeat(16001) }, { ...review, generatedAt: NaN }, { ...review, generatedAt: 0 }]) {
    const h = harness(); h.setReply(async () => ({ ok: true, json: async () => value }));
    await assert.rejects(h.call(), /incomplete review/);
    assert.equal(h.listeners.size, 0);
  }
});

test('provider status explicitly distinguishes owner-funded OpenAI from subscription-gated Gemini', async () => {
  for (const [provider, requiresSubscription] of [['openai', false], ['gemini', true]]) {
    const h = harness(); const status = { available: true, provider, requiresSubscription, monthlyLimit: 10, message: 'Connected' };
    h.setReply(async () => ({ ok: true, json: async () => status }));
    assert.deepEqual(JSON.parse(JSON.stringify(await h.api.getCoachStatus(new AbortController().signal))), status);
    h.setReply(async () => ({ ok: true, json: async () => ({ ...status, requiresSubscription: !requiresSubscription }) }));
    await assert.rejects(h.api.getCoachStatus(new AbortController().signal), /connection could not be checked/);
  }
});
