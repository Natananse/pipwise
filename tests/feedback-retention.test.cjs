const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const loaded = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/server/feedbackRetention.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { module: loaded, exports: loaded.exports });
const { countExpiredFeedback, purgeExpiredFeedback } = loaded.exports;

test('dry-run retention returns only eligible count and rejects malformed results', async () => {
  assert.equal(await countExpiredFeedback(async () => [{ eligible: 3 }]), 3);
  for (const result of [[], [{ eligible: -1 }], [{ eligible: '3' }]]) {
    await assert.rejects(countExpiredFeedback(async () => result));
  }
});

test('retention returns only a removal count and propagates database failures', async () => {
  assert.equal(await purgeExpiredFeedback(async () => [{ removed: 3 }]), 3);
  assert.equal(await purgeExpiredFeedback(async () => [{ removed: 0 }]), 0);
  for (const result of [[], [{ removed: -1 }], [{ removed: 1.5 }], [{ removed: '3' }]]) {
    await assert.rejects(purgeExpiredFeedback(async () => result));
  }
  const failure = new Error('database unavailable');
  await assert.rejects(purgeExpiredFeedback(async () => { throw failure; }), error => error === failure);
});
