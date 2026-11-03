export type Asset = {
  symbol: string;
  name: string;
  category: string;
  price: number;
  change: number;
  mark: string;
  precision: number;
};
export const assets: Asset[] = [
  {
    symbol: "EUR/USD",
    name: "Euro / US Dollar",
    category: "Forex",
    price: 1.08472,
    change: 0.24,
    mark: "€",
    precision: 5,
  },
  {
    symbol: "GBP/USD",
    name: "British Pound / US Dollar",
    category: "Forex",
    price: 1.27184,
    change: -0.12,
    mark: "£",
    precision: 5,
  },
  {
    symbol: "BTC/USD",
    name: "Bitcoin",
    category: "Crypto",
    price: 67432.8,
    change: 2.34,
    mark: "₿",
    precision: 2,
  },
  {
    symbol: "XAU/USD",
    name: "Gold / US Dollar",
    category: "Metals",
    price: 2341.5,
    change: 0.68,
    mark: "Au",
    precision: 2,
  },
  {
    symbol: "WTI/USD",
    name: "Crude Oil",
    category: "Commodities",
    price: 78.64,
    change: -0.43,
    mark: "Oil",
    precision: 2,
  },
  {
    symbol: "SPX/USD",
    name: "S&P 500 Index",
    category: "Indices",
    price: 5280.32,
    change: 0.87,
    mark: "S&P",
    precision: 2,
  },
  {
    symbol: "USD/JPY",
    name: "US Dollar / Japanese Yen",
    category: "Forex",
    price: 157.849,
    change: -0.18,
    mark: "¥",
    precision: 3,
  },
];
export type Candle = {
  open: number;
  close: number;
  high: number;
  low: number;
  time: number;
};
export interface MarketDataService {
  candles(asset: Asset, timeframe: string): Promise<Candle[]>;
}
export function generateCandles(asset: Asset, timeframe = "1h"): Candle[] {
  const span =
    ({ "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1D": 86400 }[
      timeframe
    ] || 3600) * 1000;
  let previous = asset.price * 0.995;
  return Array.from({ length: 110 }, (_, i) => {
    const close =
      asset.price *
      (0.995 +
        i * 0.000047 +
        Math.sin(i * 0.59 + span / 1000000) * 0.0012 +
        Math.sin(i * 1.73) * 0.0005);
    const open = previous;
    previous = close;
    return {
      open,
      close,
      high: Math.max(open, close) + asset.price * 0.00045,
      low: Math.min(open, close) - asset.price * 0.00035,
      time: Date.UTC(2026, 9, 30, 16) - (109 - i) * span,
    };
  });
}
export const marketData: MarketDataService = {
  candles: async (asset, timeframe) => generateCandles(asset, timeframe),
};
export const money = (v: number) =>
  "$" +
  v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export const price = (a: Asset) => a.price.toFixed(a.precision);

/** USD-base FX quantities already represent dollars; other supported assets quote in USD. */
export function usdNotional(asset: Asset, quantity: number) {
  return asset.symbol.startsWith('USD/') ? quantity : asset.price * quantity;
}
