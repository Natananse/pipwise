import { marketTimeframes, type MarketArticle, type MarketCandleSeries, type MarketNews, type MarketQuote, type MarketTimeframe } from '../lib/marketTypes';

// Server entry point only: import this module from +api routes, never screens.
type Env = Record<string, string | undefined>;
type Options = { env?: Env; fetch?: typeof globalThis.fetch; now?: () => number };
type Kind = 'quote' | 'candles' | 'news';
type MarketData = MarketQuote | MarketCandleSeries | MarketNews;
type RecordValue = Record<string, unknown>;
type CacheEntry = { data: MarketData; expiresAt: number };

const symbols = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'BTC/USD', 'XAU/USD', 'WTI/USD', 'SPX/USD'] as const;
const providerIntervals: Record<MarketTimeframe, string> = { '1m': '1min', '5m': '5min', '15m': '15min', '1h': '1h', '4h': '4h', '1D': '1day' };
const defaults: Record<string, string | undefined> = {
  'EUR/USD': 'EUR/USD', 'GBP/USD': 'GBP/USD', 'USD/JPY': 'USD/JPY', 'BTC/USD': 'BTC/USD', 'XAU/USD': 'XAU/USD',
  // WTI spot/futures and cash S&P index/CFDs differ. Require an explicit mapping.
  'WTI/USD': undefined, 'SPX/USD': undefined,
};
const searches: Record<string, string> = {
  'EUR/USD': '"euro" | "ECB" | "Federal Reserve"',
  'GBP/USD': '"sterling" | "Bank of England" | "Federal Reserve"',
  'USD/JPY': '"yen" | "Bank of Japan" | "Federal Reserve"',
  'BTC/USD': '"bitcoin"', 'XAU/USD': '"gold price" | "gold market"',
  'WTI/USD': '"WTI" | "crude oil"', 'SPX/USD': '"S&P 500"',
};
const aliases: Record<string, string[]> = {
  'EUR/USD': ['EURUSD', 'EUROUSDOLLAR'], 'GBP/USD': ['GBPUSD', 'BRITISHPOUNDUSDOLLAR'],
  'USD/JPY': ['USDJPY', 'USDOLLARJAPANESEYEN'], 'BTC/USD': ['BTCUSD', 'BTC', 'BITCOIN'],
  'XAU/USD': ['XAUUSD', 'XAU', 'GOLD'], 'WTI/USD': ['WTIUSD', 'WTI', 'CRUDEOILWTI', 'WESTTEXASINTERMEDIATE'],
  'SPX/USD': ['SPXUSD', 'SPX', 'SP500', 'SPX500USD', 'STANDARDPOORS500'],
};
const record = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value);
const number = (value: unknown): number => typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;

class MarketError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly retryAfter?: number) { super(message); }
}
const unavailable = () => new MarketError(503, 'NOT_CONFIGURED', 'Market prices are not connected yet.');
const malformed = () => new MarketError(502, 'INVALID_PROVIDER_DATA', 'The market provider returned unusable data. Please try again later.');
const limited = (seconds = 60) => new MarketError(429, 'RATE_LIMITED', 'Market requests are temporarily limited. Please try again later.', seconds);

function dateTime(value: unknown, currentTime: number, daily = false): number {
  let timestamp: number;
  if (typeof value === 'number' || (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value))) {
    timestamp = number(value);
    if (timestamp < 1e12) timestamp *= 1000;
  } else if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/.exec(value);
    if (!match) throw malformed();
    const calendar = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    if (calendar.toISOString().slice(0, 10) !== value.slice(0, 10)) throw malformed();
    // Intraday queries explicitly request UTC. Daily provider dates remain
    // exchange calendar dates; UTC midnight is only a chart-date anchor.
    const normalized = value.replace(' ', 'T');
    timestamp = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(normalized) ? `${normalized}T00:00:00Z`
      : /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : `${normalized}Z`);
  } else throw malformed();
  if (!Number.isFinite(timestamp) || timestamp <= 0 || timestamp > currentTime + (daily ? 86400000 : 300000)) throw malformed();
  return Math.trunc(timestamp);
}

