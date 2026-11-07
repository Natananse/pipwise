const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports, env = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { module, exports: module.exports, Response, TextDecoder, process: { env }, require(name) {
    assert.ok(name in imports, `Unexpected import ${name}`);
    return imports[name];
  } });
  return module.exports;
}

const registration = load('src/lib/registrationDetails.ts', {});
class HttpError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }
const imports = {
  './database': { runtimeDatabase: () => { throw new Error('Unexpected database access'); } },
  '../lib/registrationDetails': registration,
  './authenticate': { HttpError, authenticate: async () => { throw new HttpError(401, 'UNAUTHORIZED', 'Sign in.'); } },
};
const { accountDetailsApi } = load('src/server/accountDetailsApi.ts', imports);
const owner = '12345678-1234-1234-1234-123456789012';
const put = body => new Request('https://app.example.test/api/account-details', {
  method: 'PUT', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body),
});

test('private account details are scoped to the authenticated subject and canonicalized before storage', async () => {
  const writes = [];
  const reads = [];
  const dependencies = {
    authenticate: async () => ({ id: owner }),
    save: async (id, details) => { writes.push({ id, details }); return details; },
    read: async id => { reads.push(id); return writes[0]?.details || null; },
  };
  const response = await accountDetailsApi(put({ countryCode: ' et ', phoneNumber: '+251 (91) 123-4567' }), dependencies);
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.deepEqual(saved, { details: { countryCode: 'ET', phoneNumber: '+251911234567' } });
  assert.equal(writes[0].id, owner);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const loaded = await accountDetailsApi(new Request('https://app.example.test/api/account-details?userId=someone-else'), dependencies);
  assert.deepEqual(await loaded.json(), saved);
  assert.deepEqual(reads, [owner]);
});

test('account details reject unsigned calls and account-ID injection before any database work', async () => {
  let writes = 0;
  const save = async () => { writes += 1; };
  const rejected = await accountDetailsApi(put({ countryCode: 'ET' }), { save });
  assert.equal(rejected.status, 401);
  assert.equal(rejected.headers.get('www-authenticate'), 'Bearer');
  const injected = await accountDetailsApi(put({ countryCode: 'ET', userId: 'someone-else' }), { authenticate: async () => ({ id: owner }), save });
  assert.equal(injected.status, 400);
  assert.equal(writes, 0);
});

test('invalid and oversized account forms never write, and optional phone numbers may be omitted', async () => {
  let writes = 0;
  const dependencies = { authenticate: async () => ({ id: owner }), save: async (_id, details) => { writes += 1; return details; } };
  for (const body of [null, [], '{broken', { countryCode: 'ZZ' }, { countryCode: 'ET', phoneNumber: 123 }, { countryCode: 'ET', phoneNumber: '+12025550123' }]) {
    const response = await accountDetailsApi(put(body), dependencies);
    assert.equal(response.status, 400);
  }
  assert.equal((await accountDetailsApi(put('x'.repeat(2049)), dependencies)).status, 413);
  assert.equal(writes, 0);
  const response = await accountDetailsApi(put({ countryCode: 'ET' }), dependencies);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { details: { countryCode: 'ET', phoneNumber: null } });
  assert.equal(writes, 1);
});

test('database/provider failures never leak connection details to the client', async () => {
  const response = await accountDetailsApi(new Request('https://app.example.test/api/account-details'), {
    authenticate: async () => ({ id: owner }), read: async () => { throw new Error('postgres://private-password@example.test/private'); },
  });
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes('private-password'));
});

test('default storage uses only the runtime factory and binds both reads and writes to the verified account', async () => {
  const queries = [];
  let factoryCalls = 0;
  const { accountDetailsApi: api } = load('src/server/accountDetailsApi.ts', {
    ...imports, './database': { runtimeDatabase() {
      factoryCalls++;
      return async (parts, ...values) => {
        queries.push({ query: parts.join('?'), values });
        return [{ country_code: 'ET', phone_number: null }];
      };
    } },
  }, { APP_RUNTIME_DATABASE_URL: 'synthetic-runtime-connection', DATABASE_URL: 'unused-owner-connection' });
  const authenticated = { authenticate: async () => ({ id: owner }) };
  assert.equal((await api(new Request('https://app.example.test/api/account-details?userId=somebody-else'), authenticated)).status, 200);
  assert.equal((await api(put({ countryCode: 'ET' }), authenticated)).status, 200);
  assert.equal(factoryCalls, 2);
  assert.deepEqual(queries[0].values, [owner]);
  assert.deepEqual(queries[1].values, [owner, 'ET', null]);
  assert.match(queries[0].query, /from public\.account_details where user_id = \?::uuid/i);
  assert.match(queries[1].query, /insert into public\.account_details/i);
  assert.doesNotMatch(queries.map(item => item.query).join(' '), /neon_auth\./);
});

test('legacy owner-only configuration cannot select a database connection', async () => {
  let factoryCalls = 0;
  const { accountDetailsApi: api } = load('src/server/accountDetailsApi.ts', {
    ...imports, './database': { runtimeDatabase() { factoryCalls++; throw new Error('Factory must not run'); } },
  }, { DATABASE_URL: 'unused-owner-connection' });
  const response = await api(new Request('https://app.example.test/api/account-details'), { authenticate: async () => ({ id: owner }) });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'DATABASE_NOT_CONFIGURED');
  assert.equal(factoryCalls, 0);
});

test('oversized chunked forms are cancelled before buffering the entire request', async () => {
  let cancelled = false;
  let writes = 0;
  const body = new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(1500)); },
    cancel() { cancelled = true; },
  });
  const request = new Request('https://app.example.test/api/account-details', {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body, duplex: 'half',
  });
  assert.equal(request.headers.has('content-length'), false);
  const response = await accountDetailsApi(request, {
    authenticate: async () => ({ id: owner }), save: async () => { writes += 1; },
  });
  assert.equal(response.status, 413);
  assert.equal(cancelled, true);
  assert.equal(writes, 0);
});
