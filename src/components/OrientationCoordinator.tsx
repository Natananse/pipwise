import * as ScreenOrientation from 'expo-screen-orientation';
import { useSegments } from 'expo-router';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, AppState, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { createOrientationController, desiredOrientation, type OrientationStatus } from '../lib/orientationPolicy';
import { useSession } from '../lib/session';
import { resetUiPreferencesForAccountChange, useUiPreferences } from '../lib/uiPreferences';

type Scope = { startupCovered: boolean; setupComplete: boolean; onboardingPreviewActive: boolean };
const initialScope: Scope = { startupCovered: true, setupComplete: false, onboardingPreviewActive: false };
const scopes = new Map<symbol, Scope>();
const scopeListeners = new Set<() => void>();
let scopeSnapshot = initialScope;
function publishScopes() {
  const entries = [...scopes.values()];
  scopeSnapshot = entries.length ? {
    startupCovered: entries.some(entry => entry.startupCovered),
    setupComplete: entries.every(entry => entry.setupComplete),
    onboardingPreviewActive: entries.some(entry => entry.onboardingPreviewActive),
  } : initialScope;
  scopeListeners.forEach(listener => listener());
}
const subscribeScope = (listener: () => void) => { scopeListeners.add(listener); return () => { scopeListeners.delete(listener); }; };
const getScope = () => scopeSnapshot;
const serverScope = () => initialScope;
const useOrientationLayoutEffect = Platform.OS === 'web' ? useEffect : useLayoutEffect;

/** Reports existing startup state without changing the wizard, splash or routing decisions. */
export function OrientationScope({ startupCovered, setupComplete, onboardingPreviewActive }: Scope) {
  const token = useRef(Symbol('orientation-scope'));
  useOrientationLayoutEffect(() => {
    const id = token.current;
    return () => { scopes.delete(id); publishScopes(); };
  }, []);
  useOrientationLayoutEffect(() => {
    scopes.set(token.current, { startupCovered, setupComplete, onboardingPreviewActive });
    publishScopes();
  }, [startupCovered, setupComplete, onboardingPreviewActive]);
  return null;
}

const initialStatus: OrientationStatus = { desired: 'portrait', applied: null, pending: false, error: '' };
let status = initialStatus;
const statusListeners = new Set<() => void>();
const publishStatus = (next: OrientationStatus) => { status = next; statusListeners.forEach(listener => listener()); };
const subscribeStatus = (listener: () => void) => { statusListeners.add(listener); return () => { statusListeners.delete(listener); }; };
let retryNative = () => {};
// Preserve the physical queue through Strict Mode's effect cleanup/remount.
// Native orientation requests cannot be canceled by disposing a React effect.
let nativeOwner: ReturnType<typeof createOrientationController> | null = null;
let activeCoordinator: symbol | null = null;
export const retryOrientation = () => retryNative();
export function useOrientationStatus() { return useSyncExternalStore(subscribeStatus, () => status, () => initialStatus); }

function usePortraitPresentation(required: boolean) {
  const { width, height } = useWindowDimensions();
  // A browser follows its resizable viewport; it has no native app orientation owner.
  const portrait = Platform.OS === 'web' || width > 0 && height >= width;
  const waiting = required && !portrait;
  const [attempt, setAttempt] = useState(0);
  const wait = useMemo(() => ({ waiting, attempt }), [waiting, attempt]);
  const [expiredWait, setExpiredWait] = useState<typeof wait | null>(null);
  const native = useOrientationStatus();
  useEffect(() => {
    if (!waiting) return;
    const timeout = setTimeout(() => setExpiredWait(wait), 10000);
    return () => clearTimeout(timeout);
  }, [waiting, wait]);
  const retry = () => { retryOrientation(); setExpiredWait(null); setAttempt(value => value + 1); };
  return { waiting, failed: expiredWait === wait || !!native.error, retry };
}

