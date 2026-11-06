const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}, env = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { module, exports: module.exports, Response, TextDecoder, process: { env }, require(name) {
    assert.ok(name in imports, `Unexpected import ${name}`);
    return imports[name];
  } });
  return module.exports;
}

const feedback = load('src/lib/feedback.ts');
const retention = load('src/server/feedbackRetention.ts');
class HttpError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }
const authentication = { HttpError, authenticate: async () => { throw new HttpError(401, 'UNAUTHORIZED', 'Sign in.'); } };
const imports = {
  '@neondatabase/serverless': { neon: () => { throw new Error('Unexpected external database access'); } },
  '../lib/feedback': feedback, './authenticate': authentication,
  './feedbackRetention': retention,
};
const { feedbackApi } = load('src/server/feedbackApi.ts', imports);
const owner = '12345678-1234-1234-1234-123456789012';
const other = '87654321-4321-4321-4321-210987654321';
const payload = {
  user_id: owner, client_report_id: 'feedback-test-report-123', rating: 4, category: 'bug',
  message: '  Hard to tap the lesson button.  ', app_version: '1.0.0', platform: 'android', language: 'am',
};
const post = (body = payload, headers = {}) => new Request('https://app.example.test/api/feedback', {
  method: 'POST', headers: { 'content-type': 'application/json', ...headers },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});
const authorized = { authenticate: async () => ({ id: owner }) };

test('verified feedback is normalized, privately scoped and returns no review content', async () => {
  const writes = [];
  const response = await feedbackApi(post(), { ...authorized, save: async value => { writes.push(value); } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { delivered: true });
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('vary'), 'Authorization');
  assert.deepEqual(JSON.parse(JSON.stringify(writes)), [{ ...payload, message: payload.message.trim() }]);
});

test('unsigned calls and stale account-switch payloads never reach storage', async () => {
  let writes = 0;
  const save = async () => { writes++; };
  const unsigned = await feedbackApi(post(), { save });
  assert.equal(unsigned.status, 401);
  assert.equal(unsigned.headers.get('www-authenticate'), 'Bearer');
  assert.equal(unsigned.headers.get('cache-control'), 'private, no-store');
  const stale = await feedbackApi(post({ ...payload, user_id: other }), { ...authorized, save });
  assert.equal(stale.status, 403);
  assert.equal((await stale.json()).error.code, 'ACCOUNT_CHANGED');
  assert.equal(writes, 0);
});

test('only POST JSON forms with supported, typed fields are accepted', async () => {
  let writes = 0;
  const dependencies = { ...authorized, save: async () => { writes++; } };
  for (const body of [
    null, [], 1, '{broken', {}, { ...payload, userId: owner }, { ...payload, token: 'private' },
    { ...payload, rating: '4' }, { ...payload, rating: 0 }, { ...payload, rating: 6 }, { ...payload, rating: 2.5 },
    { ...payload, message: 123 }, { ...payload, message: '' }, { ...payload, message: ' \n ' },
    { ...payload, message: 'x'.repeat(2001) }, { ...payload, message: 'bad\u0000text' },
    { ...payload, category: 'unexpected' }, { ...payload, category: null }, { ...payload, client_report_id: 'bad' },
    { ...payload, app_version: null }, { ...payload, app_version: 'x'.repeat(81) },
    { ...payload, platform: false }, { ...payload, platform: 'x'.repeat(21) },
    { ...payload, language: 'x'.repeat(11) }, { ...payload, language: 'en\u0000' },
  ]) {
    const response = await feedbackApi(post(body), dependencies);
    assert.equal(response.status, 400, JSON.stringify(body));
  }
  assert.equal((await feedbackApi(post(payload, { 'content-type': 'text/plain' }), dependencies)).status, 415);
  const method = await feedbackApi(new Request('https://app.example.test/api/feedback'), dependencies);
  assert.equal(method.status, 405);
  assert.equal(method.headers.get('allow'), 'POST');
  assert.equal(writes, 0);
});

test('bounded Unicode reviews are accepted without truncating content or metadata', async () => {
  const value = { ...payload, message: 'እ'.repeat(2000), app_version: 'x'.repeat(80), platform: 'x'.repeat(20), language: 'x'.repeat(10) };
  let saved;
  const response = await feedbackApi(post(value), { ...authorized, save: async report => { saved = report; } });
  assert.equal(response.status, 200);
  assert.equal(saved.message, value.message);
  assert.equal(saved.app_version, value.app_version);
  assert.equal(saved.language, value.language);
});

