import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';
import { createUiPreferencesStore } from './uiPreferencesStore';

const store = createUiPreferencesStore(AsyncStorage);

export function useUiPreferences() {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  useEffect(() => { void store.load().catch(() => undefined); }, []);
  return { ...snapshot, save: store.save, retry: store.retry, setRotation: store.setRotation, setImmersive: store.setImmersive };
}

export const resetUiPreferencesForAccountChange = store.reset;
export const getUiPreferencesSnapshot = store.getSnapshot;
export type { RotationPreference, UiPreferences } from './uiPreferencesStore';
