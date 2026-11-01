import { Href, Slot, useRouter, useSegments } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '../lib/session';
import { ThemeProvider } from '../lib/theme';

// Order: disclaimer, onboarding, sign-in, then the app.
function Guard() {
  const { ready, session, disclaimerAccepted, onboarded, supabaseConfigured } = useSession();
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
  if (!supabaseConfigured) return <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
    <Text style={{ fontSize: 24, fontWeight: '700' }}>Supabase setup needed</Text>
    <Text>Add your Supabase project URL and anon key to a `.env` file using `.env.example`, then restart Expo.</Text>
  </View>;
  return <Slot />;
}

export default function Root() {
  return (
    <SafeAreaProvider><ThemeProvider><SessionProvider><Guard /></SessionProvider></ThemeProvider></SafeAreaProvider>
  );
}
