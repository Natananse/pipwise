import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import { supabase } from './supabase';

export type Plan = 'free' | 'pro' | 'elite';
export const planRank: Record<Plan, number> = { free: 0, pro: 1, elite: 2 };
const rcKey = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_RC_IOS_KEY : process.env.EXPO_PUBLIC_RC_ANDROID_KEY;

type Ctx = {
  ready: boolean; session: Session | null; plan: Plan;
  disclaimerAccepted: boolean; onboarded: boolean;
  acceptDisclaimer: () => Promise<void>; finishOnboarding: () => Promise<void>; refreshPlan: () => Promise<void>;
};
const SessionCtx = createContext<Ctx>(null as unknown as Ctx);
export const useSession = () => useContext(SessionCtx);

export function SessionProvider({ children }: { children: React.ReactNode }) {
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
      setD((await AsyncStorage.getItem('disclaimer')) === '1');
      setO((await AsyncStorage.getItem('onboarded')) === '1');
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setReady(true);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s);
      if (rcKey) { try { s ? await Purchases.logIn(s.user.id) : await Purchases.logOut(); } catch {} }
      refreshPlan();
    });
    return () => sub.subscription.unsubscribe();
  }, [refreshPlan]);

  const acceptDisclaimer = async () => { await AsyncStorage.setItem('disclaimer', '1'); setD(true); };
  const finishOnboarding = async () => { await AsyncStorage.setItem('onboarded', '1'); setO(true); };

  return <SessionCtx.Provider value={{ ready, session, plan, disclaimerAccepted, onboarded, acceptDisclaimer, finishOnboarding, refreshPlan }}>{children}</SessionCtx.Provider>;
}
