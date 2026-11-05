import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { initialWallet, Wallet, openOrder, closePosition, Direction } from './simulator';
import { Asset } from './market';
import { createPersistenceQueue } from './persistence';
import { isLanguage, type Language } from './languages';
import { translate } from './translations';
import { StartupTimeoutError, withStartupTimeout } from './startupTasks';
import { demoMarket } from './demoMarket';
import { persistDemoMarket, useDemoMarketStatus } from './demoMarketProvider';
import { isSavedWallet } from './walletPersistence';
export type { Language } from './languages';
export const CURRENT_ONBOARDING_VERSION = 1;
export type Preferences = { experience: string; markets: string[]; goal: string };
export type OnboardingStep = 0 | 1 | 2 | 3;
export type OnboardingDraft = { language: Language; preferences: Preferences; step: OnboardingStep };
export type ProfilePreferences = { displayName: string; avatarId: 'trader' | 'bull' | 'owl'; accountId?: string };
type Data = { profile: ProfilePreferences; predictionAnswers: Record<string, 'up' | 'down'>; language: Language; preferences: Preferences; onboardingDraft: OnboardingDraft | null; onboardingVersion: number; favorites: string[]; bookmarks: string[]; completed: string[]; notifications: boolean; wallet: Wallet };
const defaults: Data = { profile: { displayName: '', avatarId: 'trader' }, predictionAnswers: {}, language: 'en', preferences: { experience: '', markets: [], goal: '' }, onboardingDraft: null, onboardingVersion: 0, favorites: ['EUR/USD', 'BTC/USD', 'XAU/USD'], bookmarks: [], completed: [], notifications: true, wallet: initialWallet };
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

