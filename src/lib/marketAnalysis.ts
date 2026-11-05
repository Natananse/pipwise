import type { Candle } from './market';
import { timeframeMilliseconds, type MarketArticle, type MarketCandleSeries, type MarketNews, type MarketTimeframe } from './marketTypes';

export type MarketIndicators = {
  ema20: number; ema50: number; rsi14: number;
  macd: number; macdSignal: number; macdHistogram: number; atr14: number;
};
export type MarketAnalysis = {
  status: 'ready' | 'insufficient' | 'stale' | 'invalid';
  bias: 'bullish' | 'bearish' | 'mixed';
  explanation: string;
  indicators: MarketIndicators | null;
  scenarios: { name: 'Upside' | 'Downside' | 'Range'; trigger: number | null; description: string }[];
  metadata: {
    symbol: string; source: string; timeframe: MarketTimeframe; lastClosedAt: number | null;
    sample: boolean; candlesUsed: number; generatedAt: number;
  };
  newsContext: { articles: MarketArticle[]; summary: string; source: string | null };
};

/** SMA-seeded EMA. Leading nulls explicitly represent unavailable lookback. */
function ema(values: number[], period: number): (number | null)[] {
  const output: (number | null)[] = Array(values.length).fill(null);
  if (values.length < period) return output;
  let current = values.slice(0, period).reduce((sum, value) => sum + value / period, 0);
  output[period - 1] = current;
  const alpha = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    current += (values[i] - current) * alpha;
    output[i] = current;
  }
  return output;
}

function rsi(values: number[], period: number): number {
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];
    gain += Math.max(change, 0) / period;
    loss += Math.max(-change, 0) / period;
  }
  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    gain = gain * ((period - 1) / period) + Math.max(change, 0) / period;
    loss = loss * ((period - 1) / period) + Math.max(-change, 0) / period;
  }
  if (gain === 0 && loss === 0) return 50;
  if (loss === 0) return 100;
  return 100 - 100 / (1 + gain / loss);
}

function atr(candles: Candle[], period: number): number {
  let current = 0;
  for (let i = 1; i < candles.length; i++) {
    const bar = candles[i];
    const previousClose = candles[i - 1].close;
    const range = Math.max(bar.high - bar.low, Math.abs(bar.high - previousClose), Math.abs(bar.low - previousClose));
    if (i <= period) current += range / period;
    else current = current * ((period - 1) / period) + range / period;
  }
  return current;
}

const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const timestamp = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

function recentNews(news: MarketNews | null | undefined, symbol: string, now: number): MarketAnalysis['newsContext'] {
  const articles: MarketArticle[] = [];
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  if (news && news.symbol === symbol && Array.isArray(news.articles) && text(news.source)
    && timestamp(news.receivedAt) && news.receivedAt <= now) {
    for (const article of news.articles) {
      if (!article || !text(article.id) || !text(article.title) || !text(article.source) || !text(article.url)
        || !timestamp(article.publishedAt) || article.publishedAt > now || article.publishedAt > news.receivedAt
        || now - article.publishedAt > 72 * 60 * 60 * 1000 || !Array.isArray(article.symbols) || !article.symbols.includes(symbol)) continue;
      let url: URL;
      try { url = new URL(article.url); }
      catch { continue; }
      if (url.protocol !== 'https:' || url.username || url.password || seenIds.has(article.id) || seenUrls.has(url.href)) continue;
      seenIds.add(article.id);
      seenUrls.add(url.href);
      const sentiment = article.sentiment;
      const validSentiment = sentiment && Number.isFinite(sentiment.score) && sentiment.score >= -1 && sentiment.score <= 1
        && Number.isFinite(sentiment.relevance) && sentiment.relevance >= 0 && text(sentiment.entity);
      articles.push({
        id: article.id, title: article.title, source: article.source, url: url.href, publishedAt: article.publishedAt,
        symbols: article.symbols.filter(value => typeof value === 'string'),
        ...(validSentiment ? { sentiment: { ...sentiment } } : {}),
      });
    }
  }
  articles.sort((a, b) => b.publishedAt - a.publishedAt);
  const count = articles.length;
  const publishers = new Set(articles.map(article => article.source)).size;
  return {
    articles,
    source: count && news ? news.source : null,
    summary: count
      ? `${count} relevant article${count === 1 ? '' : 's'} from ${publishers} publisher${publishers === 1 ? '' : 's'} in the past 72 hours. News is context and does not establish price direction or cause.`
      : 'No recent, relevant news is available. Missing coverage is not neutral sentiment.',
  };
}

