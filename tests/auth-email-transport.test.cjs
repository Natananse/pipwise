const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { EventEmitter } = require('node:events');
const flush = () => new Promise(resolve => setImmediate(resolve));
const env = { PIPWISE_SMTP_USER: 'pipwise.sender@gmail.com', PIPWISE_SMTP_APP_PASSWORD: 'abcd efgh ijkl mnop' };

function load(file, imports, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module, exports: module.exports,
    require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; },
    console: new Proxy({}, { get() { return () => assert.fail('Transport must not log'); } }),
    ...globals,
  });
  return module.exports;
}
const template = load('src/server/authEmailTemplate.ts', {});
const message = () => ({ to: 'member@example.test', ...template.renderPipWiseOtpEmail({ code: '012345', type: 'email-verification' }), messageId: 'pipwise-test-123@example.test' });

function harness({ autoSecure = true, authorized = true, connectFailure, prepareFailure, missingConnect = false, failure, hang = false, accepted = true } = {}) {
  const configurations = [], sockets = [], timers = [], calls = [], handoffs = [];
  class Socket extends EventEmitter {
    authorized = authorized;
    destroyed = false;
    destroyCount = 0;
    destroy() { this.destroyed = true; this.destroyCount++; this.emit('close'); return this; }
  }
  const nodemailer = {
    createTransport(options) {
      if (prepareFailure) throw prepareFailure;
      const item = { options, closed: 0 }; configurations.push(item);
      const operate = (kind, mail) => {
        calls.push({ kind, mail });
        return new Promise((resolve, reject) => options.getSocket({}, (error, result) => {
          if (error) { reject(error); return; }
          handoffs.push(result);
          if (failure) reject(failure);
          else if (!hang) resolve(kind === 'verify' ? true : { accepted: accepted ? [mail.to.address] : [], response: 'private provider response' });
        }));
      };
      return { verify: () => operate('verify'), sendMail: mail => operate('send', mail), close() { item.closed++; } };
    },
  };
  nodemailer.default = nodemailer;
  const api = load('src/server/authEmailTransport.ts', {
    nodemailer,
    'node:tls': { connect: missingConnect ? undefined : function connect(options) {
      if (connectFailure) throw connectFailure;
      const socket = new Socket(); sockets.push({ options, socket });
      if (autoSecure) queueMicrotask(() => socket.emit('secureConnect'));
      return socket;
    } },
    './authEmailTemplate': template,
  }, {
    setTimeout(fn, ms) { const timer = { fn, ms, active: true }; timers.push(timer); return timer; },
    clearTimeout(timer) { timer.active = false; },
  });
  return { api, configurations, sockets, timers, calls, handoffs,
    fire(ms) { const timer = timers.find(item => item.active && item.ms === ms); assert.ok(timer, `Missing active ${ms}ms timer`); timer.fn(); },
  };
}

test('verify authenticates without sending and hands off only a verified TLS socket', async () => {
  const h = harness();
  const gmail = h.api.createGmailTransport(env);
  assert.equal(h.configurations.length, 0, 'configuration alone must open no connection');
  assert.equal(await gmail.verify(), undefined);
  assert.deepEqual(h.calls.map(call => call.kind), ['verify']);
  const { options } = h.configurations[0];
  assert.equal(options.host, 'smtp.gmail.com'); assert.equal(options.port, 465);
  assert.equal(options.secure, true); assert.equal(options.pool, false);
  assert.equal(options.forceAuth, true, 'verify must not succeed by skipping authentication');
  assert.equal(options.auth.user, env.PIPWISE_SMTP_USER); assert.equal(options.auth.pass, 'abcdefghijklmnop');
  assert.equal(options.tls.rejectUnauthorized, true); assert.equal(options.tls.servername, 'smtp.gmail.com');
  assert.equal(options.logger, false); assert.equal(options.debug, false); assert.equal(options.transactionLog, false);
  assert.equal(options.disableFileAccess, true); assert.equal(options.disableUrlAccess, true);
  assert.equal(options.connectionTimeout, 4000); assert.equal(options.greetingTimeout, 4000); assert.equal(options.socketTimeout, 8000);
  assert.equal(h.sockets[0].options.host, 'smtp.gmail.com'); assert.equal(h.sockets[0].options.rejectUnauthorized, true);
  assert.equal(h.sockets[0].options.servername, 'smtp.gmail.com'); assert.equal(h.sockets[0].options.minVersion, 'TLSv1.2');
  assert.equal(h.handoffs[0].connection, h.sockets[0].socket); assert.equal(h.handoffs[0].secured, true);
  assert.equal(h.sockets[0].socket.destroyed, true); assert.equal(h.configurations[0].closed, 1);
  assert.ok(h.timers.every(timer => !timer.active));
});

