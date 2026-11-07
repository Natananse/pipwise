const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const moduleUnderTest = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/tradeChrome.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
  { module: moduleUnderTest, exports: moduleUnderTest.exports, setTimeout, clearTimeout });
const { createTradeChrome } = moduleUnderTest.exports;
function harness() {
  const timers = new Map(); let id = 0;
  const chrome = createTradeChrome((callback, delay) => { assert.equal(delay, 3000); timers.set(++id, callback); return id; }, key => timers.delete(key));
  return { chrome, timers, idle() { const tasks = [...timers.values()]; timers.clear(); tasks.forEach(callback => callback()); } };
}
test('only focused immersive Trade hides after idle; interaction reveals and rearms it', () => {
  const h = harness(); let notifications = 0;
  const unsubscribe = h.chrome.subscribe(() => notifications++);
  h.chrome.configure(true, true); h.idle(); assert.equal(h.chrome.getSnapshot().hidden, true);
  h.chrome.reveal(); assert.equal(h.chrome.getSnapshot().hidden, false); assert.equal(h.timers.size, 1);
  h.chrome.configure(false, true); h.idle(); assert.equal(h.chrome.getSnapshot().hidden, false);
  h.chrome.configure(true, false); h.idle(); assert.equal(h.chrome.getSnapshot().hidden, false);
  unsubscribe(); assert.ok(notifications > 0);
});
test('keyboard and sheets hold bars visible; full-screen and leaving release the timer', () => {
  const h = harness(); h.chrome.configure(true, true, false, true); h.idle(); h.chrome.hide();
  assert.equal(h.chrome.getSnapshot().hidden, false);
  h.chrome.configure(true, true, true); assert.equal(h.chrome.getSnapshot().fullScreen, true);
  h.idle(); assert.equal(h.chrome.getSnapshot().hidden, true);
  h.chrome.release(); assert.equal(h.timers.size, 0); h.idle();
  assert.equal(h.chrome.getSnapshot().active, false);
  assert.equal(h.chrome.getSnapshot().fullScreen, false);
});
