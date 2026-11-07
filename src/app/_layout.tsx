import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LaunchSplash } from '../components/LaunchSplash';
import { WelcomeArtwork } from '../components/WelcomeArtwork';
import { AppButton, Label } from '../components/design';
import { hasCompleteOnboardingAnswers } from '../lib/onboarding';
import { SessionProvider, useSession } from '../lib/session';
import { startupRedirect } from '../lib/startup';
import { ThemeProvider, ThemeSurface } from '../lib/theme';
import { CURRENT_ONBOARDING_VERSION, WorkspaceProvider, useWorkspace } from '../lib/workspace';
import { DemoMarketProvider, useDemoMarketStatus } from '../lib/demoMarketProvider';
import { resumePersistenceAfterAccountDeletion } from '../lib/persistence';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Guard({ fontsReady }: { fontsReady: boolean }) {
  const { ready, initializationError, retryInitialization, session, demo, onboarded, onboardingPreviewActive, passwordRecovery } = useSession();
  const { loaded, language, preferences, onboardingVersion, initializationError: workspaceError, retryInitialization: retryWorkspace } = useWorkspace();
  const { ready: demoPricesReady, initializationError: demoPricesError, retryInitialization: retryDemoPrices } = useDemoMarketStatus();
  const [splashFinished, setSplashFinished] = useState(false);
  const [laidOut, setLaidOut] = useState(false);
  const finishSplash = useCallback(() => setSplashFinished(true), []);
  const top = useSegments()[0] as string | undefined;
  const router = useRouter();
  const error = initializationError || workspaceError || demoPricesError;
  const hasCurrentSetup = onboardingVersion >= CURRENT_ONBOARDING_VERSION;
  const resourcesReady = fontsReady && ready && loaded && demoPricesReady && !error;
  const redirect = resourcesReady ? startupRedirect({ onboarded: onboarded && !onboardingPreviewActive, answersComplete: hasCurrentSetup && hasCompleteOnboardingAnswers(preferences), authenticated: !!session || demo, top, passwordRecovery }) : null;

  useEffect(() => {
    if (redirect) router.replace(redirect);
  }, [redirect, router]);
  useEffect(() => {
    // The JS splash is already mounted; font loading must not trap the native icon.
    if (laidOut) SplashScreen.hide();
  }, [laidOut]);

  const covered = !resourcesReady || !splashFinished || !!redirect;
  return <View style={{ flex: 1, backgroundColor: '#0C100F' }} onLayout={() => setLaidOut(true)}>
    <View style={{ flex: 1 }} pointerEvents={covered ? 'none' : 'auto'} accessibilityElementsHidden={covered} importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'} aria-hidden={covered}><Slot /></View>
    {covered && <View style={StyleSheet.absoluteFill}><ThemeSurface tone="dark" systemBars>
      {fontsReady && error ? <SafeAreaView style={{ flex: 1, backgroundColor: '#0C100F', padding: 24, justifyContent: 'center', gap: 24 }}>
        <WelcomeArtwork compact reducedMotion />
        <Label bold size={24} style={{ textAlign: 'center' }}>Let’s get you back in.</Label>
        <View accessibilityRole="alert"><Label muted style={{ textAlign: 'center' }}>{error} Your saved data has not been cleared.</Label></View>
        <AppButton label="Try again" onPress={() => { retryInitialization(); retryWorkspace(); retryDemoPrices(); }} />
      </SafeAreaView> : splashFinished ? <View style={{ flex: 1, backgroundColor: '#0C100F' }} /> : <LaunchSplash fontsReady={fontsReady} resourcesReady={resourcesReady && !redirect} language={language} onComplete={finishSplash} />}
    </ThemeSurface></View>}
  </View>;
}

export default function Root() {
  const top = useSegments()[0] as string | undefined;
  const publicPage = top === 'privacy-policy' || top === 'delete-account';
  const [fontsLoaded, fontError] = useFonts({ ...Ionicons.font, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold });
  const [fontFallback, setFontFallback] = useState(false);
  useEffect(() => {
    if (fontsLoaded || fontError) return;
    const fallback = setTimeout(() => setFontFallback(true), 5000);
    return () => clearTimeout(fallback);
  }, [fontError, fontsLoaded]);
  return <SafeAreaProvider><ThemeProvider><SessionProvider>
    <AccountWorkspace fontsReady={fontsLoaded || !!fontError || fontFallback} publicPage={publicPage} />
  </SessionProvider></ThemeProvider></SafeAreaProvider>;
}

function AccountWorkspace({ fontsReady, publicPage }: { fontsReady: boolean; publicPage: boolean }) {
  const { accountDataVersion } = useSession();
  // Navigation during a timed-out erase must not resume writes before the
  // physical cleanup completes and advances the account-data generation.
  useEffect(() => { resumePersistenceAfterAccountDeletion(); }, [accountDataVersion]);
  // Public pages never wait for a saved wallet, onboarding, or an Auth response.
  if (publicPage) return <View style={{ flex: 1 }} onLayout={() => SplashScreen.hide()}><Slot /></View>;
  return <DemoMarketProvider key={accountDataVersion}><WorkspaceProvider>
    <Guard fontsReady={fontsReady} />
  </WorkspaceProvider></DemoMarketProvider>;
}