test('send uses a fresh transport, exact approved content and a fixed PipWise sender and single-recipient envelope', async () => {
  const h = harness(); const gmail = h.api.createGmailTransport({ ...env, SMTP_HOST: 'attacker.test', SMTP_FROM: 'Attacker <other@example.test>' });
  await gmail.verify();
  const input = message();
  assert.equal(await gmail.send(input), undefined);
  assert.equal(h.configurations.length, 2); assert.equal(h.sockets.length, 2);
  const sent = JSON.parse(JSON.stringify(h.calls.find(call => call.kind === 'send').mail));
  assert.deepEqual(sent.from, { name: 'PipWise', address: env.PIPWISE_SMTP_USER });
  assert.deepEqual(sent.to, { name: '', address: input.to });
  assert.deepEqual(sent.envelope, { from: env.PIPWISE_SMTP_USER, to: [input.to] });
  assert.equal(sent.messageId, `<${input.messageId}>`);
  for (const key of ['subject', 'text', 'html']) assert.equal(sent[key], input[key]);
  assert.equal(sent.attachments, undefined); assert.equal(sent.headers, undefined); assert.equal(sent.auth, undefined);
  assert.ok(h.sockets.every(item => item.socket.destroyed));
  assert.ok(h.configurations.every(item => item.closed === 1));
});

test('bad credentials fail before network use and never echo configuration', () => {
  for (const value of [{}, { ...env, PIPWISE_SMTP_USER: 'Sender <private@gmail.com>' }, { ...env, PIPWISE_SMTP_USER: 'a@gmail.com\r\nBcc:x@test.test' },
    { ...env, PIPWISE_SMTP_APP_PASSWORD: '' }, { ...env, PIPWISE_SMTP_APP_PASSWORD: 'private-password' }, { ...env, PIPWISE_SMTP_APP_PASSWORD: 'abcdefghijklmnop\n' }]) {
    const h = harness();
    assert.throws(() => h.api.createGmailTransport(value), error => {
      assert.equal(error.code, 'SMTP_NOT_CONFIGURED'); assert.doesNotMatch(String(error), /private|abcdefghijklmnop|@|Bcc/i); return true;
    });
    assert.equal(h.configurations.length, 0); assert.equal(h.sockets.length, 0);
  }
});

test('unapproved templates, header injection, multiple recipients and content/transport overrides are rejected before connection', async () => {
  const patches = [
    { to: 'member@example.test\r\nBcc:other@example.test' }, { to: ['one@example.test', 'two@example.test'] }, { to: 'Name <member@example.test>' },
    { subject: 'PipWise\nInjected: value' }, { messageId: '<safe@example.test>\r\nBcc:other@example.test' }, { messageId: '<unclosed@example.test' },
    { html: { path: '/etc/passwd' } }, { text: { href: 'https://attacker.test/' } }, { html: '<p>PipWise <img src="https://attacker.test/" /></p>' },
    { html: 'x'.repeat(16001) }, { text: 'x'.repeat(5001) }, { attachments: [{ path: '/etc/passwd' }] },
    { from: 'Attacker <attacker@example.test>' }, { url: 'smtps://attacker.test/' }, { headers: { Bcc: 'attacker@example.test' } },
  ];
  for (const patch of patches) {
    const h = harness(); const gmail = h.api.createGmailTransport(env);
    await assert.rejects(async () => gmail.send({ ...message(), ...patch }), error => error.code === 'INVALID_EMAIL_MESSAGE');
    assert.equal(h.configurations.length, 0); assert.equal(h.sockets.length, 0);
  }
});

test('certificate and provider failures close sockets and expose only generic delivery errors', async () => {
  const privateError = Object.assign(new Error('535 AUTH private-password for private@gmail.com and code 012345'), { response: 'private response', command: 'AUTH LOGIN' });
  for (const options of [{ authorized: false }, { connectFailure: privateError }, { failure: privateError }, { accepted: false }]) {
    const h = harness(options); const gmail = h.api.createGmailTransport(env);
    await assert.rejects(async () => gmail.send(message()), error => {
      assert.equal(error.code, 'SMTP_SEND_FAILED'); assert.doesNotMatch(String(error), /535|AUTH|private|012345|gmail\.com/);
      assert.equal(error.response, undefined); assert.equal(error.cause, undefined); return true;
    });
    assert.ok(h.sockets.every(item => item.socket.destroyed));
    assert.ok(h.configurations.every(item => item.closed === 1));
    assert.ok(h.timers.every(timer => !timer.active));
  }
  const h = harness({ failure: privateError });
  await assert.rejects(h.api.createGmailTransport(env).verify(), error => error.code === 'SMTP_VERIFY_FAILED');
  assert.deepEqual(h.calls.map(call => call.kind), ['verify']);
});

