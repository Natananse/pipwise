import { type Asset, generateCandles } from './market';
import { type MarketCandleSeries, type MarketQuote, type MarketTimeframe, timeframeMilliseconds } from './marketTypes';

/** Fixed synthetic fixtures, deliberately separate from provider data and its cache. */
export function sampleMarket(asset: Asset, timeframe: MarketTimeframe): { quote: MarketQuote; series: MarketCandleSeries } {
  const candles = generateCandles(asset, timeframe);
  const scale = asset.price / candles[candles.length - 1].close;
  const normalized = candles.map(candle => ({ ...candle,
    open: candle.open * scale, high: candle.high * scale, low: candle.low * scale, close: candle.close * scale,
  }));
  const asOf = normalized[normalized.length - 1].time + timeframeMilliseconds[timeframe];
  return {
    quote: { symbol: asset.symbol, price: asset.price, changePercent: asset.change,
      source: 'PipWise synthetic sample', kind: 'reference', marketOpen: null, asOf, receivedAt: asOf },
    series: { symbol: asset.symbol, timeframe, candles: normalized, source: 'PipWise synthetic sample', asOf, receivedAt: asOf },
  };
}
