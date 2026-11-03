import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
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
import { WorkspaceProvider, useWorkspace } from '../lib/workspace';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Guard({ fontsReady }: { fontsReady: boolean }) {
  const { ready, initializationError, retryInitialization, session, demo, onboarded } = useSession();
  const { loaded, language, preferences, initializationError: workspaceError, retryInitialization: retryWorkspace } = useWorkspace();
  const [splashFinished, setSplashFinished] = useState(false);
  const [laidOut, setLaidOut] = useState(false);
  const finishSplash = useCallback(() => setSplashFinished(true), []);
  const top = useSegments()[0] as string | undefined;
  const router = useRouter();
  const error = initializationError || workspaceError;
  const resourcesReady = fontsReady && ready && loaded && !error;
  const redirect = resourcesReady ? startupRedirect({ onboarded, answersComplete: hasCompleteOnboardingAnswers(preferences), authenticated: !!session || demo, top }) : null;

  useEffect(() => {
    if (redirect) router.replace(redirect);
  }, [redirect, router]);
  useEffect(() => {
    // The animated surface is already laid out before removing the native screen.
    if (laidOut && fontsReady) SplashScreen.hide();
  }, [fontsReady, laidOut]);

  const covered = !resourcesReady || !splashFinished || !!redirect;
  return <View style={{ flex: 1, backgroundColor: '#0D1011' }} onLayout={() => setLaidOut(true)}>
    <View style={{ flex: 1 }} accessibilityElementsHidden={covered} importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}><Slot /></View>
    {covered && <View style={StyleSheet.absoluteFill}><ThemeSurface tone="dark">
      {fontsReady && error ? <SafeAreaView style={{ flex: 1, backgroundColor: '#0D1011', padding: 24, justifyContent: 'center', gap: 24 }}>
        <WelcomeArtwork compact reducedMotion />
        <Label bold size={24} style={{ textAlign: 'center' }}>Let’s get you back in.</Label>
        <View accessibilityRole="alert"><Label muted style={{ textAlign: 'center' }}>{error} Your saved data has not been cleared.</Label></View>
        <AppButton label="Try again" onPress={() => { retryInitialization(); retryWorkspace(); }} />
      </SafeAreaView> : splashFinished ? <View style={{ flex: 1, backgroundColor: '#0D1011' }} /> : <LaunchSplash fontsReady={fontsReady} resourcesReady={resourcesReady && !redirect} language={language} onComplete={finishSplash} />}
    </ThemeSurface></View>}
  </View>;
}

export default function Root() {
  const [fontsLoaded, fontError] = useFonts({ Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold });
  return <SafeAreaProvider><ThemeProvider><SessionProvider><WorkspaceProvider>
    <Guard fontsReady={fontsLoaded || !!fontError} />
  </WorkspaceProvider></SessionProvider></ThemeProvider></SafeAreaProvider>;
}
