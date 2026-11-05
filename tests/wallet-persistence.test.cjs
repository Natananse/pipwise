const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
function load(file, imports = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { module, exports: module.exports, require: name => imports[name], Date, Set });
  return module.exports;
}
const market = load('src/lib/market.ts');
const simulator = load('src/lib/simulator.ts', { './market': market });
const { isSavedWallet } = load('src/lib/walletPersistence.ts', { './market': market });
const copy = value => JSON.parse(JSON.stringify(value));

test('current and original fixed-price wallets restore with their fees and results intact', () => {
  for (const options of [undefined, { pricingSource: 'moving-demo-v1' }]) {
    const opened = simulator.openOrder(simulator.initialWallet, market.assets[0], 'buy', 100, undefined, undefined, options);
    assert.equal(isSavedWallet(copy(opened)), true);
    const closed = simulator.closePosition(opened, opened.positions[0].id, market.assets[0].price);
    assert.equal(isSavedWallet(copy(closed)), true);
    if (!options) {
      delete closed.history[0].exit; // The original simulator did not persist exit prices.
      assert.equal(isSavedWallet(copy(closed)), true);
    }
  }
  assert.equal(isSavedWallet(copy(simulator.initialWallet)), true);
});

test('malformed saved positions cannot reach chart, P&L or close-order calculations', () => {
  const opened = simulator.openOrder(simulator.initialWallet, market.assets[0], 'buy', 100);
  for (const patch of [
    { id: '' }, { symbol: 'UNKNOWN' }, { direction: 'hold' }, { quantity: 0 }, { quantity: -1 },
    { quantity: null }, { entry: null }, { entry: -1 }, { fee: null }, { fee: -1 },
    { opened: 'invalid' }, { stopLoss: 0 }, { takeProfit: -1 }, { pricingSource: 'provider' },
    { closed: '2026-11-05T07:00:00Z' }, { pnl: 0 }, { exit: 1 },
  ]) {
    const wallet = copy(opened);
    Object.assign(wallet.positions[0], patch);
    assert.equal(isSavedWallet(wallet), false, JSON.stringify(patch));
  }
  for (const position of [null, 1, [], {}, { id: 'partial' }]) {
    assert.equal(isSavedWallet({ ...copy(opened), positions: [position] }), false);
  }
  const overflow = copy(opened);
  overflow.positions[0].quantity = Number.MAX_VALUE;
  assert.equal(isSavedWallet(overflow), false);
});

test('closed results require usable dates and net P&L and reject duplicate trade identities', () => {
  const opened = simulator.openOrder(simulator.initialWallet, market.assets[0], 'sell', 100);
  const closed = simulator.closePosition(opened, opened.positions[0].id);
  for (const patch of [{ closed: undefined }, { closed: 'invalid' }, { pnl: undefined }, { pnl: null }, { exit: 0 }]) {
    const wallet = copy(closed);
    Object.assign(wallet.history[0], patch);
    assert.equal(isSavedWallet(wallet), false);
  }
  assert.equal(isSavedWallet({ ...copy(opened), history: copy(closed.history) }), false);
  assert.equal(isSavedWallet({ ...copy(opened), positions: [...copy(opened.positions), ...copy(opened.positions)] }), false);
});
