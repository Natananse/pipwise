import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { demoMarket } from './demoMarket';
import { createPersistenceQueue } from './persistence';
import { withStartupTimeout } from './startupTasks';

const storageKey = 'pipwise-moving-demo-v1';
const missingPricesMessage = 'Saved demo prices are missing for your open positions. Try again. Your saved wallet has not been changed.';
const enqueueSave = createPersistenceQueue();
export function persistDemoMarket() {
  // Capture the executable marks at the caller's save boundary, before waiting
  // behind another native write. Wallet saves can then use the same boundary.
  const saved = JSON.stringify(demoMarket.serialize());
  return enqueueSave(() => AsyncStorage.setItem(storageKey, saved));
}
type DemoContextValue = { paused: boolean; setPaused: (paused: boolean) => void; ready: boolean; storageError: string; initializationError: string; retryInitialization: () => void; activate: () => () => void };
const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoMarketProvider({ children }: { children: React.ReactNode }) {
  const [paused, setPaused] = useState(false);
  const [activeViews, setActiveViews] = useState(0);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [initializationError, setInitializationError] = useState('');
  const [initializationAttempt, setInitializationAttempt] = useState(0);
  const retryInitialization = useCallback(() => {
    setReady(false);
    setInitializationError('');
    setInitializationAttempt(attempt => attempt + 1);
  }, []);
  const activate = useCallback(() => {
    setActiveViews(count => count + 1);
    return () => setActiveViews(count => Math.max(0, count - 1));
  }, []);
  useEffect(() => {
    let mounted = true;
    const restore = async () => {
      const value = await AsyncStorage.getItem(storageKey);
      if (value === null) {
        // Do not replace a missing price cache with fresh baselines while an
        // existing wallet still depends on its marks, even on an auth screen.
        const rawWorkspace = await AsyncStorage.getItem('pipswise.workspace.v1');
        const workspace = rawWorkspace === null ? null : JSON.parse(rawWorkspace);
        if (Array.isArray(workspace?.wallet?.positions)
          && workspace.wallet.positions.some((position: { pricingSource?: unknown } | null) => position?.pricingSource === 'moving-demo-v1')) {
          throw new Error(missingPricesMessage);
        }
      }
      return value;
    };
    withStartupTimeout(restore(), 'Loading saved demo prices took too long. Try again. Saved prices have not been changed.').then(value => {
      if (!mounted) return;
      if (value !== null && !demoMarket.restore(JSON.parse(value))) throw new Error('Invalid saved demo prices.');
      setReady(true);
    }).catch(error => { if (mounted) setInitializationError(error instanceof Error && error.message === missingPricesMessage
      ? missingPricesMessage : 'Could not restore saved demo prices. Try again. Saved prices have not been changed.'); });
    return () => { mounted = false; };
  }, [initializationAttempt]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (!ready) return;
    const save = () => {
      void persistDemoMarket().then(() => setStorageError('')).catch(() => {
        setStorageError('Demo prices could not be saved on this device.');
      });
    };
    if (paused || !foreground || !activeViews) { save(); return; }
    demoMarket.tick();
    const timer = setInterval(() => demoMarket.tick(), 1000);
    const persistence = setInterval(save, 15000);
    return () => { clearInterval(timer); clearInterval(persistence); save(); };
  }, [paused, foreground, activeViews, ready]);
  const value = useMemo(() => ({ paused, setPaused, ready, storageError, initializationError, retryInitialization, activate }), [paused, ready, storageError, initializationError, retryInitialization, activate]);
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

/** Safe above the router's screen tree: no navigation hook or quote subscription. */
export function useDemoMarketStatus() {
  const context = useContext(DemoContext);
  if (!context) throw new Error('DemoMarketProvider is missing.');
  return { ready: context.ready, paused: context.paused, storageError: context.storageError, initializationError: context.initializationError, retryInitialization: context.retryInitialization };
}

export function useDemoMarket({ active = false }: { active?: boolean } = {}) {
  const context = useContext(DemoContext);
  if (!context) throw new Error('DemoMarketProvider is missing.');
  const { activate } = context;
  useFocusEffect(useCallback(() => active ? activate() : undefined, [active, activate]));
  const snapshot = useSyncExternalStore(demoMarket.subscribe, demoMarket.getSnapshot, demoMarket.getSnapshot);
  const quotes = useMemo(() => Object.fromEntries(Object.entries(snapshot.quotes).map(([symbol, quote]) => [symbol, quote.price])), [snapshot]);
  return { market: demoMarket, snapshot, quotes, paused: context.paused, setPaused: context.setPaused, ready: context.ready, storageError: context.storageError };
}
