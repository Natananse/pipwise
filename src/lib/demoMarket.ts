import { Asset, assets, Candle } from './market';
import { MarketCandleSeries, MarketTimeframe, marketTimeframes, timeframeMilliseconds } from './marketTypes';

export const demoPricingSource = 'moving-demo-v1' as const;
const source = 'PipWise simulated market';
const historyLimit = 120;
export type DemoQuote = { symbol: string; price: number; changePercent: number; asOf: number; source: typeof source };
export type DemoLevel = { label: string; price: number; color: string };
export type DemoSnapshot = { revision: number; asOf: number; quotes: Record<string, DemoQuote> };
type MarketState = { random: number; steps: number; series: Record<MarketTimeframe, MarketCandleSeries> };
type SavedMarket = { version: 1; asOf: number; quotes: Record<string, DemoQuote>; states: Record<string, MarketState> };

function hash(value: string, seed: number) {
  let result = seed >>> 0;
  for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619) >>> 0;
  return result || 1;
}
function nextRandom(state: number) { return (Math.imul(state, 1664525) + 1013904223) >>> 0; }
function validCandle(candle: Candle) {
  return [candle.time, candle.open, candle.high, candle.low, candle.close].every(Number.isFinite)
    && candle.time >= 0 && candle.low > 0 && candle.high >= Math.max(candle.open, candle.close)
    && candle.low <= Math.min(candle.open, candle.close);
}