test('four-second TLS and eight-second total deadlines destroy sockets and prevent late connection work', async () => {
  const tls = harness({ autoSecure: false }); const connecting = tls.api.createGmailTransport(env).verify();
  tls.fire(4000);
  await assert.rejects(connecting, error => error.code === 'SMTP_VERIFY_FAILED' && error.stage === 'tls-handshake' && error.reason === 'TIMEOUT');
  assert.equal(tls.handoffs.length, 0); assert.equal(tls.sockets[0].socket.destroyed, true);
  assert.ok(tls.timers.every(timer => !timer.active));
  for (const kind of ['verify', 'send']) {
    const h = harness({ hang: true }); const gmail = h.api.createGmailTransport(env);
    const pending = kind === 'send' ? gmail.send(message()) : gmail.verify();
    await flush(); h.fire(8000);
    await assert.rejects(pending, error => error.code === (kind === 'send' ? 'SMTP_SEND_FAILED' : 'SMTP_VERIFY_FAILED') && error.stage === 'smtp' && error.reason === 'TIMEOUT');
    assert.equal(h.sockets[0].socket.destroyed, true); assert.equal(h.configurations[0].closed, 1);
    assert.ok(h.timers.every(timer => !timer.active));
    let rejected = false;
    h.configurations[0].options.getSocket({}, error => { rejected = !!error; });
    assert.equal(rejected, true); assert.equal(h.sockets.length, 1, 'a finished operation must never create another socket');
  }
});

test('private diagnostics map failures to fixed enums without retaining provider messages, codes or causes', async () => {
  const secret = 'private-password private@gmail.com code012345';
  const cases = [
    [{ prepareFailure: new Error(`node API not implemented: ${secret}`) }, 'prepare', 'UNSUPPORTED_RUNTIME'],
    [{ connectFailure: Object.assign(new Error(secret), { code: 'ERR_METHOD_NOT_IMPLEMENTED' }) }, 'tls-connect', 'UNSUPPORTED_RUNTIME'],
    [{ connectFailure: new Error(`TLS connect not supported: ${secret}`) }, 'tls-connect', 'UNSUPPORTED_RUNTIME'],
    [{ connectFailure: new Error(`connect is not a function: ${secret}`) }, 'tls-connect', 'UNSUPPORTED_RUNTIME'],
    [{ missingConnect: true }, 'tls-connect', 'UNSUPPORTED_RUNTIME'],
    [{ authorized: false }, 'tls-handshake', 'TLS_UNAUTHORIZED'],
    ...[['EAUTH', 'AUTH_REJECTED'], ['ESOCKET', 'NETWORK_ERROR'], ['ECONNECTION', 'NETWORK_ERROR'], ['EDNS', 'DNS_ERROR'], ['ETIMEDOUT', 'TIMEOUT'],
      ['ERR_NOT_IMPLEMENTED', 'UNSUPPORTED_RUNTIME'], ['private-unlisted-code', 'UNKNOWN']].map(([code, reason]) => [{ failure: Object.assign(new Error(secret), { code, cause: new Error(secret) }) }, 'smtp', reason]),
  ];
  for (const [options, stage, reason] of cases) {
    const h = harness(options);
    await assert.rejects(h.api.createGmailTransport(env).verify(), error => {
      assert.equal(error.code, 'SMTP_VERIFY_FAILED'); assert.equal(error.stage, stage); assert.equal(error.reason, reason);
      assert.equal(error.cause, undefined); assert.equal(error.response, undefined);
      assert.doesNotMatch(`${String(error)} ${JSON.stringify(error)}`, /private|gmail\.com|012345/);
      return true;
    });
    assert.ok(h.sockets.every(item => item.socket.destroyed));
    assert.ok(h.timers.every(timer => !timer.active));
  }
  const h = harness();
  const invalid = new h.api.AuthEmailTransportError('SMTP_VERIFY_FAILED', secret, secret);
  assert.equal(invalid.stage, 'prepare'); assert.equal(invalid.reason, 'UNKNOWN');
});
