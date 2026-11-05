const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function startupTasks() {
  const timers = new Map();
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/startupTasks.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    module, exports: module.exports, Promise,
    setTimeout: (callback, delay) => {
      const timer = {};
      timers.set(timer, { callback, delay });
      return timer;
    },
    clearTimeout: timer => timers.delete(timer),
  });
  return {
    ...module.exports,
    timers,
    expire: () => {
      for (const [timer, { callback }] of [...timers]) {
        timers.delete(timer);
        callback();
      }
    },
  };
}

test('a startup read that never settles rejects with a recoverable timeout', async () => {
  const { withStartupTimeout, StartupTimeoutError, timers, expire } = startupTasks();
  const pendingRead = new Promise(() => {});
  const result = withStartupTimeout(pendingRead, 'Saved workspace is taking too long.', 5);
  assert.equal([...timers.values()][0].delay, 5);
  const rejected = assert.rejects(result, error => error instanceof StartupTimeoutError && error.name === 'StartupTimeoutError'
    && error.message === 'Saved workspace is taking too long.');
  expire();
  await rejected;
  assert.equal(timers.size, 0);
});

test('successful reads preserve the saved value and clear the deadline', async () => {
  const { withStartupTimeout, timers } = startupTasks();
  const saved = { wallet: { cash: 7400 }, language: 'ar', completed: ['lesson-1'] };
  const result = withStartupTimeout(Promise.resolve(saved), 'Timed out.');
  assert.equal([...timers.values()][0].delay, 10000);
  assert.equal(await result, saved);
  assert.equal(timers.size, 0);
});

test('storage failures retain their original error and clear the deadline', async () => {
  const { withStartupTimeout, timers } = startupTasks();
  const failure = new Error('Storage is unavailable.');
  await assert.rejects(withStartupTimeout(Promise.reject(failure), 'Timed out.'), error => error === failure);
  assert.equal(timers.size, 0);
});

test('a late read cannot commit a value after its startup attempt timed out', async () => {
  const { withStartupTimeout, expire } = startupTasks();
  let completeRead;
  let committed = false;
  const read = new Promise(resolve => { completeRead = resolve; });
  const attempt = withStartupTimeout(read, 'Read timed out.', 1).then(() => { committed = true; });
  const rejected = assert.rejects(attempt, /Read timed out/);
  expire();
  await rejected;
  completeRead({ wallet: { cash: 1500 } });
  await read;
  await Promise.resolve();
  assert.equal(committed, false);
});

test('a late rejection is consumed and a fresh retry can restore saved data', async () => {
  const { withStartupTimeout, timers, expire } = startupTasks();
  let failRead;
  const firstRead = new Promise((_resolve, reject) => { failRead = reject; });
  const firstAttempt = withStartupTimeout(firstRead, 'Read timed out.', 1);
  const rejected = assert.rejects(firstAttempt, /Read timed out/);
  expire();
  await rejected;
  failRead(new Error('Original read failed after the deadline.'));
  await Promise.resolve();
  const saved = { wallet: { cash: 4321 }, preferences: { experience: 'Intermediate' } };
  assert.equal(await withStartupTimeout(Promise.resolve(saved), 'Retry timed out.', 5), saved);
  assert.equal(timers.size, 0);
});
