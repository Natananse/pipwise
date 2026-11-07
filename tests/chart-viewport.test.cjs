const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const moduleUnderTest = { exports: {} };
const source = fs.readFileSync('src/lib/chartViewport.ts', 'utf8');
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { module: moduleUnderTest, exports: moduleUnderTest.exports, Number, Math });
const { clampViewport, initialViewport, zoomViewport, panViewport, visibleWindow, prepareChartData, buildChartGeometry } = moduleUnderTest.exports;
const plain = value => JSON.parse(JSON.stringify(value));
const near = (actual, expected, epsilon = 1e-9) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
const layout = { left: 8, top: 16, width: 300, height: 240, precision: 2 };
const candles = (length, close = index => index + 1) => Array.from({ length }, (_, index) => {
  const value = close(index);
  return { time: index * 60000, open: value - 0.25, close: value, high: value + 2, low: value - 2 };
});
function points(path) {
  return [...path.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map(match => ({ x: Number(match[1]), y: Number(match[2]) }));
}
function assertBounded(viewport, length) {
  assert.ok(viewport.start >= 0);
  assert.ok(viewport.count >= Math.min(12, length));
  assert.ok(viewport.count <= length);
  assert.ok(viewport.start + viewport.count <= length + 1e-9);
}

test('viewport initialization and clamps handle empty, short, fractional and shrinking data', () => {
  assert.deepEqual(plain(initialViewport(0)), { start: 0, count: 0 });
  assert.deepEqual(plain(initialViewport(7)), { start: 0, count: 7 });
  assert.deepEqual(plain(initialViewport(120)), { start: 40, count: 80 });
  assert.deepEqual(plain(clampViewport({ start: 70.25, count: 20.5 }, 100)), { start: 70.25, count: 20.5 });
  assert.deepEqual(plain(clampViewport({ start: 80, count: 24 }, 10)), { start: 0, count: 10 });
  assert.deepEqual(plain(clampViewport({ start: Infinity, count: NaN }, 50)), { start: 0, count: 12 });
  assert.deepEqual(plain(clampViewport({ start: -30, count: 500 }, 50)), { start: 0, count: 50 });
  assert.deepEqual(plain(clampViewport({ start: 50, count: -20 }, 50)), { start: 38, count: 12 });
});

test('pinch zoom preserves the fractional candle under the focal point and reciprocal scales', () => {
  const viewport = { start: 200.5, count: 100 };
  for (const ratio of [0, 0.17, 0.5, 0.93, 1]) {
    const next = zoomViewport(viewport, 2, ratio, 1000);
    near(next.count, 50.5);
    near(next.start + ratio * (next.count - 1), viewport.start + ratio * (viewport.count - 1));
    const restored = zoomViewport(next, 0.5, ratio, 1000);
    near(restored.start, viewport.start);
    near(restored.count, viewport.count);
  }
  assert.deepEqual(plain(zoomViewport(viewport, 1, 0.33, 1000)), viewport);
  for (const scale of [0, -1, NaN, Infinity]) assert.deepEqual(plain(zoomViewport(viewport, scale, 0.5, 1000)), viewport);
});

test('zoom and pan stop at data boundaries without a forced return to the newest candle', () => {
  const viewport = { start: 200, count: 80 };
  const zoomed = zoomViewport(viewport, 1.5, 0.5, 1000);
  assert.ok(zoomed.start < 300);
  assert.ok(zoomed.start + zoomed.count < 400);
  assert.deepEqual(plain(zoomViewport(viewport, 0.001, 0.5, 1000)), { start: 0, count: 1000 });
  assert.deepEqual(plain(panViewport(viewport, 100000, 300, 1000)), { start: 0, count: 80 });
  assert.deepEqual(plain(panViewport(viewport, -100000, 300, 1000)), { start: 920, count: 80 });
  const minimum = zoomViewport(viewport, 100000, 0.23, 1000);
  assert.equal(minimum.count, 12);
  assertBounded(minimum, 1000);
});

test('pan uses the same center span as zoom and is independent of screen width', () => {
  const viewport = { start: 400.25, count: 80.5 };
  const next = panViewport(viewport, 30, 300, 1000);
  near(next.start, 392.3);
  near(next.count, viewport.count);
  near(panViewport(viewport, 60, 600, 1000).start, next.start);
  near(panViewport(next, -30, 300, 1000).start, viewport.start);
  for (const width of [0, -1, NaN, Infinity]) assert.deepEqual(plain(panViewport(viewport, 30, width, 1000)), viewport);
});

test('visible window has bounded integer exclusive bounds even after external history shrinks', () => {
  assert.deepEqual(plain(visibleWindow({ start: 30.25, count: 12.5 }, 100)), { start: 28, end: 45 });
  assert.deepEqual(plain(visibleWindow({ start: 30, count: 12 }, 100, 0)), { start: 30, end: 42 });
  assert.deepEqual(plain(visibleWindow({ start: 80, count: 24 }, 10)), { start: 0, end: 10 });
  assert.deepEqual(plain(visibleWindow({ start: 80, count: 24 }, 0)), { start: 0, end: 0 });
  for (const length of [1, 7, 12, 13, 100, 10000]) {
    for (const start of [-20, 0, 0.5, 60.5, 9000]) {
      const window = visibleWindow({ start, count: 39.25 }, length, 2);
      assert.ok(Number.isInteger(window.start) && Number.isInteger(window.end));
      assert.ok(window.start >= 0 && window.end <= length && window.start < window.end);
    }
  }
});

test('prepared seven-period averages use the full history before a visible window', () => {
  const prepared = prepareChartData(candles(120));
  assert.ok(prepared.averages.slice(0, 6).every(value => value === null));
  near(prepared.averages[6], 4);
  near(prepared.averages[70], 68);
  const viewport = { start: 70.25, count: 24 };
  const geometry = buildChartGeometry(prepared, viewport, layout, true, 160);
  const averagePoints = points(geometry.averagePath);
  const rendered = visibleWindow(viewport, 120);
  assert.equal(averagePoints.length, rendered.end - rendered.start);
  assert.equal((geometry.averagePath.match(/M/g) || []).length, 1);
  // The first overscan bar already has an MA; it does not wait six visible bars.
  near(averagePoints[0].x, layout.left + (rendered.start - viewport.start) / (viewport.count - 1) * layout.width, 0.00051);
  for (const point of averagePoints) {
    const index = Math.round(viewport.start + (point.x - layout.left) / layout.width * (viewport.count - 1));
    const expected = prepared.candles.slice(index - 6, index + 1).reduce((sum, candle) => sum + candle.close, 0) / 7;
    near(geometry.high - (point.y - layout.top) / layout.height * (geometry.high - geometry.low), expected, 0.001);
  }
  assert.equal(buildChartGeometry(prepared, viewport, layout, false).averagePath, '');
});

test('price, average, body, wick and last-visible point use one projection', () => {
  const prepared = prepareChartData(candles(120));
  const viewport = { start: 40, count: 24 };
  const geometry = buildChartGeometry(prepared, viewport, layout, true, 160);
  assert.deepEqual({ start: geometry.sourceStart, end: geometry.sourceEnd }, { start: 40, end: 64 });
  near(geometry.lastX, layout.left + layout.width);
  near(geometry.lastY, layout.top + (geometry.high - prepared.candles[63].close) / (geometry.high - geometry.low) * layout.height);
  assert.ok(geometry.areaPath.startsWith(geometry.linePath));
  assert.ok(geometry.areaPath.endsWith('Z'));
  const line = points(geometry.linePath);
  assert.ok(line[0].x < layout.left && line.at(-1).x > layout.left + layout.width, 'overscan must be clipped by renderer, not projected into the plot');
  const wickPoints = points(geometry.upWickPath);
  const candle40 = (40 - visibleWindow(viewport, 120).start) * 2;
  near(wickPoints[candle40].x, layout.left, 0.00051);
  assert.ok(geometry.candleWidth <= 0.7 * geometry.spacing);
});

test('fractional panning marks the last visible raw candle instead of its clipped neighbor', () => {
  const prepared = prepareChartData(candles(120));
  for (const start of [40.01, 40.25, 40.75, 40.99]) {
    const viewport = { start, count: 24 };
    const geometry = buildChartGeometry(prepared, viewport, layout, false);
    assert.equal(geometry.lastIndex, 63);
    assert.equal(geometry.sourceEnd, 65, 'continuity window still carries the neighbor');
    assert.ok(geometry.lastX >= layout.left && geometry.lastX <= layout.left + layout.width);
    near(geometry.lastX, layout.left + (63 - start) / 23 * layout.width);
    near(geometry.lastY, layout.top + (geometry.high - prepared.candles[63].close) / (geometry.high - geometry.low) * layout.height);
  }
});

test('coarse OHLC buckets retain first open, last close and wick extrema', () => {
  const prepared = prepareChartData(candles(20));
  const geometry = buildChartGeometry(prepared, { start: 0, count: 20 }, layout, false, 2);
  const wicks = points(geometry.upWickPath);
  const bodies = points(geometry.upBodyPath);
  const price = y => geometry.high - (y - layout.top) / layout.height * (geometry.high - geometry.low);
  near(price(wicks[0].y), 12, 0.001);
  near(price(wicks[1].y), -1, 0.001);
  near(price(bodies[0].y), 10, 0.001);
  near(price(bodies[2].y), 0.75, 0.001);
  near(price(wicks[2].y), 22, 0.001);
  near(price(wicks[3].y), 9, 0.001);
  near(price(bodies[4].y), 20, 0.001);
  near(price(bodies[6].y), 10.75, 0.001);
});

test('ten thousand candles retain close and OHLC extrema with a bounded continuous path', () => {
  const source = candles(10000, index => 100 + Math.sin(index / 17));
  source[173].close = 700;
  source[173].high = 900;
  source[4313].close = -500;
  source[4313].low = -800;
  const prepared = prepareChartData(source);
  const viewport = { start: 0, count: 10000 };
  const geometry = buildChartGeometry(prepared, viewport, layout, true, 80);
  assert.equal(geometry.renderedBars, 80);
  near(geometry.low, -800 - (900 + 800) * 0.08);
  near(geometry.high, 900 + (900 + 800) * 0.08);
  const line = points(geometry.linePath);
  const average = points(geometry.averagePath);
  assert.ok(line.length <= 4 * 80);
  assert.ok(average.length <= 4 * 80);
  assert.equal((geometry.linePath.match(/M/g) || []).length, 1);
  assert.equal((geometry.averagePath.match(/M/g) || []).length, 1);
  const expectedX = index => layout.left + index / 9999 * layout.width;
  assert.ok(line.some(point => Math.abs(point.x - expectedX(173)) < 0.00051));
  assert.ok(line.some(point => Math.abs(point.x - expectedX(4313)) < 0.00051));
  assert.ok(line.every((point, index) => index === 0 || point.x >= line[index - 1].x));
  assert.equal((geometry.upBodyPath + geometry.downBodyPath).split('Z').length - 1, 80);
  assert.ok(geometry.candleWidth <= 0.7 * geometry.spacing);
  assert.ok(prepared.levels.reduce((total, level) => total + level.length, 0) < source.length * 2 + 20);
});

test('frame geometry accesses bounded cached data instead of scanning ten thousand raw bars', () => {
  const prepared = prepareChartData(candles(10000, index => 100 + Math.sin(index)));
  let rawReads = 0;
  let averageReads = 0;
  const guarded = {
    ...prepared,
    candles: new Proxy(prepared.candles, { get(target, key) { if (/^\d+$/.test(String(key))) rawReads += 1; return target[key]; } }),
    averages: new Proxy(prepared.averages, { get(target, key) { if (/^\d+$/.test(String(key))) averageReads += 1; return target[key]; } }),
  };
  const geometry = buildChartGeometry(guarded, { start: 0, count: 10000 }, layout, true, 80);
  assert.ok(geometry.linePath && geometry.averagePath);
  assert.ok(rawReads <= 4 * 80 + 1, `${rawReads} raw reads`);
  assert.ok(averageReads <= 4 * 80, `${averageReads} average reads`);
});

test('coarse boundary buckets exclude extreme candles outside the visible source interval', () => {
  const source = candles(10000, () => 100);
  source[3999].high = 100000;
  source[4100].low = -100000;
  const prepared = prepareChartData(source);
  const geometry = buildChartGeometry(prepared, { start: 4000, count: 100 }, layout, false, 7);
  near(geometry.low, 98 - 4 * 0.08);
  near(geometry.high, 102 + 4 * 0.08);
  assert.equal(geometry.renderedBars, 7);
  assert.ok(points(geometry.linePath).length <= 28);
});

test('narrow layouts, flat prices, small series, empty data and shrink never produce invalid paths', () => {
  for (const length of [0, 1, 5, 12, 120]) {
    const prepared = prepareChartData(candles(length, () => 1));
    for (const width of [0, 0.25, 8, 190]) {
      const geometry = buildChartGeometry(prepared, { start: 999, count: 80 }, { ...layout, width, precision: 5 }, true, 8);
      for (const key of ['linePath', 'areaPath', 'averagePath', 'upBodyPath', 'downBodyPath', 'upWickPath', 'downWickPath']) {
        assert.ok(!/NaN|Infinity|undefined/.test(geometry[key]), `${length}/${width}: ${key}`);
      }
      assert.ok(geometry.candleWidth <= geometry.spacing * 0.7);
      assert.ok(geometry.sourceStart >= 0 && geometry.sourceEnd <= length);
      assert.ok(Number.isFinite(geometry.low) && Number.isFinite(geometry.high) && geometry.high > geometry.low);
    }
  }
});

test('all functions reachable from worklets retain the worklet directive', () => {
  const tree = ts.createSourceFile('chartViewport.ts', source, ts.ScriptTarget.Latest, true);
  for (const statement of tree.statements) {
    if (!ts.isFunctionDeclaration(statement)) continue;
    const directive = statement.body.statements[0];
    assert.ok(ts.isExpressionStatement(directive) && ts.isStringLiteral(directive.expression) && directive.expression.text === 'worklet', statement.name.text);
  }
});
