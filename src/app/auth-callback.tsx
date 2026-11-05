import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { AuthFlowScreen } from '../components/AuthFlowScreen';
import { AppButton, Label } from '../components/design';
import { completeAuthCallback } from '../lib/authLinks';
import { useSession } from '../lib/session';
import { cancelNativeAuth } from '../lib/neonAuth';

WebBrowser.maybeCompleteAuthSession();

export default function AuthCallback() {
  const linkedUrl = Linking.useURL();
  const params = useLocalSearchParams();
  const { beginPasswordRecovery } = useSession();
  const [failure, setFailure] = useState<{ url: string | null; attempt: number; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') query.append(key, value);
    else if (Array.isArray(value)) for (const item of value) query.append(key, item);
  }
  const callbackUrl = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href
    : query.toString() ? `pipwise://auth-callback?${query}` : linkedUrl;
  const error = failure?.url === callbackUrl && failure?.attempt === attempt ? failure.message : '';
  const leave = async () => {
    await cancelNativeAuth();
    router.replace('/auth');
  };

  useEffect(() => {
    let active = true;
    if (!callbackUrl) {
      const fallback = setTimeout(() => { if (active) setFailure({ url: callbackUrl, attempt, message: 'This sign-in link is incomplete. Open the newest link from your email or return to sign in.' }); }, 10000);
      return () => { active = false; clearTimeout(fallback); };
    }
    void completeAuthCallback(callbackUrl).then(({ recovery, token }) => {
      if (!active) return;
      if (recovery) beginPasswordRecovery();
      router.replace(recovery ? { pathname: '/reset-password', params: { token } } : '/auth');
    }).catch(cause => {
      if (active) setFailure({ url: callbackUrl, attempt, message: cause instanceof Error ? cause.message : 'This sign-in link did not finish. Request a new link and try again.' });
    });
    return () => { active = false; };
  }, [attempt, beginPasswordRecovery, callbackUrl]);

  return <AuthFlowScreen title="Finishing account access" detail="We’re checking your secure sign-in link." icon="shield-checkmark-outline">
    {error ? <><View accessibilityRole="alert"><Label color="#A33F32">{error}</Label></View><AppButton label="Try again" onPress={() => setAttempt(value => value + 1)} /><AppButton label="Back to sign in" variant="secondary" onPress={() => { void leave().catch(() => setFailure({ url: callbackUrl, attempt, message: 'Could not close this sign-in attempt. Please try again.' })); }} /></> : <View style={{ gap: 14, alignItems: 'center', paddingVertical: 12 }}><ActivityIndicator color="#63852D" /><Label color="#71766B">Connecting your account…</Label></View>}
  </AuthFlowScreen>;
}