test('oversized declared and chunked requests stop before database work', async () => {
  let writes = 0;
  const dependencies = { ...authorized, save: async () => { writes++; } };
  assert.equal((await feedbackApi(post(payload, { 'content-length': '16385' }), dependencies)).status, 413);
  let cancelled = false;
  const body = new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(5000)); },
    cancel() { cancelled = true; },
  });
  const request = new Request('https://app.example.test/api/feedback', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body, duplex: 'half',
  });
  assert.equal((await feedbackApi(request, dependencies)).status, 413);
  assert.equal(cancelled, true);
  assert.equal(writes, 0);
});

test('invalid UTF-8 request bytes are rejected before storage', async () => {
  let writes = 0;
  const request = new Request('https://app.example.test/api/feedback', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: new Uint8Array([0xc3, 0x28]),
  });
  const response = await feedbackApi(request, { ...authorized, save: async () => { writes++; } });
  assert.equal(response.status, 400);
  assert.equal(writes, 0);
});

test('only duplicate delivery of the same owner/report key is idempotent success', async () => {
  for (const error of [
    { code: '23505', constraint: 'beta_feedback_user_report_key' },
    { code: '23505', message: 'duplicate key value violates unique constraint "beta_feedback_user_report_key"' },
  ]) {
    const response = await feedbackApi(post(), { ...authorized, save: async () => { throw error; } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { delivered: true });
  }
  for (const error of [
    { code: '23505', constraint: 'another_constraint' },
    { code: '23505', constraint: 'another_constraint', message: 'beta_feedback_user_report_key' },
    { code: '23505', message: 'another_constraint' },
    { code: '42501', constraint: 'beta_feedback_user_report_key' },
  ]) {
    assert.equal((await feedbackApi(post(), { ...authorized, save: async () => { throw error; } })).status, 503);
  }
});

test('database errors and missing server configuration expose no private details', async () => {
  const unavailable = await feedbackApi(post(), authorized);
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.json()).error.code, 'DATABASE_NOT_CONFIGURED');
  const failed = await feedbackApi(post(), { ...authorized, save: async () => { throw new Error('postgres://private-password@db.test/private'); } });
  assert.equal(failed.status, 503);
  const text = await failed.text();
  assert.ok(!text.includes('private-password'));
  assert.ok(!text.includes(owner));
  assert.equal(failed.headers.get('cache-control'), 'private, no-store');
});

test('default storage uses parameterized explicit columns and requests no review rows', async () => {
  const queries = [];
  const { feedbackApi: api } = load('src/server/feedbackApi.ts', {
    ...imports, '@neondatabase/serverless': { neon: url => {
      assert.equal(url, 'postgres://private-test-connection');
      return async (strings, ...values) => {
        const query = strings.join('?');
        queries.push({ sql: query, values });
        return /WITH expired AS/.test(query) ? [{ removed: 0 }] : [];
      };
    } },
  }, { DATABASE_URL: 'postgres://private-test-connection' });
  const message = "User text '); delete from public.beta_feedback; --";
  const response = await api(post({ ...payload, message }), authorized);
  assert.equal(response.status, 200);
  assert.equal(queries.length, 2);
  assert.match(queries[0].sql, /DELETE FROM public\.beta_feedback/);
  assert.match(queries[0].sql, /created_at <= now\(\) - interval '12 months'/);
  assert.match(queries[1].sql, /insert into public\.beta_feedback/i);
  assert.doesNotMatch(queries[1].sql, /returning|select \*/i);
  assert.ok(!queries[1].sql.includes(message));
  assert.deepEqual(Array.from(queries[1].values), [owner, payload.client_report_id, 4, 'bug', message, '1.0.0', 'android', 'am']);
});

test('Expo feedback route delegates the POST request without importing client configuration', async () => {
  let received;
  const { POST } = load('src/app/api/feedback+api.ts', { '../../server/feedbackApi': { feedbackApi: request => { received = request; return 'response'; } } });
  const request = post();
  assert.equal(POST(request), 'response');
  assert.equal(received, request);
});
