import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { createMarketClient, normalizeMarketApiUrl, type MarketDataByKind, type MarketResourceKind } from './marketClient';
import type { MarketResource, MarketTimeframe } from './marketTypes';

const configuredUrl = process.env.EXPO_PUBLIC_MARKET_API_URL?.trim();
export const marketApiUrl = normalizeMarketApiUrl(configuredUrl || (Platform.OS === 'web' ? '/api/market' : null));
export const marketApiConfigured = marketApiUrl !== null;
const Context = createContext<ReturnType<typeof createMarketClient> | null>(null);
const disabledResource: MarketResource<never> = { data: null, state: 'idle', error: null, fromCache: false, lastCheckedAt: null };
// Retain one cache and in-flight queue across route mounts. An older request
// finishing after navigation must not race a second client's persisted cache.
const sharedClient = createMarketClient({ storage: AsyncStorage, fetch: (url, options) => fetch(url, options), baseUrl: marketApiUrl });

export function MarketDataProvider({ children }: { children: React.ReactNode }) {
  const client = sharedClient;
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const stop = () => { if (interval !== null) { clearInterval(interval); interval = null; } };
    const update = (state: string | null | undefined) => {
      stop();
      if (state === 'active') {
        void client.refreshStale();
        interval = setInterval(() => { void client.refreshStale(); }, 60000);
      }
    };
    void client.hydrate();
    const subscription = AppState.addEventListener('change', update);
    update(AppState.currentState);
    return () => { stop(); subscription.remove(); };
  }, [client]);
  return <Context.Provider value={client}>{children}</Context.Provider>;
}

export function useMarketResource<K extends MarketResourceKind>(kind: K, symbol: string, timeframe: MarketTimeframe = '1h', enabled = true): MarketResource<MarketDataByKind[K]> & { refresh: () => Promise<void> } {
  const client = useContext(Context);
  if (!client) throw new Error('MarketDataProvider is required for market research.');
  const subscribe = useCallback((listener: () => void) => enabled ? client.subscribe(kind, symbol, timeframe, listener) : () => {}, [client, enabled, kind, symbol, timeframe]);
  const getSnapshot = useCallback(() => enabled ? client.getSnapshot(kind, symbol, timeframe) : disabledResource, [client, enabled, kind, symbol, timeframe]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const refresh = useCallback(async () => {
    if (enabled && AppState.currentState === 'active') await client.refresh(kind, symbol, timeframe, true);
  }, [client, enabled, kind, symbol, timeframe]);
  useEffect(() => {
    if (enabled && AppState.currentState === 'active') void client.refresh(kind, symbol, timeframe);
  }, [client, enabled, kind, symbol, timeframe]);
  return { ...snapshot, refresh };
}