// All prices, including the initial history, are synthetic. No provider or widget data is used.
export function createDemoMarket({ now = Date.now, seed = 401927 }: { now?: () => number; seed?: number } = {}) {
  const started = Math.max(0, Math.floor(now()));
  let states: Record<string, MarketState> = {};
  let snapshot: DemoSnapshot = { revision: 0, asOf: started, quotes: {} };
  const listeners = new Set<() => void>();
  const notify = () => { for (const listener of listeners) listener(); };
  for (const asset of assets) {
    const series = {} as Record<MarketTimeframe, MarketCandleSeries>;
    for (const timeframe of marketTimeframes) {
      const span = timeframeMilliseconds[timeframe];
      const anchor = Math.floor(started / span) * span;
      let random = hash(`${asset.symbol}:${timeframe}`, seed);
      let previous = asset.price * 0.997;
      let candles: Candle[] = [];
      const volatility = asset.category === 'Crypto' ? 0.0016 : 0.0007;
      for (let i = Math.min(historyLimit - 1, Math.floor(anchor / span)); i > 0; i--) {
        random = nextRandom(random);
        const close = previous * (1 + ((random / 4294967296) - 0.5) * volatility * 3);
        random = nextRandom(random);
        const wick = previous * volatility * (0.2 + random / 4294967296);
        candles.push({ open: previous, close, high: Math.max(previous, close) + wick, low: Math.min(previous, close) - wick, time: anchor - span * i });
        previous = close;
      }
      // Align every timeframe to the same executable quote, including its latest completed close.
      const scale = asset.price / previous;
      candles = candles.map(candle => ({ ...candle, open: candle.open * scale, close: candle.close * scale, high: candle.high * scale, low: candle.low * scale }));
      candles.push({ time: anchor, open: asset.price, close: asset.price, high: asset.price, low: asset.price });
      series[timeframe] = { symbol: asset.symbol, timeframe, candles, source, asOf: started, receivedAt: started };
    }
    states[asset.symbol] = { random: hash(asset.symbol, seed), steps: 0, series };
    snapshot.quotes[asset.symbol] = { symbol: asset.symbol, price: asset.price, changePercent: 0, asOf: started, source };
  }
  function getQuote(symbol: string) {
    const quote = snapshot.quotes[symbol];
    if (!quote) throw new Error('Unknown practice market.');
    return quote;
  }
  function tick(at = now()) {
    if (!Number.isFinite(at) || at <= snapshot.asOf) return;
    const time = Math.floor(at);
    if (time <= snapshot.asOf) return;
    const quotes: Record<string, DemoQuote> = {};
    for (const asset of assets) {
      const state = states[asset.symbol];
      const previous = getQuote(asset.symbol).price;
      state.random = nextRandom(state.random);
      state.steps++;
      // Alternating trend and range regimes make higher highs, pullbacks and consolidation.
      // One bounded step on resume prevents replaying unattended hours as fabricated market ticks.
      const regime = Math.floor(state.steps / 45) % 4;
      const trend = regime === 0 ? 0.28 : regime === 2 ? -0.28 : 0;
      const noise = state.random / 4294967296 - 0.5;
      const volatility = asset.category === 'Crypto' ? 0.00055 : 0.00022;
      const reversion = (asset.price - previous) / asset.price * 0.004;
      const increment = previous * ((noise + trend) * volatility + reversion);
      const minimumTick = 10 ** -asset.precision;
      const minimum = Math.ceil(asset.price * 0.5 / minimumTick) * minimumTick;
      const maximum = Math.floor(asset.price * 1.5 / minimumTick) * minimumTick;
      const price = Number(Math.max(minimum, Math.min(maximum,
        previous + (Math.abs(increment) < minimumTick ? (noise >= 0 ? minimumTick : -minimumTick) : increment))).toFixed(asset.precision));
      quotes[asset.symbol] = { symbol: asset.symbol, price, changePercent: (price / asset.price - 1) * 100, asOf: time, source };
      for (const timeframe of marketTimeframes) {
        const span = timeframeMilliseconds[timeframe];
        const anchor = Math.floor(time / span) * span;
        const prior = state.series[timeframe];
        let candles = [...prior.candles];
        let last = candles[candles.length - 1];
        if (anchor > last.time) {
          // While paused, carry the last simulated close forward; no unseen price action is invented.
          const start = Math.max(last.time + span, anchor - (historyLimit - 1) * span);
          for (let cursor = start; cursor <= anchor; cursor += span) {
            candles.push({ time: cursor, open: previous, high: previous, low: previous, close: previous });
          }
          candles = candles.slice(-historyLimit);
          last = candles[candles.length - 1];
        }
        candles[candles.length - 1] = { ...last, close: price, high: Math.max(last.high, price), low: Math.min(last.low, price) };
        state.series[timeframe] = { ...prior, candles, asOf: time, receivedAt: time };
      }
    }
    snapshot = { revision: snapshot.revision + 1, asOf: time, quotes };
    notify();
  }
  function getSeries(symbol: string, timeframe: MarketTimeframe) {
    getQuote(symbol);
    return states[symbol].series[timeframe];
  }
  function getLevels(symbol: string, timeframe: MarketTimeframe): DemoLevel[] {
    // Only completed bars contribute: a forming candle cannot move its own reference levels.
    const completed = getSeries(symbol, timeframe).candles.slice(0, -1);
    const prior = completed[completed.length - 1];
    if (!prior) return [];
    const recent = completed.slice(-20);
    return [
      { label: 'Resistance · 20 bars', price: Math.max(...recent.map(candle => candle.high)), color: '#FF9DA5' },
      { label: 'Prior bar high', price: prior.high, color: '#C9AFEB' },
      { label: 'Pivot · prior bar', price: (prior.high + prior.low + prior.close) / 3, color: '#E8D884' },
      { label: 'Prior bar low', price: prior.low, color: '#8FBDDE' },
      { label: 'Support · 20 bars', price: Math.min(...recent.map(candle => candle.low)), color: '#6EE7BE' },
    ];
  }
  function restore(value: unknown) {
    try {
      const saved = value as SavedMarket;
      if (saved.version !== 1 || !Number.isFinite(saved.asOf) || saved.asOf > now() || saved.asOf < 0) return false;
      for (const asset of assets) {
        const quote = saved.quotes[asset.symbol];
        const state = saved.states[asset.symbol];
        if (!quote || quote.symbol !== asset.symbol || !Number.isFinite(quote.price) || quote.price < asset.price * 0.5 || quote.price > asset.price * 1.5
          || !Number.isFinite(quote.changePercent) || quote.source !== source || quote.asOf !== saved.asOf || !state
          || !Number.isInteger(state.random) || state.random < 0 || state.random > 4294967295 || !Number.isInteger(state.steps) || state.steps < 0) return false;
        for (const timeframe of marketTimeframes) {
          const series = state.series[timeframe];
          if (!series || series.timeframe !== timeframe || series.symbol !== asset.symbol || !Array.isArray(series.candles)
            || series.source !== source || series.asOf !== saved.asOf || series.receivedAt !== saved.asOf
            || !series.candles.length || series.candles.length > historyLimit) return false;
          const candles = series.candles;
          if (candles.some((candle, i) => !validCandle(candle) || candle.time > saved.asOf || candle.time % timeframeMilliseconds[timeframe] !== 0
            || (i > 0 && candle.time <= candles[i - 1].time)) || candles[candles.length - 1].close !== quote.price) return false;
        }
      }
      states = JSON.parse(JSON.stringify(saved.states));
      snapshot = { revision: snapshot.revision + 1, asOf: saved.asOf, quotes: JSON.parse(JSON.stringify(saved.quotes)) };
      notify();
      return true;
    } catch { return false; }
  }
  return {
    getQuote, getSeries, getLevels, tick, restore,
    getAsset: (symbol: string): Asset => ({ ...assets.find(asset => asset.symbol === symbol)!, price: getQuote(symbol).price, change: getQuote(symbol).changePercent }),
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    serialize: (): SavedMarket => JSON.parse(JSON.stringify({ version: 1, asOf: snapshot.asOf, quotes: snapshot.quotes, states })),
  };
}

export const demoMarket = createDemoMarket();