function instrumentMap(env: Env): Record<string, string | undefined> {
  const result = { ...defaults };
  if (!env.TWELVE_DATA_SYMBOLS_JSON?.trim()) return result;
  let overrides: unknown;
  try { overrides = JSON.parse(env.TWELVE_DATA_SYMBOLS_JSON); } catch { throw unavailable(); }
  if (!record(overrides)) throw unavailable();
  for (const [symbol, value] of Object.entries(overrides)) {
    if (!symbols.includes(symbol as typeof symbols[number]) || typeof value !== 'string'
      || !/^[A-Z0-9^][A-Z0-9/_.:^=-]{0,63}$/.test(value)) throw unavailable();
    result[symbol] = value;
  }
  return result;
}

function validateInstrument(body: RecordValue, mapped: string, symbol: string) {
  const metadata = record(body.meta) ? body.meta : body;
  const wrongSymbol = typeof metadata.symbol === 'string' && metadata.symbol !== mapped;
  const wrongType = typeof metadata.type === 'string' && ['Common Stock', 'Preferred Stock', 'ETF', 'Mutual Fund', 'REIT', 'Trust'].includes(metadata.type);
  const wrongCurrency = typeof metadata.currency === 'string' && /^[A-Z]{3}$/.test(metadata.currency) && metadata.currency !== symbol.split('/')[1];
  if (wrongSymbol || wrongType || wrongCurrency) throw new MarketError(502, 'INSTRUMENT_UNAVAILABLE', 'The configured provider returned a different market instrument.');
}

function quote(body: RecordValue, symbol: string, receivedAt: number): MarketQuote {
  const price = number(body.close ?? body.price);
  if (!Number.isFinite(price) || price <= 0) throw malformed();
  const change = number(body.percent_change);
  return {
    symbol, price, changePercent: Number.isFinite(change) ? change : null,
    asOf: dateTime(body.last_quote_at ?? body.timestamp ?? body.datetime, receivedAt), receivedAt,
    source: 'Twelve Data', kind: body.is_delayed === true ? 'delayed' : 'reference',
    marketOpen: typeof body.is_market_open === 'boolean' ? body.is_market_open : null,
  };
}

function candleSeries(body: RecordValue, symbol: string, timeframe: MarketTimeframe, receivedAt: number): MarketCandleSeries {
  if (!Array.isArray(body.values) || !body.values.length || body.values.length > 5000) throw malformed();
  const ordered = new Map<number, MarketCandleSeries['candles'][number]>();
  for (const value of body.values) {
    if (!record(value)) throw malformed();
    const open = number(value.open), close = number(value.close), high = number(value.high), low = number(value.low);
    if (![open, close, high, low].every(price => Number.isFinite(price) && price > 0)
      || high < Math.max(open, close, low) || low > Math.min(open, close, high)) throw malformed();
    const time = dateTime(value.datetime ?? value.timestamp, receivedAt, timeframe === '1D');
    ordered.set(time, { time, open, close, high, low });
  }
  const candles = [...ordered.values()].sort((a, b) => a.time - b.time).slice(-250);
  return { symbol, timeframe, candles, asOf: candles[candles.length - 1].time, receivedAt, source: 'Twelve Data' };
}

