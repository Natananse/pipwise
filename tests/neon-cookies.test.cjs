const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

const moduleRef = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/neonCookies.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { module: moduleRef, exports: moduleRef.exports, Date, Math, Map, JSON, Number });
const { updateNeonSessionCookie, neonCookieHeader, restoreNeonSessionCookie, neonCookieStorageKey, updateNeonChallengeCookie, neonChallengeCookieHeader } = moduleRef.exports;
const authUrl = 'https://auth.example.test/neondb/auth';
const now = Date.parse('2026-11-04T12:00:00Z');

test('native credential parsing keeps only the Neon session token across combined Set-Cookie headers', () => {
  const cookie = updateNeonSessionCookie(null, [
    'unrelated=private; Path=/, __Secure-neon-auth.session_token=signed-session; Expires=Thu, 05 Nov 2026 12:00:00 GMT; HttpOnly; Secure; Path=/, __Secure-neon-auth.session_data=profile; Path=/',
  ], now);
  assert.equal(cookie.name, '__Secure-neon-auth.session_token');
  assert.equal(cookie.value, 'signed-session');
  assert.equal(cookie.expiresAt, now + 86400000);
  assert.equal(neonCookieHeader(cookie, now), '__Secure-neon-auth.session_token=signed-session');
  assert.equal(neonCookieHeader(cookie, now + 86400000), '');
});

test('native cookie renewal and deletion honor Max-Age before Expires', () => {
  const first = updateNeonSessionCookie(null, ['__Secure-neon-auth.session_token=old; Max-Age=3600'], now);
  const renewed = updateNeonSessionCookie(first, ['__Secure-neon-auth.session_token=new; Max-Age=7200; Expires=Thu, 01 Jan 1970 00:00:00 GMT'], now);
  assert.equal(renewed.value, 'new');
  assert.equal(renewed.expiresAt, now + 7200000);
  assert.equal(updateNeonSessionCookie(renewed, ['__Secure-neon-auth.session_token=; Max-Age=0'], now), null);
  assert.equal(updateNeonSessionCookie(renewed, ['__Secure-neon-auth.session_token=old; Expires=Thu, 01 Jan 1970 00:00:00 GMT'], now), null);
});

test('restoration rejects another branch, corrupt credentials, expired cookies and header injection', () => {
  const cookie = { name: '__Secure-neon-auth.session_token', value: 'signed-session', expiresAt: now + 60000 };
  const saved = JSON.stringify({ url: authUrl, cookie });
  assert.equal(restoreNeonSessionCookie(saved, authUrl, now).value, 'signed-session');
  assert.equal(restoreNeonSessionCookie(saved, `${authUrl}-other`, now), null);
  assert.equal(restoreNeonSessionCookie(saved, authUrl, now + 60000), null);
  for (const altered of [
    { ...cookie, name: 'Authorization' },
    { ...cookie, value: 'bad\r\nAuthorization: other' },
    { ...cookie, value: 'bad; injected=credential' },
    { ...cookie, expiresAt: 'never' },
  ]) assert.equal(restoreNeonSessionCookie(JSON.stringify({ url: authUrl, cookie: altered }), authUrl, now), null);
  assert.equal(restoreNeonSessionCookie(null, authUrl, now), null);
  assert.equal(restoreNeonSessionCookie('{broken', authUrl, now), null);
  assert.match(neonCookieStorageKey(authUrl), /^[a-z0-9._-]+$/i);
  assert.notEqual(neonCookieStorageKey(authUrl), neonCookieStorageKey(`${authUrl}-other`));
});

test('OAuth challenges stay separate from session credentials and expire within ten minutes', () => {
  for (const name of ['__Secure-neon-auth.session_challenge', '__Secure-neon-auth.session_challange', 'neon-auth.session_challenge']) {
    const cookie = updateNeonChallengeCookie(null, [`${name}=temporary; Max-Age=86400, __Secure-neon-auth.session_token=durable; Max-Age=86400`], now);
    assert.equal(neonChallengeCookieHeader(cookie, now), `${name}=temporary`);
    assert.equal(cookie.expiresAt, now + 600000);
    assert.equal(neonCookieHeader(cookie, now), '');
    assert.equal(neonChallengeCookieHeader(cookie, now + 600000), '');
    assert.equal(updateNeonChallengeCookie(cookie, [`${name}=; Max-Age=0`], now), null);
  }
  const cookie = updateNeonChallengeCookie(null, ['__Secure-neon-auth.session_challenge=temporary'], now, now + 30000);
  assert.equal(cookie.expiresAt, now + 30000);
  assert.equal(updateNeonChallengeCookie(null, ['__Secure-neon-auth.session_token=durable'], now), null);
  assert.equal(neonChallengeCookieHeader({ name: 'Authorization', value: 'bad', expiresAt: null }, now), '');
  assert.equal(neonChallengeCookieHeader({ name: '__Secure-neon-auth.session_challenge', value: 'bad; injected=credential', expiresAt: now + 1000 }, now), '');
});
