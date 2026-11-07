const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
function fixture() {
  const timers = new Map(); let sequence = 0;
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/orientationPolicy.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { module, exports: module.exports,
    setTimeout(callback) { const id = ++sequence; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); } });
  return { ...module.exports, timers };
}
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
const ready = { publicRoute: false, startupCovered: false, onboardingRoute: false, onboardingPreviewActive: false, setupComplete: true, preferencesLoaded: true, rotation: 'auto' };

test('startup, replay, incomplete setup, preview and preference loading retain portrait ownership', () => {
  const { desiredOrientation } = fixture();
  assert.equal(desiredOrientation(ready), 'auto');
  assert.equal(desiredOrientation({ ...ready, rotation: 'portrait' }), 'portrait');
  for (const override of [{ startupCovered: true }, { onboardingRoute: true }, { onboardingPreviewActive: true }, { setupComplete: false }, { preferencesLoaded: false }]) {
    assert.equal(desiredOrientation({ ...ready, ...override }), 'portrait');
  }
  assert.equal(desiredOrientation({ ...ready, publicRoute: true, startupCovered: true, setupComplete: false, onboardingPreviewActive: true }), 'auto');
  assert.equal(desiredOrientation({ ...ready, publicRoute: true, preferencesLoaded: false }), 'portrait');
});

test('one physical native operation runs at a time and newer intent wins after an old request completes', async () => {
  const { createOrientationController } = fixture();
  const pending = [], calls = [], states = [];
  const owner = createOrientationController(policy => new Promise(resolve => { calls.push(policy); pending.push(resolve); }), state => states.push(state));
  owner.request('portrait'); owner.request('auto');
  assert.deepEqual(calls, ['portrait']);
  pending.shift()(); await settle();
  assert.deepEqual(calls, ['portrait', 'auto']);
  owner.request('portrait');
  pending.shift()(); await settle();
  assert.deepEqual(calls, ['portrait', 'auto', 'portrait']);
  pending.shift()(); await settle();
  assert.equal(states.at(-1).applied, 'portrait');
  assert.equal(states.at(-1).pending, false);
  owner.dispose();
});

test('rapid superseded choices coalesce and foreground reapplies the latest policy', async () => {
  const { createOrientationController } = fixture();
  const calls = [], pending = [];
  const owner = createOrientationController(policy => new Promise(resolve => { calls.push(policy); pending.push(resolve); }));
  owner.request('portrait'); owner.request('auto'); owner.request('portrait');
  pending.shift()(); await settle();
  assert.deepEqual(calls, ['portrait']);
  owner.setActive(false); owner.request('auto');
  assert.deepEqual(calls, ['portrait']);
  owner.setActive(true); assert.deepEqual(calls, ['portrait', 'auto']);
  pending.shift()(); await settle();
  owner.setActive(false); owner.setActive(true);
  assert.deepEqual(calls, ['portrait', 'auto', 'auto']);
  pending.shift()(); await settle(); owner.dispose();
});

test('native failures are sanitized and retryable without an automatic rejection loop', async () => {
  const { createOrientationController } = fixture();
  const calls = [], states = []; let failing = true;
  const owner = createOrientationController(async policy => { calls.push(policy); if (failing) throw new Error('internal native detail'); }, state => states.push(state));
  owner.request('auto'); await settle();
  assert.equal(calls.length, 1);
  assert.match(states.at(-1).error, /Rotation could not be updated/);
  assert.doesNotMatch(states.at(-1).error, /internal native detail/);
  failing = false; owner.retry(); await settle();
  assert.equal(calls.length, 2); assert.equal(states.at(-1).applied, 'auto'); assert.equal(states.at(-1).error, '');
  owner.dispose();
});

test('a stalled native request reports a bounded error without overlapping requests or restoring on disposal', async () => {
  const { createOrientationController, timers } = fixture();
  const calls = [], states = []; let finish;
  const owner = createOrientationController(policy => new Promise(resolve => { calls.push(policy); finish = resolve; }), state => states.push(state));
  owner.request('portrait');
  [...timers.values()].forEach(callback => callback());
  assert.match(states.at(-1).error, /Rotation could not be updated/);
  owner.request('auto'); assert.deepEqual(calls, ['portrait']);
  owner.dispose(); assert.equal(timers.size, 0);
  const publications = states.length;
  finish(); await settle();
  assert.equal(states.length, publications); assert.deepEqual(calls, ['portrait']);
});