function news(body: RecordValue, symbol: string, receivedAt: number, secrets: string[]): MarketNews {
  if (!Array.isArray(body.data)) throw malformed();
  const text = (value: unknown, length: number): string => {
    if (typeof value !== 'string' || secrets.some(secret => secret && value.includes(secret))) return '';
    return value.replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, length);
  };
  const normalize = (value: unknown) => typeof value === 'string' ? value.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
  const articles: MarketArticle[] = [];
  const seen = new Set<string>();
  const seenIds = new Set<string>();
  for (const item of body.data.slice(0, 50)) {
    if (!record(item)) continue;
    const title = text(item.title, 300);
    const rawUrl = text(item.url, 2048);
    if (!title || !rawUrl) continue;
    let url: URL;
    try { url = new URL(rawUrl); } catch { continue; }
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.')
      || /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(url.hostname)
      || [...url.searchParams.keys()].some(key => /^(api_?key|api_token|access_token|token)$/i.test(key)) || seen.has(url.href)) continue;
    let publishedAt: number;
    try { publishedAt = dateTime(item.published_at, receivedAt); } catch { continue; }
    let hash = 2166136261;
    for (let index = 0; index < url.href.length; index++) hash = Math.imul(hash ^ url.href.charCodeAt(index), 16777619);
    const id = text(item.uuid, 128) || `url:${(hash >>> 0).toString(16)}`;
    if (seenIds.has(id)) continue;
    const entities = Array.isArray(item.entities) ? item.entities.filter(record) : [];
    const match = entities.find(entity => {
      const type = typeof entity.type === 'string' ? entity.type.toLowerCase() : '';
      if (type && !['index', 'commodity', 'currency', 'cryptocurrency', 'crypto', 'forex'].includes(type)) return false;
      return aliases[symbol].includes(normalize(entity.symbol)) || aliases[symbol].includes(normalize(entity.name));
    });
    const score = match ? number(match.sentiment_score) : NaN;
    const relevance = match ? number(match.match_score) : NaN;
    const entity = match ? text(match.name ?? match.symbol, 120) : '';
    const article: MarketArticle = {
      id, title, url: url.href,
      source: text(item.source, 120) || url.hostname, publishedAt, symbols: match ? [symbol] : [],
    };
    if (entity && Number.isFinite(score) && score >= -1 && score <= 1 && Number.isFinite(relevance) && relevance >= 0) {
      // Marketaux match_score is a strength value, not a normalized probability.
      article.sentiment = { score, relevance, entity };
    }
    articles.push(article); seen.add(url.href); seenIds.add(id);
    if (articles.length === 3) break;
  }
  articles.sort((a, b) => b.publishedAt - a.publishedAt);
  return { symbol, articles, source: 'Marketaux', receivedAt };
}

/** Fixed budgets are per worker only; production scale needs a shared durable
 * quota store. Cold starts/parallel workers do not share these counters/cache. */
