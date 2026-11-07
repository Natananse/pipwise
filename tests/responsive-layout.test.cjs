const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const moduleUnderTest = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/responsiveLayout.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { module: moduleUnderTest, exports: moduleUnderTest.exports });
const { responsiveLayout, fitChartHeight, focusedFieldScrollOffset } = moduleUnderTest.exports;

test('safe-area dimensions distinguish short landscape and narrow portrait without storing a stale window', () => {
  const portrait = responsiveLayout({ width: 390, height: 844, insets: { top: 44, bottom: 34 } });
  assert.equal(portrait.compactHeight, false);
  const landscape = responsiveLayout({ width: 844, height: 390, insets: { left: 44, right: 44, bottom: 21 } });
  assert.equal(landscape.usableWidth, 756);
  assert.equal(landscape.usableHeight, 369);
  assert.equal(landscape.landscape, true);
  assert.equal(landscape.compactHeight, true);
  assert.equal(responsiveLayout({ width: 320, height: 450 }).compactHeight, true, 'a short split window also needs compact spacing');
  assert.equal(responsiveLayout({ width: 900, height: 600 }).compactHeight, false, 'landscape alone does not require compact spacing');
});

test('chart height stays within available space even below its preferred minimum', () => {
  assert.equal(fitChartHeight(230, 390), 230);
  assert.equal(fitChartHeight(800, 390), 390);
  assert.equal(fitChartHeight(90, 390), 90);
  assert.equal(fitChartHeight(400, 50, 160), 160);
  assert.equal(fitChartHeight(-10, 390), 0);
  assert.equal(fitChartHeight(NaN, 390), 0);
});

test('focus visibility adjusts only the obscured edge and handles tall multiline fields', () => {
  const frame = { offset: 100, viewportTop: 40, viewportHeight: 180 };
  assert.equal(focusedFieldScrollOffset({ ...frame, fieldTop: 80, fieldHeight: 50 }), 100);
  assert.equal(focusedFieldScrollOffset({ ...frame, fieldTop: 190, fieldHeight: 50 }), 128);
  assert.equal(focusedFieldScrollOffset({ ...frame, fieldTop: 20, fieldHeight: 50 }), 72);
  assert.equal(focusedFieldScrollOffset({ ...frame, fieldTop: 90, fieldHeight: 240 }), 142, 'oversized input starts at the top instead of hiding its beginning');
  assert.equal(focusedFieldScrollOffset({ ...frame, offset: 0, fieldTop: 0, fieldHeight: 50 }), 0);
  assert.equal(focusedFieldScrollOffset({ ...frame, viewportHeight: 0, fieldTop: 190, fieldHeight: 50 }), 100);
});
