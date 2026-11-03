import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { initialWallet, Wallet, openOrder, closePosition, Direction } from './simulator';
import { Asset } from './market';
import { createPersistenceQueue } from './persistence';
const am: Record<string, string> = { Trade: 'ግብይት', Learn: 'ይማሩ', Analyse: 'ትንታኔ', Top: 'ምርጥ', Profile: 'መገለጫ', Continue: 'ቀጥል', Back: 'ተመለስ', 'Trade Smarter. Practice Wiser.': 'በብልሃት ይገበያዩ። በጥበብ ይለማመዱ።', 'Start your journey': 'ጉዞዎን ይጀምሩ', 'Choose your language': 'ቋንቋዎን ይምረጡ', 'How experienced are you with trading?': 'በግብይት ምን ያህል ልምድ አለዎት?', 'Complete beginner': 'ሙሉ በሙሉ ጀማሪ', 'Know the basics': 'መሠረታዊ እውቀት አለኝ', Intermediate: 'መካከለኛ', Experienced: 'ልምድ ያለኝ', 'Which markets interest you?': 'የትኞቹ ገበያዎች ያስደስቱዎታል?', Forex: 'የውጭ ምንዛሬ', Cryptocurrency: 'ክሪፕቶ ምንዛሬ', 'Gold and Silver': 'ወርቅ እና ብር', 'Oil and Commodities': 'ነዳጅ እና ሸቀጦች', 'Stocks and Indices': 'አክሲዮኖች እና ኢንዴክሶች', 'What is your main goal?': 'ዋና ዓላማዎ ምንድን ነው?', 'Learn financial markets': 'የፋይናንስ ገበያዎችን መማር', 'Practice trading': 'ግብይትን መለማመድ', 'Improve strategies': 'ስልቶችን ማሻሻል', 'Understand market analysis': 'የገበያ ትንታኔን መረዳት', 'Welcome back': 'እንኳን ደህና መጡ', 'Create account': 'መለያ ይፍጠሩ', 'Sign in': 'ይግቡ', 'Email address': 'የኢሜይል አድራሻ', Password: 'የይለፍ ቃል', 'Continue in demo mode': 'በሙከራ ሁነታ ይቀጥሉ', 'Forgot password?': 'የይለፍ ቃል ረሱ?', 'Reset password': 'የይለፍ ቃል ቀይር', 'Your trading workspace': 'የእርስዎ የግብይት ቦታ', 'Virtual balance': 'ምናባዊ ቀሪ ሂሳብ', 'Available funds': 'የሚገኝ ገንዘብ', Equity: 'ጠቅላላ ሀብት', 'Open positions': 'ክፍት ግብይቶች', Buy: 'ግዛ', Sell: 'ሽጥ', Markets: 'ገበያዎች', 'Build your edge.': 'እውቀትዎን ያሳድጉ።', 'Market perspective.': 'የገበያ እይታ።', 'Learn from the leaders.': 'ከመሪዎች ይማሩ።', 'Make it yours.': 'ለእርስዎ ያበጁ።' };
export type Language = 'en' | 'am';
export type Preferences = { experience: string; markets: string[]; goal: string };
export type ProfilePreferences = { displayName: string; avatarId: 'trader' | 'bull' | 'owl' };
type Data = { profile: ProfilePreferences; predictionAnswers: Record<string, 'up' | 'down'>; language: Language; preferences: Preferences; favorites: string[]; bookmarks: string[]; completed: string[]; notifications: boolean; wallet: Wallet };
const defaults: Data = { profile: { displayName: '', avatarId: 'trader' }, predictionAnswers: {}, language: 'en', preferences: { experience: '', markets: [], goal: '' }, favorites: ['EUR/USD', 'BTC/USD', 'XAU/USD'], bookmarks: [], completed: [], notifications: true, wallet: initialWallet };
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

