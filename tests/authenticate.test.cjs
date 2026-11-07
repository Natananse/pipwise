const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jose = require('jose');

const issuer = 'https://auth.example.test';
const subject = '12345678-1234-1234-1234-123456789012';
const sessionToken = 'synthetic-account-session';

function load(publicKey, env = { NEON_AUTH_BASE_URL: `${issuer}/neondb/auth`, APP_RUNTIME_DATABASE_URL: 'synthetic-runtime-connection' }, options = {}) {
  const module = { exports: {} };
  const keyRequests = [];
  const queries = [];
  const resolve = jose.createLocalJWKSet({ keys: [publicKey] });
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/server/authenticate.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    module, exports: module.exports, URL, process: { env },
    require(name) {
      if (name === './database') return { runtimeDatabase() {
        assert.ok(env.APP_RUNTIME_DATABASE_URL, 'Only the dedicated runtime setting may select a connection');
        return async (parts, ...values) => {
          queries.push({ query: parts.join('?'), values });
          if (options.databaseFailure) throw options.databaseFailure;
          return options.rows ?? [{ active: true }];
        };
      } };
      assert.equal(name, 'jose');
      return { ...jose, createRemoteJWKSet(url) { keyRequests.push(url.href); return resolve; } };
    },
  });
  return { ...module.exports, keyRequests, queries };
}

test('account authentication verifies real EdDSA signatures and the Managed Auth issuer/audience', async () => {
  const keys = await jose.generateKeyPair('EdDSA');
  const publicKey = { ...await jose.exportJWK(keys.publicKey), kid: 'auth-test-key' };
  const h = load(publicKey);
  const now = Math.floor(Date.now() / 1000);
  async function token(overrides = {}, privateKey = keys.privateKey) {
    return new jose.SignJWT({ sub: subject, emailVerified: true, iat: now, exp: now + 900, iss: issuer, aud: issuer, ...overrides })
      .setProtectedHeader({ alg: 'EdDSA', kid: 'auth-test-key' }).sign(privateKey);
  }
  const request = value => new Request('https://app.example.test/api/account-details', { headers: { Authorization: `Bearer ${value}`, 'X-Pipwise-Session': sessionToken } });
  const valid = await token();
  await assert.rejects(h.authenticate(request(valid), { activeSession: async () => false }), error => error.status === 401);
  assert.equal((await h.authenticate(request(valid))).id, subject);
  assert.equal((await h.authenticate(request(valid))).id, subject);
  assert.equal(h.keyRequests.length, 1, 'JWKS resolver should be reused across requests');
  assert.equal(h.keyRequests[0], `${issuer}/neondb/auth/.well-known/jwks.json`);
  assert.equal(h.queries.length, 2);
  assert.match(h.queries[0].query, /SELECT pipwise_app\.session_is_active\(\?::uuid, \?\) AS active/);
  assert.deepEqual(h.queries[0].values, [subject, sessionToken]);
  assert.doesNotMatch(h.queries[0].query, /neon_auth\./);
  for (const claims of [
    { iss: 'https://attacker.example.test' }, { aud: 'other-service' }, { exp: now - 60 },
    { exp: undefined }, { sub: undefined }, { sub: 'untrusted-sql-value' },
    { emailVerified: false }, { emailVerified: undefined }, { banned: true },
  ]) {
    await assert.rejects(h.authenticate(request(await token(claims))), error => error.status === 401 && error.code === 'UNAUTHORIZED');
  }
  const otherKeys = await jose.generateKeyPair('EdDSA');
  await assert.rejects(h.authenticate(request(await token({}, otherKeys.privateKey))), error => error.status === 401);
  const segments = valid.split('.');
  segments[2] = (segments[2][0] === 'a' ? 'b' : 'a') + segments[2].slice(1);
  await assert.rejects(h.authenticate(request(segments.join('.'))), error => error.status === 401);
  await assert.rejects(h.authenticate(new Request('https://app.example.test')), error => error.status === 401);
});

test('missing, malformed, revoked or differently owned session proof rejects an otherwise valid JWT', async () => {
  const keys = await jose.generateKeyPair('EdDSA');
  const h = load(await jose.exportJWK(keys.publicKey));
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new jose.SignJWT({ sub: subject, emailVerified: true, iat: now, exp: now + 900, iss: issuer, aud: issuer })
    .setProtectedHeader({ alg: 'EdDSA' }).sign(keys.privateKey);
  const request = proof => new Request('https://app.example.test/api/feedback', {
    headers: { Authorization: `Bearer ${jwt}`, ...(proof === undefined ? {} : { 'X-Pipwise-Session': proof }) },
  });
  let sessionChecks = 0;
  const activeSession = async (id, proof) => {
    sessionChecks++;
    assert.equal(id, subject);
    return proof === sessionToken;
  };
  for (const proof of [undefined, '', 'has whitespace', 'x'.repeat(2049)]) {
    await assert.rejects(h.authenticate(request(proof), { activeSession }), error => error.status === 401);
  }
  assert.equal(sessionChecks, 0);
  assert.equal(h.keyRequests.length, 0);
  for (const proof of ['revoked-session', 'another-accounts-session']) {
    await assert.rejects(h.authenticate(request(proof), { activeSession }), error => error.status === 401);
  }
  assert.equal((await h.authenticate(request(sessionToken), { activeSession })).id, subject);
  assert.equal(sessionChecks, 3);
});

test('session helper must confirm a boolean active result and runtime failures remain private', async () => {
  const keys = await jose.generateKeyPair('EdDSA');
  const publicKey = await jose.exportJWK(keys.publicKey);
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new jose.SignJWT({ sub: subject, emailVerified: true, iat: now, exp: now + 900, iss: issuer, aud: issuer })
    .setProtectedHeader({ alg: 'EdDSA' }).sign(keys.privateKey);
  const request = () => new Request('https://app.example.test/api/feedback', { headers: { Authorization: `Bearer ${jwt}`, 'X-Pipwise-Session': sessionToken } });
  for (const rows of [[], [{ active: false }], [{ active: 'true' }], [{ active: null }]]) {
    await assert.rejects(load(publicKey, undefined, { rows }).authenticate(request()), error => error.status === 401);
  }
  await assert.rejects(load(publicKey, undefined, { databaseFailure: new Error('synthetic-private-connection') }).authenticate(request()), error =>
    error.status === 503 && error.code === 'ACCOUNT_SERVICE_UNAVAILABLE' && !error.message.includes('synthetic-private'));
  const legacyOnly = { NEON_AUTH_BASE_URL: `${issuer}/neondb/auth`, DATABASE_URL: 'unused-owner-connection' };
  await assert.rejects(load(publicKey, legacyOnly).authenticate(request()), error => error.status === 503 && error.code === 'DATABASE_NOT_CONFIGURED');
});

test('invalid server auth setup fails closed without exposing environment values', async () => {
  const keys = await jose.generateKeyPair('EdDSA');
  const publicKey = await jose.exportJWK(keys.publicKey);
  for (const env of [{}, { NEON_AUTH_BASE_URL: 'http://insecure.test/auth' },
    { NEON_AUTH_BASE_URL: `${issuer}/auth`, NEON_AUTH_JWKS_URL: 'https://different.example.test/jwks' }]) {
    const h = load(publicKey, env);
    await assert.rejects(h.authenticate(new Request('https://app.example.test', { headers: { Authorization: 'Bearer a.b.c', 'X-Pipwise-Session': sessionToken } })), error =>
      error.status === 503 && error.code === 'AUTH_NOT_CONFIGURED' && !error.message.includes('https:'));
    assert.equal(h.keyRequests.length, 0);
  }
});
