const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

const moduleForFeedback = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/feedback.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { module: moduleForFeedback, exports: moduleForFeedback.exports });
const { validateFeedback, feedbackPayload, formatFeedbackReport, feedbackAlreadyDelivered, createFeedbackReportId } = moduleForFeedback.exports;
const draft = { rating: 4, category: 'bug', message: '  The lesson button was hard to tap.  ' };
const metadata = { appVersion: '1.0.0', platform: 'android', language: 'ar' };
const user = '12345678-1234-1234-1234-123456789abc';
const report = 'test-report-id-12345';

test('review validation requires a real rating, supported category and bounded nonempty message', () => {
  assert.equal(validateFeedback(draft), '');
  for (const rating of [0, -1, 6, 2.5, NaN]) assert.match(validateFeedback({ ...draft, rating }), /rating/);
  assert.match(validateFeedback({ ...draft, category: 'unexpected' }), /category/);
  assert.match(validateFeedback({ ...draft, message: ' \n ' }), /Tell us/);
  assert.match(validateFeedback({ ...draft, message: 'x'.repeat(2001) }), /2,000/);
  assert.equal(validateFeedback({ ...draft, message: 'x'.repeat(2000) }), '');
});

test('submission includes only explicit review fields and minimal metadata, trims message and validates identity', () => {
  const payload = feedbackPayload({ ...draft, password: 'should-not-send', email: 'should-not-send' }, user, report, { ...metadata, token: 'should-not-send' });
  assert.deepEqual(JSON.parse(JSON.stringify(payload)), {
    user_id: user, client_report_id: report, rating: 4, category: 'bug',
    message: 'The lesson button was hard to tap.', app_version: '1.0.0', platform: 'android', language: 'ar',
  });
  assert.throws(() => feedbackPayload(draft, '', report, metadata), /Sign in/);
  assert.throws(() => feedbackPayload(draft, user, 'bad', metadata), /prepare/);
  assert.throws(() => feedbackPayload({ ...draft, message: '' }, user, report, metadata), /Tell us/);
  assert.match(createFeedbackReportId(), /^[a-z0-9-]{10,80}$/);
});

test('only a duplicate of the same private report is acknowledged as previously delivered', () => {
  assert.equal(feedbackAlreadyDelivered(null), false);
  assert.equal(feedbackAlreadyDelivered({ code: '42501', message: 'permission denied' }), false);
  assert.equal(feedbackAlreadyDelivered({ code: '23505', message: 'some_other_constraint' }), false);
  assert.equal(feedbackAlreadyDelivered({ code: '23505', message: 'duplicate key value violates unique constraint "beta_feedback_user_report_key"' }), true);
});

test('share report contains useful reproduction context without account credentials', () => {
  const text = formatFeedbackReport(draft, metadata);
  assert.match(text, /Rating: 4\/5/);
  assert.match(text, /Category: bug/);
  assert.match(text, /1\.0\.0 · android · ar/);
  assert.match(text, /The lesson button was hard to tap\.$/);
  assert(!text.includes(user));
  assert.throws(() => formatFeedbackReport({ ...draft, rating: 0 }, metadata), /rating/);
});
