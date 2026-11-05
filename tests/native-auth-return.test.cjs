const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('public/native-auth-return.js', 'utf8');
const state = 'd24a2c80-6753-49dc-9fb9-b5f6ae847a60';
const verifier = 'opaque+verifier/with=padding';
const callback = values => `https://app.example.test/native-auth.html?${new URLSearchParams(values)}`;
const valid = { state, neon_auth_session_verifier: verifier };

function relay(href, { historyThrows = false, launchThrows = false } = {}) {
  const status = { textContent: 'Preparing your return to the app…' };
  const link = { hidden: true, removeAttribute(name) { delete this[name]; } };
  const history = [];
  const launches = [];
  const events = [];
  const location = {
    href,
    replace(target) {
      events.push('launch');
      if (launchThrows) throw new Error('Browser blocked automatic launch');
      launches.push(target);
    },
  };
  vm.runInNewContext(source, {
    URL,
    document: { getElementById: id => ({ 'return-status': status, 'return-to-app': link })[id] },
    window: {
      location,
      history: { replaceState(...args) {
        events.push('clear');
        if (historyThrows) throw new Error('History unavailable');
        history.push(args);
      } },
    },
  });
  return { status, link, history, launches, events };
}

test('a valid relay clears browser credentials before launching the fixed app callback', () => {
  const fixture = relay(`${callback(valid)}#ignored-fragment`);
  assert.deepEqual(fixture.events, ['clear', 'launch']);
  assert.deepEqual(fixture.history, [[null, '', '/native-auth.html']]);
  assert.equal(fixture.launches.length, 1);
  assert.equal(fixture.link.hidden, false);
  assert.equal(fixture.link.href, fixture.launches[0]);
  const target = new URL(fixture.link.href);
  assert.equal(target.protocol, 'pipwise:');
  assert.equal(target.hostname, 'auth-callback');
  assert.equal(target.pathname, '');
  assert.equal(target.hash, '');
  assert.deepEqual([...target.searchParams.entries()], [['neon_auth_session_verifier', verifier], ['state', state]]);
});

test('extra redirects and tokens never change the destination or forwarded whitelist', () => {
  const fixture = relay(callback({
    ...valid,
    redirect_uri: 'javascript:alert(1)',
    callbackURL: 'https://attacker.example.test/steal',
    scheme: 'https',
    access_token: 'private-access-token',
    refresh_token: 'private-refresh-token',
  }));
  const target = new URL(fixture.link.href);
  assert.equal(`${target.protocol}//${target.host}${target.pathname}`, 'pipwise://auth-callback');
  assert.deepEqual([...target.searchParams.keys()], ['neon_auth_session_verifier', 'state']);
  for (const text of ['attacker', 'javascript', 'private-access-token', 'private-refresh-token']) assert.ok(!fixture.link.href.includes(text));
});

test('missing, duplicate, malformed and oversized callback credentials fail without launching', () => {
  const urls = [
    'https://app.example.test/native-auth.html',
    callback({ state }),
    callback({ neon_auth_session_verifier: verifier }),
    callback({ ...valid, state: '' }),
    callback({ ...valid, neon_auth_session_verifier: '' }),
    callback({ ...valid, state: 'not-a-random-uuid' }),
    callback({ ...valid, state: state.replace('-49dc-', '-19dc-') }),
    callback({ ...valid, neon_auth_session_verifier: 'a'.repeat(2049) }),
    ...['space here', '\n', 'test\rvalue', 'test\u0000value', 'test\u007fvalue'].map(value => callback({ ...valid, neon_auth_session_verifier: value })),
    `${callback(valid)}&state=${state}`,
    `${callback(valid)}&neon_auth_session_verifier=second-value`,
    callback(valid).replace('https:', 'http:'),
  ];
  for (const url of urls) {
    const fixture = relay(url);
    assert.deepEqual(fixture.launches, [], `must reject ${url.slice(0, 160)}`);
    assert.equal(fixture.link.hidden, true);
    assert.equal(fixture.link.href, undefined);
    assert.match(fixture.status.textContent, /could not be completed/);
    assert.deepEqual(fixture.history, [[null, '', '/native-auth.html']], 'failed callbacks must also clear browser credentials');
  }
});

test('OAuth error fields override otherwise valid credentials without revealing provider details', () => {
  for (const field of ['error', 'error_code', 'error_description']) {
    for (const detail of ['', 'private-provider-detail']) {
      const fixture = relay(callback({ ...valid, [field]: detail }));
      assert.deepEqual(fixture.launches, []);
      assert.equal(fixture.link.hidden, true);
      assert.match(fixture.status.textContent, /could not be completed/);
      assert.ok(!fixture.status.textContent.includes('private-provider-detail'));
    }
  }
});

test('blocked browser launch retains the explicit app link, and unavailable history does not consume the verifier', () => {
  const blocked = relay(callback(valid), { launchThrows: true });
  assert.equal(blocked.link.hidden, false);
  assert.equal(new URL(blocked.link.href).searchParams.get('neon_auth_session_verifier'), verifier);
  assert.match(blocked.status.textContent, /Choose Open PipWise/);
  const noHistory = relay(callback(valid), { historyThrows: true });
  assert.equal(noHistory.launches.length, 1);
  assert.equal(new URL(noHistory.link.href).searchParams.get('state'), state);
});

test('the static page has no app bundle or external resources and provides accessible recovery', () => {
  const html = fs.readFileSync('public/native-auth.html', 'utf8');
  assert.match(html, /name="referrer" content="no-referrer"/);
  assert.match(html, /name="robots" content="noindex/);
  assert.match(html, /Content-Security-Policy" content="default-src 'none'; script-src 'self'; base-uri 'none'; form-action 'none'"/);
  assert.deepEqual([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]), ['/native-auth-return.js']);
  assert.match(html, /id="return-status" role="status" aria-live="polite"/);
  assert.match(html, /href="\/auth"[^>]*>Back to sign in/);
  assert.ok(!/https?:\/\//.test(html));
});