/** Historical indicator rules and conditional scenarios, not a calibrated price forecast. */
export function analyzeMarket(series: MarketCandleSeries, options: { now?: number; sample?: boolean; news?: MarketNews | null; maxAgeMs?: number } = {}): MarketAnalysis {
  const now = options.now ?? Date.now();
  const sample = options.sample === true;
  const metadata: MarketAnalysis['metadata'] = {
    symbol: typeof series?.symbol === 'string' ? series.symbol : '',
    source: typeof series?.source === 'string' ? series.source : '',
    timeframe: series?.timeframe, lastClosedAt: null, sample, candlesUsed: 0, generatedAt: now,
  };
  const result: MarketAnalysis = {
    status: 'invalid', bias: 'mixed', explanation: 'The candle data is invalid. Analysis is unavailable.',
    indicators: null, scenarios: [], metadata,
    newsContext: recentNews(options.news, metadata.symbol, now),
  };
  if (!timestamp(now) || !series || !text(series.symbol) || !text(series.source)
    || !Object.prototype.hasOwnProperty.call(timeframeMilliseconds, series.timeframe) || !Array.isArray(series.candles)
    || !timestamp(series.asOf) || !timestamp(series.receivedAt) || series.asOf > now || series.receivedAt > now
    || (options.maxAgeMs !== undefined && (!Number.isFinite(options.maxAgeMs) || options.maxAgeMs < 0))) return result;
  const interval = timeframeMilliseconds[series.timeframe];
  const closed: Candle[] = [];
  let previousTime = -Infinity;
  for (let index = 0; index < series.candles.length; index++) {
    const candle = series.candles[index];
    if (!candle || !timestamp(candle.time) || candle.time > now || candle.time <= previousTime
      || ![candle.open, candle.high, candle.low, candle.close].every(value => typeof value === 'number' && Number.isFinite(value) && value > 0)
      || candle.low > Math.min(candle.open, candle.close) || candle.high < Math.max(candle.open, candle.close) || candle.low > candle.high) return result;
    previousTime = candle.time;
    // Daily timestamps are provider calendar-date anchors, not verified
    // exchange session boundaries. Even yesterday's date can identify a
    // session still open today (for example FX). Omit the latest daily bar
    // until the response contract includes its actual session close time.
    // lastClosedAt remains a UTC period-end convention for older daily bars.
    const latestDaily = series.timeframe === '1D' && index === series.candles.length - 1;
    if (!latestDaily && candle.time + interval <= now) closed.push(candle);
  }
  metadata.candlesUsed = closed.length;
  metadata.lastClosedAt = closed.length ? closed[closed.length - 1].time + interval : null;
  if (closed.length < 60) {
    result.status = 'insufficient';
    result.explanation = `At least 60 completed ${series.timeframe} candles are needed; ${closed.length} are available.`;
    return result;
  }
  const maxAge = options.maxAgeMs ?? Math.max(interval * 3, 30 * 60 * 1000);
  if (!sample && now - metadata.lastClosedAt! > maxAge) {
    result.status = 'stale';
    result.explanation = 'The latest completed candle is too old for a current outlook. Market closure or a delayed feed may explain the gap.';
    return result;
  }
  const closes = closed.map(candle => candle.close);
  const last = closes.length - 1;
  const ema20 = ema(closes, 20)[last]!;
  const ema50 = ema(closes, 50)[last]!;
  const fast = ema(closes, 12);
  const slow = ema(closes, 26);
  const macdValues = closes.slice(25).map((_, i) => fast[i + 25]! - slow[i + 25]!);
  const macd = macdValues[macdValues.length - 1];
  const macdSignal = ema(macdValues, 9)[macdValues.length - 1]!;
  const indicators: MarketIndicators = { ema20, ema50, rsi14: rsi(closes, 14), macd, macdSignal, macdHistogram: macd - macdSignal, atr14: atr(closed, 14) };
  if (!Object.values(indicators).every(Number.isFinite)) return result;
  const tolerance = Number.EPSILON * Math.max(1, closes[last]) * 32;
  const bullish = closes[last] > ema20 + tolerance && ema20 > ema50 + tolerance && macd > tolerance
    && indicators.macdHistogram >= -tolerance && indicators.rsi14 >= 50;
  const bearish = closes[last] < ema20 - tolerance && ema20 < ema50 - tolerance && macd < -tolerance
    && indicators.macdHistogram <= tolerance && indicators.rsi14 <= 50;
  result.status = 'ready';
  result.indicators = indicators;
  result.bias = bullish ? 'bullish' : bearish ? 'bearish' : 'mixed';
  result.explanation = bullish
    ? 'Closed price and EMA20/50 align upward. MACD is positive and at or above its signal; RSI is at least 50. These historical conditions do not guarantee the next move.'
    : bearish
      ? 'Closed price and EMA20/50 align downward. MACD is negative and at or below its signal; RSI is at most 50. These historical conditions do not guarantee the next move.'
      : 'Trend and momentum readings do not align in one direction. Both directional scenarios remain conditional.';
  if (indicators.rsi14 > 70) result.explanation += ' RSI is above 70; this does not establish an imminent reversal.';
  else if (indicators.rsi14 < 30) result.explanation += ' RSI is below 30; this does not establish an imminent rebound.';
  const previousTwenty = closed.slice(-21, -1);
  result.scenarios = [
    {
      name: 'Upside', trigger: Math.max(...previousTwenty.map(candle => candle.high)),
      description: `A subsequent completed ${series.timeframe} candle closes above the prior 20-bar high, with price above EMA20, EMA20 above EMA50, positive MACD and MACD at or above its signal. This is a condition to observe, not a price target.`,
    },
    {
      name: 'Downside', trigger: Math.min(...previousTwenty.map(candle => candle.low)),
      description: `A subsequent completed ${series.timeframe} candle closes below the prior 20-bar low, with price below EMA20, EMA20 below EMA50, negative MACD and MACD at or below its signal. This is a condition to observe, not a price target.`,
    },
    { name: 'Range', trigger: null, description: 'Price remains between the prior 20-bar high and low while trend or momentum conditions disagree. A confirmed directional break has not been assumed.' },
  ];
  return result;
}
