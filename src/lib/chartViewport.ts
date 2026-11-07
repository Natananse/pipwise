/** Fractional candle indices; the first and last centers span count - 1. */
export type ChartViewport = { start: number; count: number };
export type ChartPlotRect = { left: number; top: number; width: number; height: number };
export type ChartCandle = { time: number; open: number; high: number; low: number; close: number };
export type ChartLayout = { left: number; top: number; width: number; height: number; precision: number };

/** A cached, contiguous OHLC interval, including ordered line/average extrema. */
export type ChartBucket = {
  start: number; end: number; open: number; close: number; high: number; low: number;
  minClose: number; maxClose: number; minCloseIndex: number; maxCloseIndex: number;
  firstAverageIndex: number; lastAverageIndex: number;
  minAverage: number; maxAverage: number; minAverageIndex: number; maxAverageIndex: number;
};
export type PreparedChartData = {
  candles: readonly ChartCandle[];
  averages: readonly (number | null)[];
  levels: readonly (readonly ChartBucket[])[];
};
export type ChartGeometry = {
  linePath: string; areaPath: string; averagePath: string;
  upBodyPath: string; downBodyPath: string; upWickPath: string; downWickPath: string;
  low: number; high: number; spacing: number; candleWidth: number; renderedBars: number;
  sourceStart: number; sourceEnd: number; lastIndex: number; lastX: number; lastY: number;
};

function finite(value: number, fallback: number): number {
  'worklet';
  return Number.isFinite(value) ? value : fallback;
}

function dataLength(length: number): number {
  'worklet';
  return Math.max(0, Math.floor(finite(length, 0)));
}

function bound(value: number, low: number, high: number): number {
  'worklet';
  return Math.max(low, Math.min(high, value));
}

/** Preserve the inspected data position when the same plot changes its pixel rectangle. */
export function reprojectInspection(inspection: { active: boolean; x: number; y: number }, previous: ChartPlotRect, next: ChartPlotRect): { active: boolean; x: number; y: number } {
  'worklet';
  if (!inspection.active) return inspection;
  if (!Number.isFinite(previous.left) || !Number.isFinite(previous.top) || !Number.isFinite(next.left) || !Number.isFinite(next.top) || !Number.isFinite(previous.width) || previous.width <= 0 || !Number.isFinite(next.width) || next.width <= 0) return { ...inspection, active: false };
  const ratio = bound((finite(inspection.x, previous.left) - previous.left) / previous.width, 0, 1);
  const vertical = previous.height > 0 && next.height > 0 && Number.isFinite(previous.height) && Number.isFinite(next.height);
  const y = vertical ? next.top + bound((finite(inspection.y, previous.top) - previous.top) / previous.height, 0, 1) * next.height : inspection.y;
  return { active: true, x: next.left + ratio * next.width, y };
}

export function clampViewport(viewport: ChartViewport, length: number): ChartViewport {
  'worklet';
  const total = dataLength(length);
  if (!total) return { start: 0, count: 0 };
  const count = bound(finite(viewport.count, Math.min(12, total)), Math.min(12, total), total);
  return { start: bound(finite(viewport.start, 0), 0, total - count), count };
}

export function initialViewport(length: number, preferred = 80): ChartViewport {
  'worklet';
  const total = dataLength(length);
  const viewport = clampViewport({ start: 0, count: preferred }, total);
  return { start: total - viewport.count, count: viewport.count };
}

/** Scale and translation are relative to the viewport captured at gesture begin. */
export function zoomViewport(viewport: ChartViewport, scale: number, anchorRatio: number, length: number): ChartViewport {
  'worklet';
  const current = clampViewport(viewport, length);
  if (current.count <= 1 || !Number.isFinite(scale) || scale <= 0) return current;
  const ratio = bound(finite(anchorRatio, 0.5), 0, 1);
  const next = clampViewport({ start: 0, count: 1 + (current.count - 1) / scale }, length);
  const anchor = current.start + ratio * (current.count - 1);
  return clampViewport({ start: anchor - ratio * (next.count - 1), count: next.count }, length);
}

export function panViewport(viewport: ChartViewport, translationX: number, plotWidth: number, length: number): ChartViewport {
  'worklet';
  const current = clampViewport(viewport, length);
  if (!Number.isFinite(plotWidth) || plotWidth <= 0 || !Number.isFinite(translationX)) return current;
  return clampViewport({ start: current.start - translationX / plotWidth * Math.max(0, current.count - 1), count: current.count }, length);
}

/** Inclusive start / exclusive end, with neighboring points for clipped lines. */
export function visibleWindow(viewport: ChartViewport, length: number, overscan = 2): { start: number; end: number } {
  'worklet';
  const total = dataLength(length);
  const current = clampViewport(viewport, total);
  if (!total) return { start: 0, end: 0 };
  const extra = Math.max(0, Math.floor(finite(overscan, 0)));
  return {
    start: Math.max(0, Math.floor(current.start) - extra),
    end: Math.min(total, Math.ceil(current.start + current.count) + extra),
  };
}

