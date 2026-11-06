import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import { authConfigured, getAuthSession, publishAccountDeletion, signOut as accountSignOut, subscribeAuth, type AuthSession } from './neonAuth';
import { StartupTimeoutError, withStartupTimeout } from './startupTasks';
import { SecureStorageUnavailableError } from './secureStorage';
import { syncPendingRegistrationDetails } from './accountDetails';

export type Plan = 'free' | 'pro' | 'elite';
export const planRank: Record<Plan, number> = { free: 0, pro: 1, elite: 2 };
const rcKey = Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_RC_IOS_KEY : process.env.EXPO_PUBLIC_RC_ANDROID_KEY;

type Ctx = {
  ready: boolean; initializationError: string; retryInitialization: () => void; session: AuthSession | null; plan: Plan; authConfigured: boolean; onboardingPreviewActive: boolean;
  disclaimerAccepted: boolean; onboarded: boolean; demo: boolean; startDemo: () => Promise<void>; leaveDemo: () => Promise<void>; signOut: () => Promise<void>; resetOnboarding: () => Promise<void>;
  acceptDisclaimer: () => Promise<void>; finishOnboarding: () => Promise<void>; refreshPlan: () => Promise<void>; preparePurchases: () => Promise<void>;
  passwordRecovery: boolean; beginPasswordRecovery: () => void; clearPasswordRecovery: () => void;
  accountDetailsError: string; retryAccountDetails: () => Promise<void>;
  finishAccountDeletion: (expectedAccountId?: string) => Promise<void>; accountDataVersion: number;
};
const SessionCtx = createContext<Ctx>(null as unknown as Ctx);
export const useSession = () => useContext(SessionCtx);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [demo, setDemo] = useState(false);
  const [accountDataVersion, setAccountDataVersion] = useState(0);
  const [ready, setReady] = useState(false);
  const [initializationError, setInitializationError] = useState('');
  const [initializationAttempt, setInitializationAttempt] = useState(0);
  const retryInitialization = () => {
    setReady(false);
    setInitializationError('');
    setInitializationAttempt(value => value + 1);
  };
  const [session, setSession] = useState<AuthSession | null>(null);
  const sessionRevision = useRef(0);
  const [accountPlan, setAccountPlan] = useState<{ accountId?: string; plan: Plan }>({ plan: 'free' });
  const plan = session && accountPlan.accountId === session.user.id ? accountPlan.plan : 'free';
  const billingQueue = useRef<Promise<void>>(Promise.resolve());
  const billingVersion = useRef(0);
  const billingAccount = useRef<string | undefined>(undefined);
  const [accountDetailsError, setAccountDetailsError] = useState('');
  const currentAccount = useRef<string | undefined>(undefined);
  const deletionCleanup = useRef<{ accountId?: string; promise: Promise<void>; pending: boolean } | null>(null);
  const retryAccountDetails = useCallback(async () => {
    if (!session) return;
    const accountId = session.user.id;
    try {
      await syncPendingRegistrationDetails(session);
      if (currentAccount.current === accountId) setAccountDetailsError('');
    } catch {
      if (currentAccount.current === accountId) setAccountDetailsError('Your account is ready, but your country and phone details have not synced yet. Retry from your profile.');
    }
  }, [session]);
  // Keep setup visible on full development reloads, regardless of the Metro
  // command. Completion releases the current run; production honors saved setup.
  const [onboardingPreviewActive, setOnboardingPreviewActive] = useState(
    typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_PREVIEW_ONBOARDING !== '0',
  );
  const [disclaimerAccepted, setD] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const beginPasswordRecovery = useCallback(() => setPasswordRecovery(true), []);
  const clearPasswordRecovery = useCallback(() => setPasswordRecovery(false), []);
  const [onboarded, setO] = useState(false);

  const preparePurchases = useCallback(async () => {
    const accountId = currentAccount.current;
    const version = billingVersion.current;
    if (!accountId) throw new Error('Sign in before subscribing or restoring purchases.');
    if (!rcKey || Platform.OS === 'web') throw new Error('Store purchases are not connected on this device.');
    const operation = billingQueue.current.then(async () => {
      const changed = () => currentAccount.current !== accountId || billingVersion.current !== version;
      if (changed()) throw new Error('Your account changed. Reopen the membership screen and try again.');
      if (billingAccount.current !== accountId) {
        billingAccount.current = undefined;
        try { await Purchases.logIn(accountId); }
        catch { throw new Error('Purchases could not connect to your account. Check your connection and try again.'); }
        billingAccount.current = accountId;
      }
      if (changed()) throw new Error('Your account changed. Reopen the membership screen and try again.');
    });
    billingQueue.current = operation.catch(() => undefined);
    await operation;
  }, []);

  // Entitlement ids must match RevenueCat: "pro" and "elite". Offline or unconfigured = free.
  const refreshPlan = useCallback(async () => {
    const accountId = currentAccount.current;
    const version = billingVersion.current;
    if (!rcKey || !accountId) return;
    // Purchase/restore can finish while identity is changing. Read only after
    // the SDK has settled on this account, and discard results from older runs.
    await billingQueue.current;
    if (currentAccount.current !== accountId || billingAccount.current !== accountId || billingVersion.current !== version) return;
    try {
      const { entitlements } = await Purchases.getCustomerInfo();
      if (currentAccount.current === accountId && billingVersion.current === version)
        setAccountPlan({ accountId, plan: entitlements.active.elite ? 'elite' : entitlements.active.pro ? 'pro' : 'free' });
    } catch {
      if (currentAccount.current === accountId && billingVersion.current === version) setAccountPlan({ accountId, plan: 'free' });
    }
  }, []);

  useEffect(() => {
    let active = true;
    let authChanged = false;
    if (rcKey) {
      try { Purchases.configure({ apiKey: rcKey }); }
      catch {}
    }
    const unsubscribe = subscribeAuth(nextSession => {
      authChanged = true;
      if (!active) return;
      sessionRevision.current++;
      if (currentAccount.current !== nextSession?.user.id) setAccountPlan({ plan: 'free' });
      currentAccount.current = nextSession?.user.id;
      setSession(nextSession);
      if (!nextSession) setPasswordRecovery(false);
    });
    void (async () => {
      const [localResult, authResult] = await Promise.allSettled([
        withStartupTimeout(
          AsyncStorage.multiGet(['demo', 'disclaimer', 'onboarded']),
          'Loading your saved setup took too long. Please try again.',
        ),
        authConfigured ? withStartupTimeout(
          getAuthSession(),
          'Restoring your sign-in session took too long. Check your connection and try again.',
        ) : Promise.resolve(null),
      ]);
      if (!active) return;
      const errors: string[] = [];
      if (localResult.status === 'fulfilled') {
        const saved = Object.fromEntries(localResult.value);
        setDemo(saved.demo === '1');
        setD(saved.disclaimer === '1');
        setO(saved.onboarded === '1');
      } else {
        errors.push(localResult.reason instanceof StartupTimeoutError ? localResult.reason.message : 'Could not load your saved setup.');
      }
      if (authResult.status === 'fulfilled') {
        if (!authChanged) setSession(authResult.value);
      } else if (!authChanged) {
        errors.push(authResult.reason instanceof StartupTimeoutError || authResult.reason instanceof SecureStorageUnavailableError
          ? authResult.reason.message : 'Could not restore your sign-in session.');
      }
      setInitializationError(errors.join(' '));
      // A rejected read must show a recoverable error, never an endless splash.
      setReady(true);
    })();
    return () => { active = false; unsubscribe(); };
  }, [initializationAttempt]);

  useEffect(() => {
    if (!authConfigured) return;
    let active = true;
    const refreshWhenActive = (state: string | null | undefined) => {
      if (state !== 'active') return;
      const revision = sessionRevision.current;
      void withStartupTimeout(getAuthSession(), 'Session refresh took too long.')
        .then(nextSession => { if (active && revision === sessionRevision.current) setSession(nextSession); }).catch(() => undefined);
    };
    // The initial restore already runs above. Refresh after returning from the
    // background; each protected request obtains a fresh Neon bearer token.
    const subscription = AppState.addEventListener('change', refreshWhenActive);
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => { currentAccount.current = session?.user.id; }, [session?.user.id]);

  useEffect(() => {
    let active = true;
    const accountId = session?.user.id;
    const version = ++billingVersion.current;
    // A restored session needs the same billing identity sync as a new login.
    // Serialize SDK identity changes so a slow previous login cannot win later.
    const operation = billingQueue.current.then(async () => {
      if (!active || !ready || !rcKey) return;
      billingAccount.current = undefined;
      if (!accountId) {
        try { await Purchases.logOut(); } catch { /* The SDK may already be anonymous. */ }
        return;
      }
      try {
        await Purchases.logIn(accountId);
        billingAccount.current = accountId;
        if (!active) return;
        const { entitlements } = await Purchases.getCustomerInfo();
        if (active && currentAccount.current === accountId && billingVersion.current === version)
          setAccountPlan({ accountId, plan: entitlements.active.elite ? 'elite' : entitlements.active.pro ? 'pro' : 'free' });
      } catch {
        if (active && currentAccount.current === accountId && billingVersion.current === version) setAccountPlan({ accountId, plan: 'free' });
      }
    });
    billingQueue.current = operation.catch(() => undefined);
    return () => { active = false; billingVersion.current = version + 1; };
  }, [ready, session?.user.id]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setAccountDetailsError('');
      void retryAccountDetails();
    });
    return () => { active = false; };
  }, [retryAccountDetails]);

  const startDemo = async () => { await withStartupTimeout(AsyncStorage.setItem('demo', '1'), 'Saving took too long. Please try again.'); setDemo(true); };
  const leaveDemo = async () => { await withStartupTimeout(AsyncStorage.removeItem('demo'), 'Saving took too long. Please try again.'); setDemo(false); };
  const signOut = async () => {
    await accountSignOut();
    await withStartupTimeout(AsyncStorage.removeItem('demo'), 'Saving took too long. Please try again.');
    setDemo(false);
    setPasswordRecovery(false);
  };
  const finishAccountDeletion = async (expectedAccountId?: string) => {
    const accountId = expectedAccountId ?? currentAccount.current;
    const previous = deletionCleanup.current;
    const changed = () => Object.assign(new Error('Your previous account was deleted. Your current account and local data have been preserved.'), { code: 'DELETED_ACCOUNT_CHANGED', deletedAccountId: accountId });
    if (accountId && currentAccount.current && currentAccount.current !== accountId) throw changed();
    if (previous && previous.accountId !== accountId && previous.pending) throw changed();
    let operation = previous && previous.accountId === accountId ? previous.promise : undefined;
    if (!operation) {
      const promise = (async () => {
        const { clearDeletedAccountLocalData } = await import('./accountDeletion');
        if (accountId && currentAccount.current && currentAccount.current !== accountId) throw changed();
        await clearDeletedAccountLocalData(accountId);
        currentAccount.current = undefined;
        billingAccount.current = undefined;
        sessionRevision.current++;
        setSession(null);
        setAccountPlan({ plan: 'free' });
        setDemo(false); setD(false); setO(false); setPasswordRecovery(false);
        setOnboardingPreviewActive(false);
        setAccountDetailsError('');
        setAccountDataVersion(value => value + 1);
        publishAccountDeletion();
      })();
      const current: { accountId?: string; promise: Promise<void>; pending: boolean } = { accountId, promise, pending: true };
      deletionCleanup.current = current;
      void promise.then(() => { current.pending = false; }, () => { if (deletionCleanup.current === current) deletionCleanup.current = null; });
      operation = promise;
    }
    await withStartupTimeout(operation, 'Your account was deleted, but clearing this device took too long. Please retry.');
  };
  const resetOnboarding = async () => { await withStartupTimeout(AsyncStorage.removeItem('onboarded'), 'Saving took too long. Please try again.'); setO(false); };
  const acceptDisclaimer = async () => { await withStartupTimeout(AsyncStorage.setItem('disclaimer', '1'), 'Saving took too long. Please try again.'); setD(true); };
  const finishOnboarding = async () => {
    if (!onboarded) {
      await withStartupTimeout(AsyncStorage.setItem('onboarded', '1'), 'Saving took too long. Please try again.');
      setO(true);
    }
    setOnboardingPreviewActive(false);
  };

  return <SessionCtx.Provider value={{ demo, startDemo, leaveDemo, signOut, resetOnboarding, ready, initializationError, retryInitialization, session, plan, authConfigured, onboardingPreviewActive, disclaimerAccepted, onboarded, acceptDisclaimer, finishOnboarding, refreshPlan, preparePurchases, passwordRecovery, beginPasswordRecovery, clearPasswordRecovery, accountDetailsError, retryAccountDetails, finishAccountDeletion, accountDataVersion }}>{children}</SessionCtx.Provider>;
}
