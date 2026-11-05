import { assets } from './market';
import { marketTimeframes, type MarketCandleSeries, type MarketNews, type MarketQuote, type MarketResource, type MarketTimeframe } from './marketTypes';

export type MarketResourceKind = 'quote' | 'candles' | 'news';
export type MarketDataByKind = { quote: MarketQuote; candles: MarketCandleSeries; news: MarketNews };
type MarketData = MarketDataByKind[MarketResourceKind];
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<unknown>; removeItem(key: string): Promise<unknown> };
type Fetcher = (url: string, options: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;
type Options = { storage: Storage; fetch: Fetcher; baseUrl: string | null; now?: () => number; timeoutMs?: number };
type Entry = { kind: MarketResourceKind; symbol: string; timeframe: MarketTimeframe; expiresAt: number; snapshot: MarketResource<MarketData>; listeners: Set<() => void>; inFlight?: Promise<void> };
const cacheKey = 'pipwise.market.v1';
const maxEntries = 128;
const ttl = { quote: 15 * 60000, candles: 15 * 60000, news: 60 * 60000 };
const symbols = new Set(assets.map(asset => asset.symbol));
const kinds = new Set(['quote', 'candles', 'news']);
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const text = (value: unknown, limit = 300): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= limit && !/[\u0000-\u001f\u007f]/u.test(value);
const timestamp = (value: unknown, now: number): value is number => finite(value) && value >= 946684800000 && value <= now + 5 * 60000;
const initial: MarketResource<MarketData> = { data: null, state: 'idle', error: null, fromCache: false, lastCheckedAt: null };
const invalid: MarketResource<MarketData> = { ...initial, state: 'error', error: 'This market request is not supported.' };

/** Accept a public backend origin or its exact market endpoint, never credentials. */
export function normalizeMarketApiUrl(value: string | null): string | null {
  if (value === '/api/market') return value;
  try {
    const url = new URL(value?.trim() || '');
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    if (url.pathname !== '/' && url.pathname !== '/api/market' && url.pathname !== '/api/market/') return null;
    return `${url.origin}/api/market`;
  } catch { return null; }
}

function validData(kind: MarketResourceKind, symbol: string, timeframe: MarketTimeframe, value: unknown, now: number): value is MarketData {
  if (!record(value) || value.symbol !== symbol || !text(value.source, 200) || !timestamp(value.receivedAt, now)) return false;
  if (kind === 'quote') return finite(value.price) && value.price > 0 && (value.changePercent === null || finite(value.changePercent))
    && timestamp(value.asOf, now) && ['live', 'delayed', 'reference'].includes(String(value.kind)) && (value.marketOpen === null || typeof value.marketOpen === 'boolean');
  if (kind === 'candles') {
    if (value.timeframe !== timeframe || !timestamp(value.asOf, now) || !Array.isArray(value.candles) || value.candles.length > 1000) return false;
    let previous = 0;
    return value.candles.every(candle => {
      if (!record(candle) || !timestamp(candle.time, now) || candle.time <= previous
        || !['open', 'high', 'low', 'close'].every(key => finite(candle[key]) && candle[key] > 0)
        || Number(candle.low) > Math.min(Number(candle.open), Number(candle.close))
        || Number(candle.high) < Math.max(Number(candle.open), Number(candle.close))) return false;
      previous = candle.time;
      return true;
    });
  }
  if (!Array.isArray(value.articles) || value.articles.length > 100) return false;
  return value.articles.every(article => {
    if (!record(article) || !text(article.id, 300) || !text(article.title, 1000) || !text(article.source, 200)
      || !timestamp(article.publishedAt, now) || !Array.isArray(article.symbols) || article.symbols.length > 50
      || !article.symbols.every(item => typeof item === 'string' && /^[A-Z0-9.^/=-]{1,32}$/.test(item))) return false;
    try {
      const url = new URL(typeof article.url === 'string' && article.url.length <= 2048 ? article.url : '');
      if (url.protocol !== 'https:' || url.username || url.password) return false;
    } catch { return false; }
    return article.sentiment === undefined || (record(article.sentiment) && finite(article.sentiment.score)
      && article.sentiment.score >= -1 && article.sentiment.score <= 1 && finite(article.sentiment.relevance)
      && article.sentiment.relevance >= 0 && text(article.sentiment.entity, 300));
  });
}

/** Network and cache state for research data; no sample quotes or wallet writes. */
export function createMarketClient({ storage, fetch: request, baseUrl, now = Date.now, timeoutMs = 10000 }: Options) {
  const endpoint = normalizeMarketApiUrl(baseUrl);
  const entries = new Map<string, Entry>();
  let hydration: Promise<void> | null = null;
  let writes: Promise<unknown> = Promise.resolve();
  function deadline<T>(task: Promise<T>, onTimeout?: () => void): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { onTimeout?.(); reject(new Error('Market request timed out')); }, timeoutMs);
      task.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
    });
  }
  const requestKey = (kind: MarketResourceKind, symbol: string, timeframe: MarketTimeframe) => `${kind}:${symbol}:${kind === 'candles' ? timeframe : ''}`;
  const supported = (kind: MarketResourceKind, symbol: string, timeframe: MarketTimeframe) => kinds.has(kind) && symbols.has(symbol) && marketTimeframes.includes(timeframe);
  function entryFor(kind: MarketResourceKind, symbol: string, timeframe: MarketTimeframe): Entry | null {
    if (!supported(kind, symbol, timeframe)) return null;
    const key = requestKey(kind, symbol, timeframe);
    let entry = entries.get(key);
    if (!entry) {
      entry = { kind, symbol, timeframe: kind === 'candles' ? timeframe : '1h', expiresAt: 0, snapshot: { ...initial }, listeners: new Set() };
      entries.set(key, entry);
    }
    return entry;
  }
  function publish(entry: Entry, snapshot: MarketResource<MarketData>) {
    entry.snapshot = snapshot;
    entry.listeners.forEach(listener => listener());
  }
  const queueWrite = (operation: () => Promise<unknown>) => {
    const result = writes.then(operation);
    writes = result.catch(() => undefined);
    return writes;
  };
  function saveCache() {
    return queueWrite(() => storage.setItem(cacheKey, JSON.stringify({ version: 1, endpoint, entries: [...entries.values()]
      .filter(entry => entry.snapshot.data !== null).sort((a, b) => (b.snapshot.lastCheckedAt ?? 0) - (a.snapshot.lastCheckedAt ?? 0)).slice(0, maxEntries)
      .map(entry => ({ kind: entry.kind, symbol: entry.symbol, timeframe: entry.timeframe, data: entry.snapshot.data, expiresAt: entry.expiresAt, lastCheckedAt: entry.snapshot.lastCheckedAt })) })));
  }
  async function hydrate() {
    if (hydration) return hydration;
    hydration = (async () => {
      let raw: string | null;
      try { raw = await deadline(storage.getItem(cacheKey)); } catch { return; }
      if (raw === null) return;
      let parsed: unknown;
      try { parsed = raw.length <= 8 * 1024 * 1024 ? JSON.parse(raw) : null; } catch { parsed = null; }
      if (!record(parsed) || parsed.version !== 1 || parsed.endpoint !== endpoint || !Array.isArray(parsed.entries)) {
        void queueWrite(() => storage.removeItem(cacheKey));
        return;
      }
      let discarded = parsed.entries.length > maxEntries;
      const time = now();
      for (const saved of parsed.entries.slice(0, maxEntries)) {
        if (!record(saved) || typeof saved.kind !== 'string' || typeof saved.symbol !== 'string' || typeof saved.timeframe !== 'string'
          || !supported(saved.kind as MarketResourceKind, saved.symbol, saved.timeframe as MarketTimeframe)
          || !timestamp(saved.lastCheckedAt, time) || !finite(saved.expiresAt)
          || !validData(saved.kind as MarketResourceKind, saved.symbol, saved.timeframe as MarketTimeframe, saved.data, time)) { discarded = true; continue; }
        const entry = entryFor(saved.kind as MarketResourceKind, saved.symbol, saved.timeframe as MarketTimeframe)!;
        if (entry.snapshot.data !== null) continue;
        entry.expiresAt = Math.min(saved.expiresAt, saved.lastCheckedAt + ttl[entry.kind]);
        publish(entry, { data: saved.data, state: entry.expiresAt > time ? 'ready' : 'stale', error: null, fromCache: true, lastCheckedAt: saved.lastCheckedAt });
      }
      if (discarded) void saveCache();
    })();
    return hydration;
  }
  function getSnapshot<K extends MarketResourceKind>(kind: K, symbol: string, timeframe: MarketTimeframe = '1h'): MarketResource<MarketDataByKind[K]> {
    const entry = entryFor(kind, symbol, timeframe);
    if (!entry) return invalid as MarketResource<MarketDataByKind[K]>;
    if (entry.snapshot.state === 'ready' && entry.expiresAt <= now()) entry.snapshot = { ...entry.snapshot, state: 'stale' };
    return entry.snapshot as MarketResource<MarketDataByKind[K]>;
  }
  function subscribe(kind: MarketResourceKind, symbol: string, timeframe: MarketTimeframe, listener: () => void) {
    const entry = entryFor(kind, symbol, timeframe);
    entry?.listeners.add(listener);
    return () => { entry?.listeners.delete(listener); };
  }
  function refresh(kind: MarketResourceKind, symbol: string, timeframe: MarketTimeframe = '1h', force = false): Promise<void> {
    const entry = entryFor(kind, symbol, timeframe);
    if (!entry) return Promise.resolve();
    if (entry.inFlight) return entry.inFlight;
    const task = (async () => {
      await hydrate();
      const time = now();
      if (!force && ((entry.expiresAt > time && entry.snapshot.data !== null)
        || (entry.snapshot.error && entry.snapshot.lastCheckedAt !== null && time - entry.snapshot.lastCheckedAt < 60000))) return;
      if (!endpoint) {
        publish(entry, { ...entry.snapshot, state: 'unavailable', error: 'Market data is not configured for this build.', lastCheckedAt: time });
        return;
      }
      publish(entry, { ...entry.snapshot, state: entry.snapshot.data ? 'stale' : 'loading', error: null });
      const controller = new AbortController();
      let serverState: 'error' | 'offline' | 'unavailable' = 'offline';
      let message = 'The market feed could not be reached. Please try again.';
      try {
        const query = new URLSearchParams({ kind, symbol, ...(kind === 'candles' ? { timeframe } : {}) });
        const payload: unknown = await deadline((async () => {
          const response = await request(`${endpoint}?${query}`, { method: 'GET', signal: controller.signal, headers: { Accept: 'application/json' } });
          if (!response.ok) {
            serverState = response.status === 503 ? 'unavailable' : 'error';
            message = response.status === 503 ? 'The market data service is unavailable. Please try again later.'
              : response.status === 429 ? 'The market feed has reached its request limit. Please try again later.'
                : response.status === 400 ? 'This market request is not supported.' : 'The market provider could not return this data. Please try again.';
            throw new Error('Market response failed');
          }
          serverState = 'error';
          message = 'The market feed returned invalid data. Please try again.';
          return response.json();
        })(), () => {
          controller.abort();
          serverState = 'offline';
          message = 'The market feed did not respond in time. Please try again.';
        });
        const received = now();
        if (!record(payload) || !record(payload.cache) || typeof payload.cache.hit !== 'boolean' || !finite(payload.cache.expiresAt)
          || !validData(kind, symbol, timeframe, payload.data, received)) throw new Error('Invalid market data');
        entry.expiresAt = Math.min(payload.cache.expiresAt, received + ttl[kind]);
        publish(entry, { data: payload.data, state: entry.expiresAt > received ? 'ready' : 'stale', error: null, fromCache: payload.cache.hit, lastCheckedAt: received });
        void saveCache();
      } catch {
        publish(entry, { ...entry.snapshot, state: entry.snapshot.data ? 'stale' : serverState, error: message, fromCache: entry.snapshot.data !== null, lastCheckedAt: now() });
      }
    })();
    entry.inFlight = task;
    void task.finally(() => { if (entry.inFlight === task) entry.inFlight = undefined; }).catch(() => undefined);
    return task;
  }
  async function refreshStale() {
    await hydrate();
    await Promise.all([...entries.values()].filter(entry => entry.listeners.size > 0 && entry.expiresAt <= now()).map(entry => refresh(entry.kind, entry.symbol, entry.timeframe)));
  }
  return { getSnapshot, subscribe, refresh, refreshStale, hydrate, configured: endpoint !== null, flushCache: () => writes };
}
