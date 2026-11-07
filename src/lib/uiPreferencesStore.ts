import { createPersistenceQueue } from './persistence';
import { withStartupTimeout } from './startupTasks';

export type RotationPreference = 'auto' | 'portrait';
export type UiPreferences = { rotation: RotationPreference; immersive: boolean };
export type UiPreferencesSnapshot = UiPreferences & { loaded: boolean; error: string; saving: boolean };
type Storage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> };
export const UI_PREFERENCES_KEY = 'pipwise.ui-preferences.v1';
const initial: UiPreferencesSnapshot = { rotation: 'auto', immersive: true, loaded: false, error: '', saving: false };
const readError = 'Could not load display preferences. Try again. Your other saved data has not changed.';
const writeError = 'Could not save display preferences. Try again.';

export function parseUiPreferences(raw: string | null): UiPreferences {
  if (raw === null) return { rotation: 'auto', immersive: true };
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(readError);
  const data = value as Record<string, unknown>;
  if ((data.version !== undefined && data.version !== 1)
    || (data.rotation !== undefined && data.rotation !== 'auto' && data.rotation !== 'portrait')
    || (data.immersive !== undefined && typeof data.immersive !== 'boolean')) throw new Error(readError);
  return { rotation: data.rotation === 'portrait' ? 'portrait' : 'auto', immersive: data.immersive !== false };
}

/** Independent display settings use the same deletion-aware physical write queue as the workspace. */
export function createUiPreferencesStore(storage: Storage) {
  const listeners = new Set<() => void>();
  const enqueue = createPersistenceQueue();
  let snapshot = { ...initial };
  let generation = 0;
  let readAttempt = 0;
  let loading: Promise<void> | null = null;
  let pendingWrites = 0;
  let failedPatch: Partial<UiPreferences> | null = null;
  const publish = (patch: Partial<UiPreferencesSnapshot>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach(listener => listener());
  };
  const load = () => {
    if (snapshot.loaded) return Promise.resolve();
    if (loading) return loading;
    const currentGeneration = generation;
    const currentAttempt = ++readAttempt;
    publish({ error: '' });
    let read: Promise<string | null>;
    try { read = storage.getItem(UI_PREFERENCES_KEY); } catch { read = Promise.reject(new Error(readError)); }
    const operation = withStartupTimeout(read, readError).then(raw => {
      if (generation !== currentGeneration || readAttempt !== currentAttempt) return;
      const saved = parseUiPreferences(raw);
      publish({ ...saved, loaded: true, error: '' });
    }).catch(() => {
      if (generation === currentGeneration && readAttempt === currentAttempt) publish({ error: readError });
      throw new Error(readError);
    }).finally(() => {
      if (generation === currentGeneration && readAttempt === currentAttempt) loading = null;
    });
    loading = operation;
    return operation;
  };
  const save = async (patch: Partial<UiPreferences>) => {
    if ((patch.rotation !== undefined && patch.rotation !== 'auto' && patch.rotation !== 'portrait')
      || (patch.immersive !== undefined && typeof patch.immersive !== 'boolean')) throw new Error(writeError);
    const currentGeneration = generation;
    if (!snapshot.loaded) await load();
    if (generation !== currentGeneration || !snapshot.loaded) throw new Error(writeError);
    const requested = { ...patch };
    let expired = false;
    let committed = false;
    pendingWrites++;
    publish({ saving: true, error: '' });
    const operation = enqueue(async () => {
      if (expired || generation !== currentGeneration) return;
      const next = { rotation: snapshot.rotation, immersive: snapshot.immersive, ...requested };
      await storage.setItem(UI_PREFERENCES_KEY, JSON.stringify({ version: 1, ...next }));
      if (expired || generation !== currentGeneration) return;
      committed = true;
      failedPatch = null;
      publish({ ...next, error: '' });
    });
    try {
      await withStartupTimeout(operation, writeError);
      if (!committed) throw new Error(writeError);
    } catch {
      expired = true;
      if (generation === currentGeneration) {
        failedPatch = requested;
        publish({ error: writeError });
      }
      throw new Error(writeError);
    } finally {
      if (generation === currentGeneration) {
        pendingWrites--;
        publish({ saving: pendingWrites > 0 });
      }
    }
  };
  const retry = () => !snapshot.loaded ? load() : failedPatch ? save(failedPatch) : Promise.resolve();
  const reset = () => {
    generation++;
    readAttempt++;
    loading = null;
    pendingWrites = 0;
    failedPatch = null;
    publish({ ...initial });
    // Account cleanup removes the prefixed storage key before advancing its generation.
    void load().catch(() => undefined);
  };
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initial,
    load, save, retry, reset,
    setRotation: (rotation: RotationPreference) => save({ rotation }),
    setImmersive: (immersive: boolean) => save({ immersive }),
  };
}