/** Reject corrupt saved data without replacing the user's existing workspace. */
export function parseWorkspaceData(raw: string): Data {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) throw new Error('Invalid saved workspace.');
  if (parsed.language !== undefined && parsed.language !== 'en' && parsed.language !== 'am')
    throw new Error('Invalid saved language.');
  const preferences = parsed.preferences;
  if (preferences !== undefined) {
    if (!isRecord(preferences)
      || (preferences.experience !== undefined && typeof preferences.experience !== 'string')
      || (preferences.goal !== undefined && typeof preferences.goal !== 'string')
      || (preferences.markets !== undefined && !isStringArray(preferences.markets)))
      throw new Error('Invalid saved preferences.');
  }
  for (const key of ['favorites', 'bookmarks', 'completed']) {
    if (parsed[key] !== undefined && !isStringArray(parsed[key]))
      throw new Error('Invalid saved list.');
  }
  if (parsed.notifications !== undefined && typeof parsed.notifications !== 'boolean')
    throw new Error('Invalid notification preference.');
  const profile = parsed.profile;
  if (profile !== undefined && (!isRecord(profile) || typeof profile.displayName !== 'string'
    || !['trader', 'bull', 'owl'].includes(String(profile.avatarId)))) throw new Error('Invalid saved profile.');
  const predictionAnswers = parsed.predictionAnswers;
  if (predictionAnswers !== undefined && (!isRecord(predictionAnswers)
    || Object.values(predictionAnswers).some(value => value !== 'up' && value !== 'down'))) throw new Error('Invalid saved practice answers.');
  const wallet = parsed.wallet;
  if (wallet !== undefined && (!isRecord(wallet)
    || typeof wallet.cash !== 'number' || !Number.isFinite(wallet.cash)
    || !Array.isArray(wallet.positions) || !Array.isArray(wallet.history)))
    throw new Error('Invalid saved wallet.');
  return {
    ...defaults, ...parsed as Partial<Data>,
    preferences: { ...defaults.preferences, ...preferences as Partial<Preferences> | undefined },
  };
}
const Context = createContext<ReturnType<typeof useWorkspaceState>>(null!);
function useWorkspaceState() {
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
    AsyncStorage.getItem('pipswise.workspace.v1').then(value => {
      if (!active) return;
      const saved = value === null ? defaults : parseWorkspaceData(value);
      latest.current = saved;
      setData(saved);
    }).catch(() => {
      if (active) setInitializationError('Could not load your saved workspace. Please try again. Your saved data has not been changed.');
    }).finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [initializationAttempt]);
  const update = (patch: Partial<Data>) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setData(next);
    void enqueue.current(() => AsyncStorage.setItem('pipswise.workspace.v1', JSON.stringify(latest.current)))
      .then(() => setStorageError(''))
      .catch(() => setStorageError('Could not save locally. Keep the app open to retain this session.'));
  };
  const persistOnboarding = async (preferences: Preferences, language: Language) => {
    try {
      await enqueue.current(async () => {
        const patch = { preferences, language };
        const next = { ...latest.current, ...patch };
        await AsyncStorage.setItem('pipswise.workspace.v1', JSON.stringify(next));
        // Commit only after storage succeeds. Preserve unrelated optimistic changes.
        const committed = { ...latest.current, ...patch };
        latest.current = committed;
        setData(committed);
      });
      setStorageError('');
    } catch (error) {
      setStorageError('Could not save your preferences. Please try again.');
      throw error;
    }
  };
  const toggle = (key: 'favorites' | 'bookmarks' | 'completed', value: string) => {
    const list = latest.current[key];
    update({ [key]: list.includes(value) ? list.filter(x => x !== value) : [...list, value] });
  };
  return { ...data, loaded, initializationError, retryInitialization, storageError, update, persistOnboarding, toggle,
    answerPrediction: (id: string, answer: 'up' | 'down') => {
      if (!latest.current.predictionAnswers[id]) update({ predictionAnswers: { ...latest.current.predictionAnswers, [id]: answer } });
    },
    t: (s: string) => data.language === 'am' ? am[s] || s : s,
    trade: (a: Asset, d: Direction, q: number, sl?: number, tp?: number) => update({ wallet: openOrder(latest.current.wallet, a, d, q, sl, tp) }),
    close: (id: string) => update({ wallet: closePosition(latest.current.wallet, id) }),
  };
}
export function WorkspaceProvider({ children }: { children: React.ReactNode }) { const value = useWorkspaceState(); return <Context.Provider value={value}>{children}</Context.Provider>; }
export const useWorkspace = () => useContext(Context);
