const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

class HttpError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }
const accountId = 'd4d1397c-5c09-446f-8179-a146a3c4d2d0';
const sessionToken = 'opaque-private-session-for-deletion';
const calls = [];
let databaseResult = [{ deleted: true }];
let databaseFailure;

const moduleUnderTest = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/server/accountDeletionApi.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, {
  module: moduleUnderTest, exports: moduleUnderTest.exports, Request, Response, URL, Set, TextDecoder,
  process: { env: {} },
  require(name) {
    if (name === './authenticate') return { HttpError, authenticate: async () => { throw new HttpError(401, 'UNAUTHORIZED', 'Sign in.'); } };
    assert.equal(name, './database');
    return { runtimeDatabase(env) {
      const connection = env.APP_RUNTIME_DATABASE_URL;
      const sql = (parts, ...parameters) => ({ connection, query: parts.join('?'), parameters });
      sql.transaction = async (queries, options) => {
        const statements = queries(sql);
        calls.push({ statements, options });
        if (databaseFailure) throw databaseFailure;
        return [databaseResult];
      };
      return sql;
    } };
  },
});
const { accountDeletionApi, deleteAccountData } = moduleUnderTest.exports;
const request = (value = { confirmation: 'DELETE' }, headers = {}) => new Request('https://app.example.test/api/delete-account', {
  method: 'POST',
  headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json', 'X-Pipwise-Session': sessionToken, ...headers },
  body: typeof value === 'string' ? value : JSON.stringify(value),
});
const signedIn = { authenticate: async () => ({ id: accountId }) };

test('self deletion uses only the verified subject and explicit recent-session proof', async () => {
  const removed = [];
  const result = await accountDeletionApi(request(), {
    ...signedIn, remove: async (...args) => { removed.push(args); return true; },
  });
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { deleted: true });
  assert.deepEqual(removed, [[accountId, sessionToken]]);
  assert.equal(result.headers.get('cache-control'), 'private, no-store');
  assert.equal(result.headers.get('access-control-allow-origin'), null);
});

test('unsigned, missing-session, expired/revoked-session and injected-account requests never authorize a delete', async () => {
  let writes = 0;
  const remove = async () => { writes++; return true; };
  assert.equal((await accountDeletionApi(request(), { remove })).status, 401);
  const noSession = request();
  noSession.headers.delete('X-Pipwise-Session');
  const absent = await accountDeletionApi(noSession, { ...signedIn, remove });
  assert.equal(absent.status, 401);
  assert.equal((await absent.json()).error.code, 'REAUTHENTICATION_REQUIRED');
  assert.equal((await accountDeletionApi(request({ confirmation: 'DELETE', userId: 'someone-else' }), { ...signedIn, remove })).status, 400);
  assert.equal(writes, 0);
  const expired = await accountDeletionApi(request(), { ...signedIn, remove: async () => false });
  assert.equal(expired.status, 401);
  assert.equal((await expired.json()).error.code, 'REAUTHENTICATION_REQUIRED');
});

test('permanent deletion requires exact small JSON confirmation and cannot be triggered by a GET or form post', async () => {
  let writes = 0;
  const dependencies = { ...signedIn, remove: async () => { writes++; return true; } };
  for (const value of [null, [], {}, { confirmation: 'delete' }, { confirmation: true }, '{bad-json']) {
    assert.equal((await accountDeletionApi(request(value), dependencies)).status, 400);
  }
  assert.equal((await accountDeletionApi(request('x'.repeat(513)), dependencies)).status, 413);
  assert.equal((await accountDeletionApi(request({ confirmation: 'DELETE' }, { 'Content-Type': 'application/x-www-form-urlencoded' }), dependencies)).status, 415);
  const get = await accountDeletionApi(new Request('https://app.example.test/api/delete-account'), dependencies);
  assert.equal(get.status, 405);
  assert.equal(get.headers.get('allow'), 'POST, OPTIONS');
  assert.equal(writes, 0);
});

