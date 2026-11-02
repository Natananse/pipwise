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
  ready: boolean; session: Session | null; plan: Plan; supabaseConfigured: boolean;
  disclaimerAccepted: boolean; onboarded: boolean; demo: boolean; startDemo: () => Promise<void>; signOut: () => Promise<void>; resetOnboarding: () => Promise<void>;
  acceptDisclaimer: () => Promise<void>; finishOnboarding: () => Promise<void>; refreshPlan: () => Promise<void>;
};
const SessionCtx = createContext<Ctx>(null as unknown as Ctx);
export const useSession = () => useContext(SessionCtx);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [demo, setDemo] = useState(false);
  const [ready, setReady] = useState(false);
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
    if (rcKey) Purchases.configure({ apiKey: rcKey });
    (async () => {
      setDemo((await AsyncStorage.getItem('demo')) === '1');
      setD((await AsyncStorage.getItem('disclaimer')) === '1');
      setO((await AsyncStorage.getItem('onboarded')) === '1');
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        setSession(data.session);
      }
      setReady(true);
    })();
    const subscription = supabase?.auth.onAuthStateChange(async (_e, s) => {
      setSession(s);
      if (rcKey) { try { if (s) await Purchases.logIn(s.user.id); else await Purchases.logOut(); } catch {} }
      refreshPlan();
    });
    return () => subscription?.data.subscription.unsubscribe();
  }, [refreshPlan]);

  const startDemo = async () => { await AsyncStorage.setItem('demo', '1'); setDemo(true); };
  const signOut = async () => { await supabase?.auth.signOut(); await AsyncStorage.removeItem('demo'); setDemo(false); };
  const resetOnboarding = async () => { await AsyncStorage.removeItem('onboarded'); setO(false); };
  const acceptDisclaimer = async () => { await AsyncStorage.setItem('disclaimer', '1'); setD(true); };
  const finishOnboarding = async () => { await AsyncStorage.setItem('onboarded', '1'); setO(true); };

  return <SessionCtx.Provider value={{ demo, startDemo, signOut, resetOnboarding, ready, session, plan, supabaseConfigured, disclaimerAccepted, onboarded, acceptDisclaimer, finishOnboarding, refreshPlan }}>{children}</SessionCtx.Provider>;
}
