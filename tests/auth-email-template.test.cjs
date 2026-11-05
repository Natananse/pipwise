const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

const moduleValue = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/server/authEmailTemplate.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, {
  module: moduleValue, exports: moduleValue.exports,
  require(name) { assert.fail(`A pure email renderer must not import ${name}`); },
  fetch() { assert.fail('Rendering must not contact a provider'); },
  console: new Proxy({}, { get() { return () => assert.fail('Rendering must not log verification codes'); } }),
});
const { renderPipWiseOtpEmail } = moduleValue.exports;
const purposes = [
  ['sign-in', /sign.in/i, /finish signing in/],
  ['email-verification', /verify.*email/i, /verify your email address/],
  ['forget-password', /reset.*password/i, /continue resetting your password/],
];

test('every supported purpose has PipWise-branded subject, HTML and plain text with the exact code', () => {
  const subjects = new Set();
  for (const [type, title, instruction] of purposes) {
    const rendered = renderPipWiseOtpEmail({ type, code: '012345' });
    assert.deepEqual(Object.keys(rendered).sort(), ['html', 'subject', 'text']);
    subjects.add(rendered.subject);
    for (const value of Object.values(rendered)) {
      assert.match(value, /PipWise/);
      assert.match(value, title);
    }
    for (const body of [rendered.html, rendered.text]) {
      assert.match(body, instruction);
      assert.ok(body.includes('012345'), 'leading zeros must survive rendering');
      assert.match(body, /This code expires\./);
      assert.match(body, /Do not share this code/);
      assert.match(body, /If you did not request this/);
      assert.doesNotMatch(body, /\b\d+\s*(?:seconds?|minutes?|hours?|days?)\b/i, 'expiry duration belongs to the authentication service');
    }
    assert.ok(!rendered.subject.includes('012345'), 'keep the code out of email subjects');
  }
  assert.equal(subjects.size, 3, 'email purposes need distinct subject lines');
});

test('HTML uses inline mint and charcoal branding with no external assets, links or provider identity', () => {
  for (const [type] of purposes) {
    const rendered = renderPipWiseOtpEmail({ type, code: '999999' });
    assert.match(rendered.html, /#C8F169/);
    assert.match(rendered.html, /#0D1011/);
    assert.match(rendered.html, /<table role="presentation"/);
    assert.match(rendered.html, /<html lang="en">/);
    assert.doesNotMatch(rendered.html, /<img\b|<a\b|<link\b|<script\b|<style\b|https?:\/\/|\bsrc\s*=|\bhref\s*=/i);
    assert.doesNotMatch(Object.values(rendered).join('\n'), /neon|gemini|google|resend|smtp|provider/i);
    assert.doesNotMatch(rendered.text, /<[^>]+>/);
    assert.deepEqual(renderPipWiseOtpEmail({ type, code: '999999' }), rendered, 'rendering must be deterministic');
  }
});

test('malformed inputs and unsupported purposes fail without reflecting code or user data', () => {
  const malformed = [
    null, undefined, [], '123456', {}, { code: '123456' },
    { type: 'sign-in' }, { type: 'sign-in', code: 123456 },
    ...['', '12345', '1234567', ' 123456', '123456 ', '123456\n', '123456\r', '12345\0', 'abcdef', '１２３４５６', '<script>alert(1)</script>'].map(code => ({ type: 'sign-in', code })),
    ...['unsupported', 'constructor', '__proto__', 'Sign-in', 'password-reset', '<img src=x onerror=alert(1)>', null, 123].map(type => ({ type, code: '123456' })),
    { type: 'sign-in', code: '123456', email: 'private@example.test' },
    { type: 'sign-in', code: '123456', name: '<script>private</script>' },
    { type: 'sign-in', code: '123456', expiresIn: 600 },
  ];
  for (const input of malformed) {
    assert.throws(() => renderPipWiseOtpEmail(input), error => {
      assert.equal(typeof error.message, 'string');
      assert.doesNotMatch(error.message, /123456|private|<script|<img|example\.test/);
      return true;
    });
  }
});