function PortraitWait({ dark, failed, retry }: { dark: boolean; failed: boolean; retry: () => void }) {
  const foreground = dark ? '#F4F3EF' : '#202622';
  return <ScrollView accessibilityRole={failed ? 'alert' : undefined} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 20 }}>
    {!failed && <ActivityIndicator accessibilityLabel="Preparing portrait display" color={dark ? '#C8F169' : '#202622'} />}
    <Text style={{ color: foreground, fontSize: 18, lineHeight: 27, textAlign: 'center', maxWidth: 420 }}>{failed ? 'Turn your device upright to continue.' : 'Preparing portrait display…'}</Text>
    {failed && <>
      <Text style={{ color: foreground, fontSize: 14, lineHeight: 22, textAlign: 'center', maxWidth: 420 }}>If you are using a resizable window, make it taller than it is wide. Your saved setup has not changed.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Retry portrait display" onPress={retry} style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, backgroundColor: '#C8F169', opacity: pressed ? 0.65 : 1 })}><Text style={{ color: '#202622', fontSize: 16 }}>Retry portrait display</Text></Pressable>
    </>}
  </ScrollView>;
}

/** Do not start or run the welcome animation while its portrait window is unavailable. */
export function PortraitStartupGate({ children }: { children: React.ReactNode }) {
  const presentation = usePortraitPresentation(true);
  return <View style={{ flex: 1, backgroundColor: '#0D1011' }}>{presentation.waiting
    ? <PortraitWait dark failed={presentation.failed} retry={presentation.retry} /> : children}</View>;
}

/** Keep the mounted wizard and its draft alive while a delayed portrait request settles. */
export function PortraitRouteGuard({ required, children }: { required: boolean; children: React.ReactNode }) {
  const presentation = usePortraitPresentation(required);
  return <View style={{ flex: 1, backgroundColor: required ? '#F4F3EF' : undefined }}>
    <View pointerEvents={presentation.waiting ? 'none' : 'auto'} accessibilityElementsHidden={presentation.waiting} importantForAccessibility={presentation.waiting ? 'no-hide-descendants' : 'auto'} aria-hidden={presentation.waiting} style={{ flex: 1, display: presentation.waiting ? 'none' : 'flex' }}>{children}</View>
    {presentation.waiting && <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#F4F3EF' }}><PortraitWait dark={false} failed={presentation.failed} retry={presentation.retry} /></View>}
  </View>;
}

/** The only native orientation owner; it survives account workspace and public/private route changes. */
export function OrientationCoordinator({ publicPage }: { publicPage: boolean }) {
  const preferences = useUiPreferences();
  const scope = useSyncExternalStore(subscribeScope, getScope, serverScope);
  const { accountDataVersion } = useSession();
  const previousAccountVersion = useRef(accountDataVersion);
  const controller = useRef<ReturnType<typeof createOrientationController> | null>(null);
  const lease = useRef<symbol | null>(null);
  const top = useSegments()[0] as string | undefined;
  const policy = desiredOrientation({
    ...scope, publicRoute: publicPage, onboardingRoute: top === 'onboarding',
    preferencesLoaded: preferences.loaded, rotation: preferences.rotation,
  });

  useEffect(() => {
    if (previousAccountVersion.current !== accountDataVersion) {
      previousAccountVersion.current = accountDataVersion;
      resetUiPreferencesForAccountChange();
    }
  }, [accountDataVersion]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const owner = nativeOwner ??= createOrientationController(async next => {
      await ScreenOrientation.lockAsync(next === 'portrait'
        ? ScreenOrientation.OrientationLock.PORTRAIT_UP : ScreenOrientation.OrientationLock.DEFAULT);
    }, publishStatus);
    const ownership = Symbol('orientation-owner');
    activeCoordinator = ownership;
    lease.current = ownership;
    controller.current = owner;
    retryNative = () => owner.retry();
    owner.setActive(false);
    owner.request('portrait');
    const foreground = (state: string | null | undefined) => {
      if (activeCoordinator === ownership) owner.setActive(state !== 'background' && state !== 'inactive');
    };
    foreground(AppState.currentState);
    const listener = AppState.addEventListener('change', foreground);
    return () => {
      listener.remove();
      if (activeCoordinator === ownership) { owner.setActive(false); activeCoordinator = null; retryNative = () => {}; }
      if (controller.current === owner) controller.current = null;
      lease.current = null;
    };
  }, []);

  useEffect(() => { if (lease.current === activeCoordinator) controller.current?.request(policy); }, [policy]);
  return null;
}
