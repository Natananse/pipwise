const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const moduleExports = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/persistence.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { module: moduleExports, exports: moduleExports.exports, Promise });
const { createPersistenceQueue } = moduleExports.exports;

test('slow earlier persistence completes before newer preferences are saved', async () => {
  const enqueue = createPersistenceQueue();
  const events = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const older = enqueue(async () => { events.push('older:start'); await gate; events.push('older:saved'); });
  const newer = enqueue(async () => { events.push('newer:saved'); return 'saved'; });
  await Promise.resolve();
  assert.deepEqual(events, ['older:start']);
  release();
  await older;
  assert.equal(await newer, 'saved');
  assert.deepEqual(events, ['older:start', 'older:saved', 'newer:saved']);
});

test('failed storage rejects the caller and still permits a successful retry', async () => {
  const enqueue = createPersistenceQueue();
  await assert.rejects(enqueue(async () => { throw new Error('disk unavailable'); }), /disk unavailable/);
  assert.equal(await enqueue(async () => 'retry saved'), 'retry saved');
});

test('deletion waits for an active save and suppresses queued old writes before storage is erased', async () => {
  const enqueue = createPersistenceQueue();
  const events = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const first = enqueue(async () => { events.push('started'); await gate; events.push('saved'); });
  await Promise.resolve();
  const obsolete = enqueue(async () => { events.push('obsolete'); });
  const drain = moduleExports.exports.pausePersistenceForAccountDeletion().then(() => events.push('drained'));
  release();
  await Promise.all([first, obsolete, drain]);
  assert.deepEqual(events, ['started', 'saved', 'drained']);
  await enqueue(async () => { events.push('blocked'); });
  moduleExports.exports.resumePersistenceAfterAccountDeletion();
  await enqueue(async () => { events.push('new account'); });
  assert.deepEqual(events, ['started', 'saved', 'drained', 'new account']);
});
