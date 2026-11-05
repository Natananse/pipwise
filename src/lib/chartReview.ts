import type { Candle } from './market';
import { marketTimeframes, timeframeMilliseconds, type MarketTimeframe } from './marketTypes';

export const reviewStrategies = ['ICT', 'SMC', 'MSNR'] as const;
export type ReviewStrategy = typeof reviewStrategies[number];
export type ReviewInput = { symbol: string; timeframe: MarketTimeframe; strategy: ReviewStrategy; context: string };
export type ReviewLevel = { label: string; price: number };
export type FileReview = {
  title: string; source: string; lastClosedAt: number; candlesUsed: number;
  observations: string[]; levels: ReviewLevel[]; scenarios: string[]; limitations: string[];
};
export const maxReviewTextBytes = 1024 * 1024;

function timestamp(value: unknown): number {
  if (typeof value === 'number' || typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value)) {
    const number = Number(value);
    return number < 1e12 ? number * 1000 : number;
  }
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/i.test(value)) return NaN;
  const date = value.slice(0, 10);
  const [year, month, day] = date.split('-').map(Number);
  if (new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) !== date) return NaN;
  return Date.parse(value);
}

/** A strict OHLC import: no invented bars, timezone guesses, or silent bad rows. */
export function parseReviewCandles(text: string, now = Date.now()): Candle[] {
  if (!text.trim() || new TextEncoder().encode(text).length > maxReviewTextBytes) throw new Error('Choose an OHLC CSV or JSON file under 1 MB.');
  let rows: unknown[];
  if (/^[\s\uFEFF]*[\[{]/.test(text)) {
    let value: unknown;
    try { value = JSON.parse(text.replace(/^\uFEFF/, '')); } catch { throw new Error('The JSON file is not valid.'); }
    rows = Array.isArray(value) ? value : value && typeof value === 'object' && 'candles' in value && Array.isArray(value.candles) ? value.candles : [];
  } else {
    const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
    const header = lines.shift()!.split(',').map(value => value.trim().toLowerCase());
    const timeKey = ['time', 'timestamp', 'datetime', 'date'].find(key => header.includes(key));
    if (!timeKey || !['open', 'high', 'low', 'close'].every(key => header.includes(key)) || new Set(header).size !== header.length)
      throw new Error('CSV needs time,open,high,low,close columns. Use UTC ISO timestamps or Unix seconds.');
    rows = lines.filter(line => line.trim()).map(line => {
      const values = line.split(',').map(value => value.trim().replace(/^"|"$/g, ''));
      if (values.length !== header.length) throw new Error('A CSV row has a different number of columns.');
      const row = Object.fromEntries(header.map((key, i) => [key, values[i]]));
      return { ...row, time: row[timeKey] };
    });
  }
  if (rows.length < 60 || rows.length > 5000) throw new Error('Import between 60 and 5,000 candles.');
  const candles = rows.map((value, index) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid candle at row ${index + 1}.`);
    const row = value as Record<string, unknown>;
    const numeric = (value: unknown) => typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
    const candle = { time: timestamp(row.time ?? row.timestamp ?? row.datetime ?? row.date), open: numeric(row.open), high: numeric(row.high), low: numeric(row.low), close: numeric(row.close) };
    if (!Number.isFinite(candle.time) || candle.time <= 0 || candle.time > now || ![candle.open, candle.high, candle.low, candle.close].every(n => Number.isFinite(n) && n > 0)
      || candle.high < Math.max(candle.open, candle.close) || candle.low > Math.min(candle.open, candle.close)) throw new Error(`Invalid OHLC or timestamp at row ${index + 1}.`);
    return candle;
  }).sort((a, b) => a.time - b.time);
  if (candles.some((candle, i) => i > 0 && candle.time === candles[i - 1].time)) throw new Error('Duplicate candle timestamps were found.');
  return candles;
}

export function validateReviewInput(value: unknown): ReviewInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Choose the market, timeframe and method.');
  const input = value as Record<string, unknown>;
  if (typeof input.symbol !== 'string' || !/^[A-Z0-9][A-Z0-9/_.^:-]{0,31}$/.test(input.symbol)
    || !marketTimeframes.includes(input.timeframe as MarketTimeframe) || !reviewStrategies.includes(input.strategy as ReviewStrategy)
    || typeof input.context !== 'string' || input.context.length > 2000) throw new Error('Check the market, timeframe, method and notes (maximum 2,000 characters).');
  return { symbol: input.symbol, timeframe: input.timeframe as MarketTimeframe, strategy: input.strategy as ReviewStrategy, context: input.context.trim() };
}

/** Explicit educational rules inspired by these concepts; no trained forecast. */
export function reviewCandles(candles: Candle[], input: ReviewInput, source: string, now = Date.now()): FileReview {
  const duration = timeframeMilliseconds[input.timeframe];
  const closed = candles.filter(candle => candle.time + duration <= now);
  if (closed.length < 60) throw new Error('At least 60 completed candles are needed at the selected timeframe.');
  const bars = closed.slice(-1000);
  const last = bars[bars.length - 1];
  const lookback = bars.slice(-21, -1);
  const high = Math.max(...lookback.map(bar => bar.high));
  const low = Math.min(...lookback.map(bar => bar.low));
  const middle = (high + low) / 2;
  const number = (value: number) => value.toLocaleString('en-US', { maximumSignificantDigits: 8 });
  const observations = [`Last completed close: ${number(last.close)}. The previous 20-bar range is ${number(low)}–${number(high)}.`,
    last.close > high ? 'The close broke above the previous range high.' : last.close < low ? 'The close broke below the previous range low.' : 'The close remains inside the previous range.'];
  const levels: ReviewLevel[] = [{ label: 'Prior 20-bar high', price: high }, { label: 'Range midpoint', price: middle }, { label: 'Prior 20-bar low', price: low }];
  if (input.strategy === 'MSNR') {
    const pivots = bars.slice(2, -2).flatMap((bar, j) => {
      const i = j + 2;
      const neighbors = [bars[i - 2], bars[i - 1], bars[i + 1], bars[i + 2]];
      return neighbors.every(other => bar.high > other.high) ? [{ label: 'Confirmed swing resistance', price: bar.high }]
        : neighbors.every(other => bar.low < other.low) ? [{ label: 'Confirmed swing support', price: bar.low }] : [];
    });
    levels.push(...pivots.slice(-4));
    observations.push('Support and resistance use confirmed five-bar swing points. A level is a reference for a reaction, not a promise of a reversal.');
  } else {
    const sweepHigh = last.high > high && last.close < high;
    const sweepLow = last.low < low && last.close > low;
    observations.push(sweepHigh ? 'The latest candle wicked above the range high and closed back below it: an upper liquidity-sweep pattern.'
      : sweepLow ? 'The latest candle wicked below the range low and closed back above it: a lower liquidity-sweep pattern.' : 'No range liquidity-sweep pattern is confirmed on the latest completed bar.');
    const gaps: ReviewLevel[] = [];
    for (let i = Math.max(2, bars.length - 50); i < bars.length; i++) {
      const prior = bars[i - 2]; const current = bars[i];
      if (current.low > prior.high && !bars.slice(i + 1).some(bar => bar.low <= prior.high)) gaps.push({ label: 'Bullish three-bar gap midpoint', price: (current.low + prior.high) / 2 });
      if (current.high < prior.low && !bars.slice(i + 1).some(bar => bar.high >= prior.low)) gaps.push({ label: 'Bearish three-bar gap midpoint', price: (current.high + prior.low) / 2 });
    }
    levels.push(...gaps.slice(-3));
    observations.push(gaps.length ? `${gaps.length} three-bar price gap(s) in the last 50 bars have not been fully traversed by subsequent wicks.` : 'No unfilled three-bar gap was found in the last 50 bars.');
  }
  const limitations = ['This is a rules-based review of supplied candles, not AI, a probability estimate or a future price prediction.',
    'Uploaded data is not independently verified. Spread, execution, exchange sessions and volume are not modeled.',
    input.context.trim() ? 'Your fundamental notes are unverified context. Their timing, accuracy and price impact have not been checked.' : 'No verified current news is attached. Fundamental direction cannot be assessed from these candles.'];
  if (now - (last.time + duration) > duration * 3) limitations.push('This is a historical snapshot. The last completed candle is older than three selected periods.');
  if (bars.some((bar, i) => i > 0 && bar.time - bars[i - 1].time !== duration)) limitations.push('Candle spacing differs from the selected timeframe or includes session gaps; check the source and timeframe.');
  return { title: `${input.symbol} · ${input.strategy} study`, source, lastClosedAt: last.time + duration, candlesUsed: bars.length, observations, levels,
    scenarios: [`Upside: a completed close above ${number(high)} would support a range-break study. A return below that level would weaken it.`,
      `Downside: a completed close below ${number(low)} would support a breakdown study. A return above that level would weaken it.`,
      `Range: while closes stay between ${number(low)} and ${number(high)}, study reactions near the boundaries and avoid assuming a breakout.`], limitations };
}
