import type { Candle } from './market';

export const marketTimeframes = ['1m', '5m', '15m', '1h', '4h', '1D'] as const;
export type MarketTimeframe = typeof marketTimeframes[number];
export const timeframeMilliseconds: Record<MarketTimeframe, number> = {
  '1m': 60000, '5m': 300000, '15m': 900000, '1h': 3600000, '4h': 14400000, '1D': 86400000,
};

export type MarketQuote = {
  symbol: string;
  price: number;
  changePercent: number | null;
  asOf: number;
  receivedAt: number;
  source: string;
  kind: 'live' | 'delayed' | 'reference';
  marketOpen: boolean | null;
};

export type MarketCandleSeries = {
  symbol: string;
  timeframe: MarketTimeframe;
  candles: Candle[];
  source: string;
  asOf: number;
  receivedAt: number;
};

export type MarketArticle = {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: number;
  symbols: string[];
  sentiment?: { score: number; relevance: number; entity: string };
};

export type MarketNews = {
  symbol: string;
  articles: MarketArticle[];
  source: string;
  receivedAt: number;
};

export type MarketResource<T> = {
  data: T | null;
  state: 'idle' | 'loading' | 'ready' | 'stale' | 'offline' | 'unavailable' | 'error';
  error: string | null;
  fromCache: boolean;
  lastCheckedAt: number | null;
};
