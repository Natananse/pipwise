import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput } from 'react-native';
import { Button, Screen, Title } from '../components/ui';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';

WebBrowser.maybeCompleteAuthSession();

export default function Auth() {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signUp, setSignUp] = useState(false);
  const [busy, setBusy] = useState(false);

  // On success the session listener updates and the guard moves us to the app.
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch (e: any) { Alert.alert('Could not sign in', e?.message ?? 'Check your connection and try again.'); }
    finally { setBusy(false); }
  };

  const submit = () => run(async () => {
    if (!email.trim() || password.length < 6) throw new Error('Enter an email and a password of at least 6 characters.');
    if (signUp) {
      if (!supabase) throw new Error('Supabase is not configured. Add its URL and anon key to .env, then restart Expo.');
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
      if (error) throw error;
      if (!data.session) Alert.alert('Check your email', 'Confirm your account, then sign in.');
    } else {
      if (!supabase) throw new Error('Supabase is not configured. Add its URL and anon key to .env, then restart Expo.');
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
    }
  });

  const google = () => run(async () => {
    const redirectTo = makeRedirectUri({ scheme: 'pipwise', path: 'auth-callback' });
    if (!supabase) throw new Error('Supabase is not configured. Add its URL and anon key to .env, then restart Expo.');
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
    if (error || !data.url) throw error ?? new Error('Google sign-in is not available.');
    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (res.type !== 'success') return;
    const p = new URLSearchParams(res.url.split('#')[1] ?? '');
    const access_token = p.get('access_token'), refresh_token = p.get('refresh_token');
    if (!access_token || !refresh_token) throw new Error('Google sign-in did not finish. Try again.');
    const { error: e2 } = await supabase.auth.setSession({ access_token, refresh_token });
    if (e2) throw e2;
  });

  const input = { borderWidth: 1, borderColor: colors.border, color: colors.text, backgroundColor: colors.card, borderRadius: 10, padding: 12, fontSize: 16 };
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: 12, paddingTop: 32 }} keyboardShouldPersistTaps="handled">
        <Title>{signUp ? 'Create your account' : 'Welcome back'}</Title>
        <TextInput style={input} placeholder="Email" placeholderTextColor={colors.sub} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <TextInput style={input} placeholder="Password" placeholderTextColor={colors.sub} secureTextEntry value={password} onChangeText={setPassword} />
        <Button label={signUp ? 'Create account' : 'Sign in'} onPress={submit} busy={busy} />
        <Button label="Continue with Google" variant="outline" onPress={google} disabled={busy} />
        <Pressable onPress={() => setSignUp(!signUp)} style={{ alignItems: 'center', padding: 8 }}>
          <Text style={{ color: colors.primary, fontSize: 16 }}>{signUp ? 'I already have an account' : 'Create a new account'}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
