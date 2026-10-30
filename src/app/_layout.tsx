import { Href, Slot, useRouter, useSegments } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '../lib/session';
import { ThemeProvider } from '../lib/theme';

// Order: disclaimer, onboarding, sign-in, then the app.
function Guard() {
  const { ready, session, disclaimerAccepted, onboarded } = useSession();
  const top = useSegments()[0] as string | undefined;
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    let to: string | null = null;
    if (!disclaimerAccepted) to = top === 'disclaimer' ? null : '/disclaimer';
    else if (!onboarded) to = top === 'onboarding' ? null : '/onboarding';
    else if (!session) to = top === 'auth' ? null : '/auth';
    else if (['disclaimer', 'onboarding', 'auth', undefined].includes(top)) to = '/news';
    if (to) router.replace(to as Href);
  }, [ready, session, disclaimerAccepted, onboarded, top]);
  if (!ready) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  return <Slot />;
}

export default function Root() {
  return (
    <SafeAreaProvider><ThemeProvider><SessionProvider><Guard /></SessionProvider></ThemeProvider></SafeAreaProvider>
  );
}