test('trusted web origins get bounded preflight support; foreign origins cannot trigger deletion', async () => {
  let writes = 0;
  const dependencies = { ...signedIn, remove: async () => { writes++; return true; }, env: { EXPO_PUBLIC_APP_API_URL: 'https://api.example.test' } };
  const result = await accountDeletionApi(request(undefined, { Origin: 'https://app.example.test' }), dependencies);
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('access-control-allow-origin'), 'https://app.example.test');
  const foreign = await accountDeletionApi(request(undefined, { Origin: 'https://attacker.example.test' }), dependencies);
  assert.equal(foreign.status, 403);
  assert.equal(foreign.headers.get('access-control-allow-origin'), null);
  assert.equal(writes, 1);
  const preflight = await accountDeletionApi(new Request('https://api.example.test/api/delete-account', {
    method: 'OPTIONS', headers: { Origin: 'https://api.example.test' },
  }), dependencies);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://api.example.test');
  assert.match(preflight.headers.get('access-control-allow-headers'), /X-Pipwise-Session/);
});

test('database deletion delegates only to the restricted helper under READ COMMITTED', async () => {
  calls.length = 0;
  databaseFailure = undefined;
  databaseResult = [{ deleted: true }];
  const env = { APP_RUNTIME_DATABASE_URL: 'synthetic-runtime-connection', DATABASE_URL: 'unused-owner-connection' };
  assert.equal(await deleteAccountData(accountId, sessionToken, env), true);
  assert.equal(calls.length, 1);
  const transaction = calls[0];
  assert.equal(transaction.options.isolationLevel, 'ReadCommitted');
  assert.equal(transaction.statements.length, 1);
  const call = transaction.statements[0];
  assert.equal(call.connection, env.APP_RUNTIME_DATABASE_URL);
  assert.match(call.query, /SELECT pipwise_app\.delete_account\(\?::uuid, \?\) AS deleted/);
  assert.deepEqual(call.parameters, [accountId, sessionToken]);
  assert.ok(!call.query.includes(accountId));
  assert.ok(!call.query.includes(sessionToken));
  assert.doesNotMatch(call.query, /neon_auth\.|DELETE FROM|FOR UPDATE/);
  for (const result of [[], [{ deleted: false }], [{ deleted: 'true' }], [{ deleted: null }]]) {
    databaseResult = result;
    assert.equal(await deleteAccountData(accountId, sessionToken, env), false);
  }
});

test('unavailable credentials and database errors are safe and never report successful deletion', async () => {
  await assert.rejects(deleteAccountData(accountId, sessionToken, {}), error => error.code === 'DATABASE_NOT_CONFIGURED');
  await assert.rejects(deleteAccountData(accountId, sessionToken, { DATABASE_URL: 'unused-owner-connection' }), error => error.code === 'DATABASE_NOT_CONFIGURED');
  const failure = await accountDeletionApi(request(), {
    ...signedIn, remove: async () => { throw new Error('postgres://private-password@db.example.test'); },
  });
  assert.equal(failure.status, 503);
  const text = await failure.text();
  assert.ok(!text.includes('private-password'));
  assert.ok(!text.includes(sessionToken));
  assert.equal(JSON.parse(text).error.code, 'ACCOUNT_DELETION_UNAVAILABLE');
});

test('oversized chunked confirmations are cancelled without a delete', async () => {
  let cancelled = false;
  let writes = 0;
  const body = new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(400)); },
    cancel() { cancelled = true; },
  });
  const streamed = new Request('https://app.example.test/api/delete-account', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Pipwise-Session': sessionToken }, body, duplex: 'half',
  });
  const result = await accountDeletionApi(streamed, { ...signedIn, remove: async () => { writes++; return true; } });
  assert.equal(result.status, 413);
  assert.equal(cancelled, true);
  assert.equal(writes, 0);
});