function mergeBuckets(first: ChartBucket, last: ChartBucket): ChartBucket {
  'worklet';
  const minClose = first.minClose <= last.minClose ? first : last;
  const maxClose = first.maxClose >= last.maxClose ? first : last;
  const minAverage = first.minAverage <= last.minAverage ? first : last;
  const maxAverage = first.maxAverage >= last.maxAverage ? first : last;
  return {
    start: first.start, end: last.end, open: first.open, close: last.close,
    high: Math.max(first.high, last.high), low: Math.min(first.low, last.low),
    minClose: minClose.minClose, maxClose: maxClose.maxClose,
    minCloseIndex: minClose.minCloseIndex, maxCloseIndex: maxClose.maxCloseIndex,
    firstAverageIndex: first.firstAverageIndex >= 0 ? first.firstAverageIndex : last.firstAverageIndex,
    lastAverageIndex: last.lastAverageIndex >= 0 ? last.lastAverageIndex : first.lastAverageIndex,
    minAverage: minAverage.minAverage, maxAverage: maxAverage.maxAverage,
    minAverageIndex: minAverage.minAverageIndex, maxAverageIndex: maxAverage.maxAverageIndex,
  };
}

/** Build once when source data changes, never inside a gesture-frame callback. */
export function prepareChartData(source: readonly ChartCandle[]): PreparedChartData {
  'worklet';
  const candles: ChartCandle[] = [];
  const averages: (number | null)[] = [];
  const base: ChartBucket[] = [];
  let sum = 0;
  for (let index = 0; index < source.length; index += 1) {
    const raw = source[index];
    const close = finite(raw.close, index ? candles[index - 1].close : 0);
    const open = finite(raw.open, close);
    const high = Math.max(finite(raw.high, close), open, close);
    const low = Math.min(finite(raw.low, close), open, close);
    candles.push({ time: finite(raw.time, index), open, high, low, close });
    sum += close;
    if (index >= 7) sum -= candles[index - 7].close;
    const average = index >= 6 ? sum / 7 : null;
    averages.push(average);
    base.push({
      start: index, end: index + 1, open, close, high, low,
      minClose: close, maxClose: close, minCloseIndex: index, maxCloseIndex: index,
      firstAverageIndex: average === null ? -1 : index, lastAverageIndex: average === null ? -1 : index,
      minAverage: average === null ? Infinity : average, maxAverage: average === null ? -Infinity : average,
      minAverageIndex: average === null ? -1 : index, maxAverageIndex: average === null ? -1 : index,
    });
  }
  const levels: ChartBucket[][] = [base];
  let previous = base;
  while (previous.length > 1) {
    const next: ChartBucket[] = [];
    for (let index = 0; index < previous.length; index += 2) {
      next.push(index + 1 < previous.length ? mergeBuckets(previous[index], previous[index + 1]) : previous[index]);
    }
    levels.push(next);
    previous = next;
  }
  return { candles, averages, levels };
}

/** Exact arbitrary interval from the cached hierarchy, O(log(length)) work. */
function rangeBucket(prepared: PreparedChartData, start: number, end: number): ChartBucket {
  'worklet';
  let cursor = start;
  let result: ChartBucket | null = null;
  while (cursor < end) {
    let level = 0;
    let stride = 1;
    while (level + 1 < prepared.levels.length && cursor % (stride * 2) === 0 && cursor + stride * 2 <= end) {
      level += 1;
      stride *= 2;
    }
    const bucket = prepared.levels[level][Math.floor(cursor / stride)];
    result = result === null ? bucket : mergeBuckets(result, bucket);
    cursor += stride;
  }
  // Callers only ask for nonempty, clamped intervals.
  return result as ChartBucket;
}

function coordinate(value: number): number {
  'worklet';
  return Math.round(value * 1000) / 1000;
}

function projectX(index: number, viewport: ChartViewport, layout: ChartLayout): number {
  'worklet';
  return layout.left + (viewport.count > 1 ? (index - viewport.start) / (viewport.count - 1) : 0.5) * layout.width;
}

function projectY(value: number, low: number, high: number, layout: ChartLayout): number {
  'worklet';
  return layout.top + (high - value) / (high - low) * layout.height;
}

function orderedSamples(first: number, minimum: number, maximum: number, last: number): number[] {
  'worklet';
  const middleFirst = Math.min(minimum, maximum);
  const middleLast = Math.max(minimum, maximum);
  const candidates = [first, middleFirst, middleLast, last];
  const result: number[] = [];
  for (let index = 0; index < candidates.length; index += 1) {
    const point = candidates[index];
    if (point >= 0 && (result.length === 0 || point > result[result.length - 1])) result.push(point);
  }
  return result;
}

/**
 * Bounded paths share one fractional projection. Clip paths to layout in the SVG.
 * At most budget OHLC bars and 4 * budget points per continuous line are emitted;
 * exact cached interval aggregation avoids rescanning the full source on frames.
 */
