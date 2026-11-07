const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
function load(file, imports, globals) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { module, exports: module.exports, require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; }, ...globals });
  return module.exports;
}
async function settle() { for (let i = 0; i < 20; i++) await Promise.resolve(); }
function fixture({ raw = null, read, write } = {}) {
  const timers = new Map(), writes = []; let nextTimer = 0, saved = raw;
  const clock = { setTimeout(callback) { const id = ++nextTimer; timers.set(id, callback); return id; }, clearTimeout(id) { timers.delete(id); } };
  const persistence = load('src/lib/persistence.ts', {}, clock);
  const tasks = load('src/lib/startupTasks.ts', {}, clock);
  const api = load('src/lib/uiPreferencesStore.ts', { './persistence': persistence, './startupTasks': tasks }, clock);
  const store = api.createUiPreferencesStore({
    getItem: key => read ? read(key) : Promise.resolve(saved),
    async setItem(key, value) { writes.push({ key, value }); if (write) await write(key, value); saved = value; },
  });
  return { ...api, store, writes, timers, persistence,
    expire() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(callback => callback()); },
    erase() { saved = null; }, get saved() { return saved; } };
}

test('fresh and older display records receive safe defaults independently of onboarding', async () => {
  const h = fixture(); await h.store.load();
  assert.equal(h.store.getSnapshot().rotation, 'auto'); assert.equal(h.store.getSnapshot().immersive, true);
  assert.equal(h.store.getSnapshot().loaded, true);
  assert.equal(h.store.getServerSnapshot().loaded, false);
  assert.equal(h.writes.length, 0);
  const older = fixture({ raw: '{"rotation":"portrait"}' }); await older.store.load();
  assert.equal(older.store.getSnapshot().rotation, 'portrait'); assert.equal(older.store.getSnapshot().immersive, true);
});

test('invalid or failed reads do not overwrite unread settings and can retry', async () => {
  let raw = '{"rotation":"landscape","immersive":true}';
  const h = fixture({ read: () => Promise.resolve(raw) });
  await assert.rejects(h.store.load(), /Could not load display preferences/);
  assert.equal(h.store.getSnapshot().loaded, false); assert.equal(h.writes.length, 0);
  raw = '{"version":1,"rotation":"portrait","immersive":false}'; await h.store.retry();
  assert.equal(h.store.getSnapshot().rotation, 'portrait'); assert.equal(h.store.getSnapshot().immersive, false);
  assert.equal(h.store.getSnapshot().error, '');
  const synchronous = fixture({ read() { throw new Error('native internal detail'); } });
  await assert.rejects(synchronous.store.load(), /Could not load display preferences/);
  assert.equal(synchronous.store.getSnapshot().loaded, false);
  assert.doesNotMatch(synchronous.store.getSnapshot().error, /internal/);
});

test('setters commit only after durable writes and queued different settings do not overwrite each other', async () => {
  let finish;
  const h = fixture({ write: () => new Promise(resolve => { finish = resolve; }) }); await h.store.load();
  const rotation = h.store.setRotation('portrait'); await settle();
  assert.equal(h.store.getSnapshot().rotation, 'auto'); assert.equal(h.store.getSnapshot().saving, true);
  const immersive = h.store.setImmersive(false); await settle(); assert.equal(h.writes.length, 1);
  finish(); await rotation; await settle();
  assert.equal(h.store.getSnapshot().rotation, 'portrait'); assert.equal(h.writes.length, 2);
  finish(); await immersive;
  const saved = JSON.parse(h.saved);
  assert.equal(saved.rotation, 'portrait'); assert.equal(saved.immersive, false); assert.equal(h.store.getSnapshot().saving, false);
});

test('failed and timed-out writes preserve memory; retry stays behind the older physical write', async () => {
  let fail = true;
  const failed = fixture({ write: async () => { if (fail) throw new Error('storage internal detail'); } }); await failed.store.load();
  await assert.rejects(failed.store.setImmersive(false), /Could not save display preferences/);
  assert.equal(failed.store.getSnapshot().immersive, true); assert.doesNotMatch(failed.store.getSnapshot().error, /internal/);
  fail = false; await failed.store.retry(); assert.equal(failed.store.getSnapshot().immersive, false);

  const pending = []; const h = fixture({ write: () => new Promise(resolve => pending.push(resolve)) }); await h.store.load();
  const first = h.store.setRotation('portrait'); void first.catch(() => {}); await settle();
  h.expire(); await assert.rejects(first, /Could not save display preferences/);
  const retry = h.store.retry(); await settle(); assert.equal(h.writes.length, 1);
  pending.shift()(); await settle(); assert.equal(h.store.getSnapshot().rotation, 'auto'); assert.equal(h.writes.length, 2);
  pending.shift()(); await retry; assert.equal(h.store.getSnapshot().rotation, 'portrait');
});

test('reset invalidates old hydration and reloads the erased account generation', async () => {
  const reads = [];
  const h = fixture({ read: () => new Promise(resolve => reads.push(resolve)) });
  const old = h.store.load(); h.store.reset();
  reads[1](null); await settle();
  reads[0]('{"rotation":"portrait","immersive":false}'); await old;
  assert.equal(h.store.getSnapshot().loaded, true); assert.equal(h.store.getSnapshot().rotation, 'auto'); assert.equal(h.store.getSnapshot().immersive, true);
});

test('deletion-aware queue cannot report a skipped save as successful or resurrect erased preferences', async () => {
  const h = fixture(); await h.store.load(); await h.store.setRotation('portrait');
  await h.persistence.pausePersistenceForAccountDeletion();
  await assert.rejects(h.store.setImmersive(false), /Could not save display preferences/);
  assert.equal(h.store.getSnapshot().immersive, true);
  assert.equal(h.writes.length, 1);
  assert.match(h.UI_PREFERENCES_KEY, /^(?:pips?wise[.\-])/);
  h.erase(); h.store.reset(); h.persistence.resumePersistenceAfterAccountDeletion(); await settle();
  assert.equal(h.store.getSnapshot().rotation, 'auto'); assert.equal(h.store.getSnapshot().immersive, true);
});

test('a timed-out read cannot commit its late value after a newer successful retry', async () => {
  const reads = [];
  const h = fixture({ read: () => new Promise(resolve => reads.push(resolve)) });
  const old = h.store.load(); void old.catch(() => {}); h.expire(); await assert.rejects(old);
  const retry = h.store.retry(); reads[1](null); await retry;
  reads[0]('{"rotation":"portrait","immersive":false}'); await settle();
  assert.equal(h.store.getSnapshot().rotation, 'auto'); assert.equal(h.store.getSnapshot().immersive, true);
});
