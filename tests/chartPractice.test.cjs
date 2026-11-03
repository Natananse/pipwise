const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function load(file, imports = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { module, exports: module.exports, require: name => imports[name], Date, Math, Number });
  return module.exports;
}
const market = load('src/lib/market.ts');
const { chartPracticeRound, practiceRoundCount } = load('src/lib/chartPractice.ts', { './market': market });

test('the ten chart exercises are deterministic and have distinct persistent identifiers', () => {
  const ids = new Set();
  assert.equal(practiceRoundCount, 10);
  for (let index = 0; index < practiceRoundCount; index += 1) {
    const round = chartPracticeRound(index);
    ids.add(round.id);
    assert.equal(JSON.stringify(round), JSON.stringify(chartPracticeRound(index)));
    assert.ok(market.assets.some(asset => asset.symbol === round.asset.symbol));
  }
  assert.equal(ids.size, practiceRoundCount);
});

test('future exercise candles follow the visible chart without leaking into its history', () => {
  for (let index = 0; index < practiceRoundCount; index += 1) {
    const round = chartPracticeRound(index);
    assert.equal(round.visible.length, 48);
    assert.equal(round.future.length, 5);
    assert.ok(round.visible.at(-1).time < round.future[0].time);
    assert.equal(round.entry, round.visible.at(-1).close);
    assert.equal(round.future[0].open, round.entry);
    const visibleTimes = new Set(round.visible.map(candle => candle.time));
    assert.ok(round.future.every(candle => !visibleTimes.has(candle.time)));
    const all = [...round.visible, ...round.future];
    assert.ok(all.every((candle, i) => i === 0 || candle.time > all[i - 1].time));
  }
});

test('the answer uses the fifth revealed close and includes both up and down outcomes', () => {
  const results = new Set();
  for (let index = 0; index < practiceRoundCount; index += 1) {
    const round = chartPracticeRound(index);
    assert.equal(round.exit, round.future.at(-1).close);
    assert.equal(round.result, round.exit >= round.entry ? 'up' : 'down');
    assert.ok(Number.isFinite(round.exit / round.entry));
    results.add(round.result);
  }
  assert.equal(results.size, 2);
});