export function createMarketApi({ env = {}, fetch: fetcher = globalThis.fetch, now = Date.now }: Options = {}) {
  const cache = new Map<string, CacheEntry>();
  const pending = new Map<string, Promise<CacheEntry>>();
  const budgets = new Map<string, { minute: number; day: number; minuteCount: number; dayCount: number }>();
  const dayRetry = () => Math.max(1, Math.ceil(((Math.floor(now() / 86400000) + 1) * 86400000 - now()) / 1000));
  const consume = (provider: string) => {
    const minute = Math.floor(now() / 60000), day = Math.floor(now() / 86400000);
    const budget = budgets.get(provider) ?? { minute, day, minuteCount: 0, dayCount: 0 };
    if (budget.day !== day) { budget.day = day; budget.dayCount = 0; }
    if (budget.minute !== minute) { budget.minute = minute; budget.minuteCount = 0; }
    if (budget.dayCount >= (provider === 'news' ? 100 : 800)) throw limited(dayRetry());
    if (budget.minuteCount >= 8) throw limited(Math.max(1, Math.ceil(((minute + 1) * 60000 - now()) / 1000)));
    budget.dayCount++; budget.minuteCount++; budgets.set(provider, budget);
  };
  const requestProvider = async (url: URL, provider: string): Promise<RecordValue> => {
    consume(provider);
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetcher(url, { signal: controller.signal, headers: { Accept: 'application/json' }, redirect: 'error' });
      const body: unknown = await response.json().catch(() => null);
      const error = record(body) && record(body.error) ? body.error : null;
      const providerCode = record(body) ? body.code : null;
      const dailyLimit = error?.code === 'usage_limit_reached';
      if (response.status === 429 || providerCode === 429 || providerCode === '429' || error?.code === 'rate_limit_reached' || dailyLimit) {
        const header = response.headers.get('retry-after');
        const seconds = header && /^\d+$/.test(header) ? Number(header) : header ? Math.ceil((Date.parse(header) - now()) / 1000) : NaN;
        throw limited(Number.isFinite(seconds) && seconds > 0 ? Math.min(86400, seconds) : dailyLimit ? dayRetry() : 60);
      }
      if (!response.ok || !record(body) || body.status === 'error' || error) {
        throw new MarketError(502, 'PROVIDER_UNAVAILABLE', 'The configured market provider cannot supply this request. Please try again later.');
      }
      return body;
    } catch (cause) {
      if (cause instanceof MarketError) throw cause;
      throw new MarketError(502, controller.signal.aborted ? 'PROVIDER_TIMEOUT' : 'PROVIDER_UNAVAILABLE', 'The market provider could not be reached. Please try again later.');
    } finally { clearTimeout(deadline); }
  };
  const load = async (kind: Kind, symbol: string, timeframe: MarketTimeframe, key: string): Promise<CacheEntry> => {
    let data: MarketData;
    if (kind === 'news') {
      const url = new URL('https://api.marketaux.com/v1/news/all');
      url.search = new URLSearchParams({ api_token: key, search: searches[symbol], language: 'en', limit: '3', group_similar: 'true' }).toString();
      data = news(await requestProvider(url, 'news'), symbol, now(), [env.TWELVE_DATA_API_KEY ?? '', env.MARKETAUX_API_KEY ?? '']);
    } else {
      const mapped = instrumentMap(env)[symbol];
      if (!mapped) throw new MarketError(503, 'INSTRUMENT_NOT_CONFIGURED', 'This market needs a verified provider instrument before prices can be shown.');
      const url = new URL(`https://api.twelvedata.com/${kind === 'quote' ? 'quote' : 'time_series'}`);
      url.search = new URLSearchParams({ apikey: key, symbol: mapped, timezone: 'UTC', ...(kind === 'candles' ? { interval: providerIntervals[timeframe], outputsize: '250' } : {}) }).toString();
      const body = await requestProvider(url, 'prices');
      validateInstrument(body, mapped, symbol);
      data = kind === 'quote' ? quote(body, symbol, now()) : candleSeries(body, symbol, timeframe, now());
    }
    return { data, expiresAt: now() + (kind === 'news' ? 3600000 : 900000) };
  };
  return async (request: Request): Promise<Response> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*' };
    try {
      if (request.method !== 'GET') return new Response(JSON.stringify({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET for market data.' } }), { status: 405, headers: { ...headers, Allow: 'GET' } });
      const parameters = new URL(request.url).searchParams;
      const kind = parameters.get('kind') as Kind;
      const symbol = parameters.get('symbol') ?? '';
      const timeframe = (parameters.get('timeframe') ?? '1h') as MarketTimeframe;
      if (!['quote', 'candles', 'news'].includes(kind) || !symbols.includes(symbol as typeof symbols[number])
        || !marketTimeframes.includes(timeframe) || ['kind', 'symbol', 'timeframe'].some(name => parameters.getAll(name).length > 1)) {
        throw new MarketError(400, 'INVALID_REQUEST', 'Choose a supported market, timeframe, and resource.');
      }
      const providerKey = (kind === 'news' ? env.MARKETAUX_API_KEY : env.TWELVE_DATA_API_KEY)?.trim();
      if (env.MARKET_DATA_DISPLAY_ALLOWED !== '1' || !providerKey) throw unavailable();
      const cacheKey = `${kind}:${symbol}:${kind === 'candles' ? timeframe : ''}`;
      let entry = cache.get(cacheKey);
      const hit = !!entry && entry.expiresAt > now();
      if (hit && entry) { cache.delete(cacheKey); cache.set(cacheKey, entry); }
      else {
        let promise = pending.get(cacheKey);
        if (!promise) {
          promise = load(kind, symbol, timeframe, providerKey).then(fresh => {
            cache.delete(cacheKey); cache.set(cacheKey, fresh);
            if (cache.size > 128) cache.delete(cache.keys().next().value!);
            return fresh;
          });
          pending.set(cacheKey, promise);
        }
        try { entry = await promise; }
        finally { if (pending.get(cacheKey) === promise) pending.delete(cacheKey); }
      }
      return new Response(JSON.stringify({ data: entry!.data, cache: { hit, expiresAt: entry!.expiresAt } }), { status: 200, headers });
    } catch (cause) {
      const error = cause instanceof MarketError ? cause : new MarketError(502, 'PROVIDER_UNAVAILABLE', 'Market data is temporarily unavailable. Please try again later.');
      if (error.retryAfter !== undefined) headers['Retry-After'] = String(error.retryAfter);
      return new Response(JSON.stringify({ error: { code: error.code, message: error.message } }), { status: error.status, headers });
    }
  };
}

export const marketApi = createMarketApi({ env: process.env });