/** Reject corrupt saved data without replacing the user's existing workspace. */
export function parseWorkspaceData(raw: string): Data {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) throw new Error('Invalid saved workspace.');
  if (parsed.language !== undefined && !isLanguage(parsed.language))
    throw new Error('Invalid saved language.');
  if (parsed.onboardingVersion !== undefined
    && (typeof parsed.onboardingVersion !== 'number' || !Number.isInteger(parsed.onboardingVersion) || parsed.onboardingVersion < 0))
    throw new Error('Invalid saved onboarding version.');
  const preferences = parsed.preferences;
  if (preferences !== undefined) {
    if (!isRecord(preferences)
      || (preferences.experience !== undefined && typeof preferences.experience !== 'string')
      || (preferences.goal !== undefined && typeof preferences.goal !== 'string')
      || (preferences.markets !== undefined && !isStringArray(preferences.markets)))
      throw new Error('Invalid saved preferences.');
  }
  const draft = parsed.onboardingDraft;
  if (draft !== undefined && draft !== null) {
    if (!isRecord(draft) || !isLanguage(draft.language)
      || !Number.isInteger(draft.step) || Number(draft.step) < 0 || Number(draft.step) > 3
      || !isRecord(draft.preferences) || typeof draft.preferences.experience !== 'string'
      || typeof draft.preferences.goal !== 'string' || !isStringArray(draft.preferences.markets))
      throw new Error('Invalid saved onboarding progress.');
  }
  for (const key of ['favorites', 'bookmarks', 'completed']) {
    if (parsed[key] !== undefined && !isStringArray(parsed[key]))
      throw new Error('Invalid saved list.');
  }
  if (parsed.notifications !== undefined && typeof parsed.notifications !== 'boolean')
    throw new Error('Invalid notification preference.');
  const profile = parsed.profile;
  if (profile !== undefined && (!isRecord(profile) || typeof profile.displayName !== 'string'
    || !['trader', 'bull', 'owl'].includes(String(profile.avatarId))
    || (profile.accountId !== undefined && (typeof profile.accountId !== 'string' || !profile.accountId.trim()
      || profile.accountId.length > 256 || /[\u0000-\u001f\u007f-\u009f]/u.test(profile.accountId))))) throw new Error('Invalid saved profile.');
  const predictionAnswers = parsed.predictionAnswers;
  if (predictionAnswers !== undefined && (!isRecord(predictionAnswers)
    || Object.values(predictionAnswers).some(value => value !== 'up' && value !== 'down'))) throw new Error('Invalid saved practice answers.');
  const wallet = parsed.wallet;
  if (wallet !== undefined && !isSavedWallet(wallet))
    throw new Error('Invalid saved wallet.');
  return {
    ...defaults, ...parsed as Partial<Data>,
    preferences: { ...defaults.preferences, ...preferences as Partial<Preferences> | undefined },
  };
}
const Context = createContext<ReturnType<typeof useWorkspaceState>>(null!);
function useWorkspaceState() {
  const { ready: demoReady } = useDemoMarketStatus();
  const [data, setData] = useState<Data>(defaults);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [initializationError, setInitializationError] = useState('');
  const [initializationAttempt, setInitializationAttempt] = useState(0);
  const retryInitialization = () => {
    setLoaded(false);
    setInitializationError('');
    setInitializationAttempt(value => value + 1);
  };
  const latest = useRef(data);
  const enqueue = useRef(createPersistenceQueue());
  useEffect(() => {
    let active = true;
    withStartupTimeout(
      AsyncStorage.getItem('pipswise.workspace.v1'),
      'Loading your saved workspace took too long. Please try again. Your saved data has not been changed.',
    ).then(value => {
      if (!active) return;
      const saved = value === null ? defaults : parseWorkspaceData(value);
      latest.current = saved;
      setData(saved);
    }).catch(error => {
      if (active) setInitializationError(error instanceof StartupTimeoutError ? error.message : 'Could not load your saved workspace. Please try again. Your saved data has not been changed.');
    }).finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [initializationAttempt]);
  const update = (patch: Partial<Data>) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setData(next);
    void enqueue.current(async () => {
      // Keep the wallet paired with the marks saved for it. A later order may
      // update memory while its predecessor is waiting for native storage.
      const saved = latest.current;
      if (demoReady && (patch.wallet || saved.wallet.positions.some(position => position.pricingSource === 'moving-demo-v1'))) await persistDemoMarket();
      await AsyncStorage.setItem('pipswise.workspace.v1', JSON.stringify(saved));
    })
      .then(() => setStorageError(''))
      .catch(() => setStorageError('Could not save locally. Keep the app open to retain this session.'));
  };
  const persistSetupPatch = async (patch: Partial<Data>) => {
    let expired = false;
    // Keep the physical write in the queue even if the UI's wait expires.
    // Releasing it early would let a late old write overwrite a newer retry.
    const write = enqueue.current(async () => {
      if (expired) return;
      const next = { ...latest.current, ...patch };
      if (demoReady && next.wallet.positions.some(position => position.pricingSource === 'moving-demo-v1')) await persistDemoMarket();
      if (expired) return;
      await AsyncStorage.setItem('pipswise.workspace.v1', JSON.stringify(next));
      if (expired) return;
      const committed = { ...latest.current, ...patch };
      latest.current = committed;
      setData(committed);
    });
    try {
      await withStartupTimeout(write, 'Saving took too long. Please try again.');
      setStorageError('');
    } catch (error) {
      expired = true;
      setStorageError('Could not save your preferences. Please try again.');
      throw error;
    }
  };
  const persistOnboarding = (preferences: Preferences, language: Language) => persistSetupPatch({
    preferences: { ...preferences, markets: [...preferences.markets] },
    language, onboardingDraft: null, onboardingVersion: CURRENT_ONBOARDING_VERSION,
  });
  const persistOnboardingDraft = (preferences: Preferences, language: Language, step: OnboardingStep) => persistSetupPatch({
      language,
      onboardingDraft: { language, step, preferences: { ...preferences, markets: [...preferences.markets] } },
  });
  const toggle = (key: 'favorites' | 'bookmarks' | 'completed', value: string) => {
    const list = latest.current[key];
    update({ [key]: list.includes(value) ? list.filter(x => x !== value) : [...list, value] });
  };
  return { ...data, loaded, initializationError, retryInitialization, storageError, update, persistOnboarding, persistOnboardingDraft, toggle,
    answerPrediction: (id: string, answer: 'up' | 'down') => {
      if (!latest.current.predictionAnswers[id]) update({ predictionAnswers: { ...latest.current.predictionAnswers, [id]: answer } });
    },
    t: (s: string) => translate(data.language, s),
    trade: (a: Asset, d: Direction, q: number, sl?: number, tp?: number) => {
      if (!demoReady) throw new Error('Restoring demo prices. Please try again in a moment.');
      const asset = demoMarket.getAsset(a.symbol);
      const wallet = openOrder(latest.current.wallet, asset, d, q, sl, tp, { pricingSource: 'moving-demo-v1' });
      update({ wallet });
      return wallet.positions[0];
    },
    close: (id: string) => {
      const position = latest.current.wallet.positions.find(p => p.id === id);
      if (position?.pricingSource === 'moving-demo-v1' && !demoReady) throw new Error('Restoring demo prices. Please try again in a moment.');
      update({ wallet: closePosition(latest.current.wallet, id, position?.pricingSource === 'moving-demo-v1' ? demoMarket.getQuote(position.symbol).price : undefined) });
    },
  };
}
export function WorkspaceProvider({ children }: { children: React.ReactNode }) { const value = useWorkspaceState(); return <Context.Provider value={value}>{children}</Context.Provider>; }
export const useWorkspace = () => useContext(Context);