export function buildChartGeometry(prepared: PreparedChartData, viewport: ChartViewport, inputLayout: ChartLayout, average: boolean, budget = 160): ChartGeometry {
  'worklet';
  const length = prepared.candles.length;
  const current = clampViewport(viewport, length);
  const source = visibleWindow(current, length, 0);
  const layout: ChartLayout = {
    left: finite(inputLayout.left, 0), top: finite(inputLayout.top, 0),
    width: Math.max(0, finite(inputLayout.width, 0)), height: Math.max(0, finite(inputLayout.height, 0)),
    precision: bound(Math.floor(finite(inputLayout.precision, 2)), 0, 12),
  };
  const result: ChartGeometry = {
    linePath: '', areaPath: '', averagePath: '', upBodyPath: '', downBodyPath: '', upWickPath: '', downWickPath: '',
    low: 0, high: 1, spacing: 0, candleWidth: 0, renderedBars: 0,
    sourceStart: source.start, sourceEnd: source.end, lastIndex: -1, lastX: 0, lastY: 0,
  };
  if (!length || !layout.width || !layout.height) return result;
  const range = rangeBucket(prepared, source.start, source.end);
  const span = Math.max(range.high - range.low, Math.pow(10, -layout.precision) * 4);
  result.low = range.low - span * 0.08;
  result.high = range.high + span * 0.08;
  // The continuity window includes a neighbor outside a fractional right edge.
  // Mark the final candle center actually inside the viewport, not that neighbor.
  const lastIndex = bound(Math.floor(current.start + current.count - 1), 0, length - 1);
  result.lastIndex = lastIndex;
  result.lastX = projectX(lastIndex, current, layout);
  result.lastY = projectY(prepared.candles[lastIndex].close, result.low, result.high, layout);

  const render = visibleWindow(current, length, 2);
  const renderLength = render.end - render.start;
  const limit = bound(Math.floor(finite(budget, 160)), 1, 512);
  const bucketCount = Math.min(renderLength, limit);
  const rawSpacing = layout.width / Math.max(1, current.count - 1);
  result.spacing = rawSpacing * Math.max(1, Math.floor(renderLength / bucketCount));
  result.candleWidth = Math.min(16, result.spacing * 0.62);
  result.renderedBars = bucketCount;
  let firstLineX = 0;
  let lastLineX = 0;
  for (let index = 0; index < bucketCount; index += 1) {
    const start = render.start + Math.floor(index * renderLength / bucketCount);
    const end = render.start + Math.floor((index + 1) * renderLength / bucketCount);
    const bucket = rangeBucket(prepared, start, end);
    const x = coordinate(projectX((start + end - 1) / 2, current, layout));
    const openY = coordinate(projectY(bucket.open, result.low, result.high, layout));
    const closeY = coordinate(projectY(bucket.close, result.low, result.high, layout));
    const highY = coordinate(projectY(bucket.high, result.low, result.high, layout));
    const lowY = coordinate(projectY(bucket.low, result.low, result.high, layout));
    const left = coordinate(x - result.candleWidth / 2);
    const right = coordinate(x + result.candleWidth / 2);
    const top = Math.min(openY, closeY);
    const bottom = Math.max(top + Math.min(1.5, layout.height), Math.max(openY, closeY));
    const body = `M${left},${top}L${right},${top}L${right},${bottom}L${left},${bottom}Z`;
    const wick = `M${x},${highY}L${x},${lowY}`;
    if (bucket.close >= bucket.open) { result.upBodyPath += body; result.upWickPath += wick; }
    else { result.downBodyPath += body; result.downWickPath += wick; }

    const closePoints = orderedSamples(bucket.start, bucket.minCloseIndex, bucket.maxCloseIndex, bucket.end - 1);
    for (let point = 0; point < closePoints.length; point += 1) {
      const sourceIndex = closePoints[point];
      const pointX = coordinate(projectX(sourceIndex, current, layout));
      const pointY = coordinate(projectY(prepared.candles[sourceIndex].close, result.low, result.high, layout));
      if (!result.linePath) firstLineX = pointX;
      lastLineX = pointX;
      result.linePath += `${result.linePath ? 'L' : 'M'}${pointX},${pointY}`;
    }
    if (average && bucket.firstAverageIndex >= 0) {
      const averagePoints = orderedSamples(bucket.firstAverageIndex, bucket.minAverageIndex, bucket.maxAverageIndex, bucket.lastAverageIndex);
      for (let point = 0; point < averagePoints.length; point += 1) {
        const sourceIndex = averagePoints[point];
        const value = prepared.averages[sourceIndex] as number;
        result.averagePath += `${result.averagePath ? 'L' : 'M'}${coordinate(projectX(sourceIndex, current, layout))},${coordinate(projectY(value, result.low, result.high, layout))}`;
      }
    }
  }
  if (result.linePath) result.areaPath = `${result.linePath}L${lastLineX},${coordinate(layout.top + layout.height)}L${firstLineX},${coordinate(layout.top + layout.height)}Z`;
  return result;
}
