const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { module, exports: module.exports, require(name) { assert.ok(name in imports, name); return imports[name]; } });
  return module.exports;
}
const layout = load('src/lib/tradingLayout.ts');
const market = load('src/lib/market.ts');
const simulator = load('src/lib/simulator.ts', { './market': market });
const { estimateOrderRisk } = load('src/lib/orderRisk.ts', { './market': market, './simulator': simulator });

test('small landscape splits respect cutouts and leave the chart independent of panel content', () => {
  for (const [width, height] of [[568, 320], [640, 360], [844, 390], [1280, 800]]) {
    const result = layout.tradingLayout({ width, height, insets: { top: 8, bottom: 24, left: 44, right: 16 }, landscape: true });
    assert.equal(result.chartWidth + result.panelWidth, width - 60);
    assert.ok(result.panelWidth >= result.usableWidth * 0.35);
    assert.ok(result.panelWidth <= result.usableWidth * 0.45);
    assert.equal(result.usableHeight, height - 32);
  }
});
test('portrait and fullscreen give the chart available width; large type gets more panel room', () => {
  const input = { width: 844, height: 390, insets: { top: 0, bottom: 24, left: 44, right: 0 }, landscape: true };
  const normal = layout.tradingLayout(input);
  assert.equal(layout.tradingLayout({ ...input, fullScreen: true }).chartWidth, 800);
  assert.ok(layout.tradingLayout({ ...input, fontScale: 2 }).panelWidth >= normal.panelWidth);
  assert.equal(layout.tradingLayout({ ...input, landscape: false }).chartWidth, 800);
});
test('the keyboard cannot change layout orientation; rotating with the keyboard still updates it', () => {
  const portrait = { width: 390, height: 844 };
  assert.equal(layout.tradingLandscape(390, 240, true, portrait), false);
  assert.equal(layout.tradingLandscape(844, 170, true, portrait), true);
  assert.equal(layout.tradingLandscape(390, 120, true, { width: 844, height: 390 }), false);
  assert.equal(layout.tradingLandscape(844, 390, false, portrait), true);
});
test('manual-target risk uses simulator P&L plus entry and closing fees for buys and sells', () => {
  const asset = { ...market.assets[0], price: 100 };
  for (const [direction, stop] of [['buy', 99], ['sell', 101]]) {
    const result = estimateOrderRisk(asset, direction, 10, stop, 1000);
    assert.ok('amount' in result);
    const expected = 10 + 1000 * simulator.feeRate + stop * 10 * simulator.feeRate;
    assert.ok(Math.abs(result.amount - expected) < 1e-9);
    assert.equal(result.band, 'amber');
  }
});
test('USD/JPY risk converts yen loss at the target instead of treating yen as dollars', () => {
  const asset = { ...market.assets.find(item => item.symbol === 'USD/JPY'), price: 150 };
  const result = estimateOrderRisk(asset, 'buy', 1000, 148.5, 10000);
  assert.ok('amount' in result);
  assert.ok(Math.abs(result.amount - (1500 / 148.5 + 0.4)) < 1e-9);
});
test('missing or invalid targets never display zero or safe risk', () => {
  const asset = market.assets[0];
  for (const args of [[0, 1, 10000], [1, undefined, 10000], [1, NaN, 10000], [1, asset.price + 1, 10000], [1, 1, 0]]) {
    const result = estimateOrderRisk(asset, 'buy', ...args);
    assert.ok('reason' in result);
    assert.ok(!('percent' in result));
  }
});
