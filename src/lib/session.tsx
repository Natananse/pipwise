import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import { supabase, supabaseConfigured } from './supabase';

export type Plan = 'free' | 'pro' | 'elite';
export const planRank: Record<Plan, number> = { free: 0, pro: 1, elite: 2 };
const rcKey = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_RC_IOS_KEY : process.env.EXPO_PUBLIC_RC_ANDROID_KEY;

type Ctx = {
  ready: boolean; initializationError: string; retryInitialization: () => void; session: Session | null; plan: Plan; supabaseConfigured: boolean;
  disclaimerAccepted: boolean; onboarded: boolean; demo: boolean; startDemo: () => Promise<void>; signOut: () => Promise<void>; resetOnboarding: () => Promise<void>;
  acceptDisclaimer: () => Promise<void>; finishOnboarding: () => Promise<void>; refreshPlan: () => Promise<void>;
};
const SessionCtx = createContext<Ctx>(null as unknown as Ctx);
export const useSession = () => useContext(SessionCtx);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [demo, setDemo] = useState(false);
  const [ready, setReady] = useState(false);
  const [initializationError, setInitializationError] = useState('');
  const [initializationAttempt, setInitializationAttempt] = useState(0);
  const retryInitialization = () => {
    setReady(false);
    setInitializationError('');
    setInitializationAttempt(value => value + 1);
  };
  const [session, setSession] = useState<Session | null>(null);
  const [plan, setPlan] = useState<Plan>('free');
  const [disclaimerAccepted, setD] = useState(false);
  const [onboarded, setO] = useState(false);

  // Entitlement ids must match RevenueCat: "pro" and "elite". Offline or unconfigured = free.
  const refreshPlan = useCallback(async () => {
    if (!rcKey) return setPlan('free');
    try {
      const { entitlements } = await Purchases.getCustomerInfo();
      setPlan(entitlements.active.elite ? 'elite' : entitlements.active.pro ? 'pro' : 'free');
    } catch { setPlan('free'); }
  }, []);

  useEffect(() => {
    let active = true;
    let authChanged = false;
    if (rcKey) {
      try { Purchases.configure({ apiKey: rcKey }); }
      catch {}
    }
    const subscription = supabase?.auth.onAuthStateChange((_event, nextSession) => {
      authChanged = true;
      if (!active) return;
      setSession(nextSession);
      // Keep asynchronous billing work outside Supabase's auth callback.
      void Promise.resolve().then(async () => {
        if (!active) return;
        if (rcKey) {
          try {
            if (nextSession) await Purchases.logIn(nextSession.user.id);
            else await Purchases.logOut();
          } catch {}
        }
        if (active) await refreshPlan();
      });
    });
    void (async () => {
      const [localResult, authResult] = await Promise.allSettled([
        AsyncStorage.multiGet(['demo', 'disclaimer', 'onboarded']),
        supabase ? supabase.auth.getSession() : Promise.resolve(null),
      ]);
      if (!active) return;
      const errors: string[] = [];
      if (localResult.status === 'fulfilled') {
        const saved = Object.fromEntries(localResult.value);
        setDemo(saved.demo === '1');
        setD(saved.disclaimer === '1');
        setO(saved.onboarded === '1');
      } else {
        errors.push('Could not load your saved setup.');
      }
      if (authResult.status === 'fulfilled' && !authResult.value?.error) {
        if (!authChanged) setSession(authResult.value?.data.session ?? null);
      } else if (!authChanged) {
        errors.push('Could not restore your sign-in session.');
      }
      setInitializationError(errors.join(' '));
      // A rejected read must show a recoverable error, never an endless splash.
      setReady(true);
    })();
    return () => { active = false; subscription?.data.subscription.unsubscribe(); };
  }, [refreshPlan, initializationAttempt]);

  const startDemo = async () => { await AsyncStorage.setItem('demo', '1'); setDemo(true); };
  const signOut = async () => { await supabase?.auth.signOut(); await AsyncStorage.removeItem('demo'); setDemo(false); };
  const resetOnboarding = async () => { await AsyncStorage.removeItem('onboarded'); setO(false); };
  const acceptDisclaimer = async () => { await AsyncStorage.setItem('disclaimer', '1'); setD(true); };
  const finishOnboarding = async () => { await AsyncStorage.setItem('onboarded', '1'); setO(true); };

  return <SessionCtx.Provider value={{ demo, startDemo, signOut, resetOnboarding, ready, initializationError, retryInitialization, session, plan, supabaseConfigured, disclaimerAccepted, onboarded, acceptDisclaimer, finishOnboarding, refreshPlan }}>{children}</SessionCtx.Provider>;
}
