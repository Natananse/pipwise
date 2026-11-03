import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Share, Text, View } from 'react-native';
import { useSession } from '../lib/session';
import { fonts } from '../lib/theme';
import { Icon, Label } from './design';
import { referenceColors as c } from './reference';

let localCodeRequest: Promise<string> | undefined;
function localInviteCode() {
  if (!localCodeRequest) localCodeRequest = AsyncStorage.getItem('pipwise.invite.code.v1').then(async existing => {
    if (existing) return existing;
    const code = `PIP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    await AsyncStorage.setItem('pipwise.invite.code.v1', code);
    return code;
  }).catch(error => { localCodeRequest = undefined; throw error; });
  return localCodeRequest;
}

export function ReferralCard({ compact = false }: { compact?: boolean }) {
  const { session } = useSession();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [sharing, setSharing] = useState(false);
  useEffect(() => {
    let active = true;
    if (session?.user.id) {
      // An app invitation identifier, never an authentication credential.
      const accountCode = `PIP-${session.user.id.replace(/-/g, '').slice(-8).toUpperCase()}`;
      void Promise.resolve().then(() => { if (active) setCode(accountCode); });
    } else {
      void localInviteCode().then(value => { if (active) setCode(value); }).catch(() => { if (active) setMessage('Your invite code could not be saved. Try again after reopening this screen.'); });
    }
    return () => { active = false; };
  }, [session?.user.id]);
  const inviteLink = code ? `pipwise://onboarding?ref=${encodeURIComponent(code)}` : '';
  const share = async () => {
    if (!code || sharing) return;
    setSharing(true);
    setMessage('');
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteLink);
        setMessage('Invite link copied. It opens Pipwise on devices where the app is installed.');
      } else {
        await Share.share({ title: 'Practice with me on Pipwise', message: `Build confidence with virtual trading on Pipwise. My invite code is ${code}. Open the app: ${inviteLink}` });
      }
    } catch {
      setMessage('Sharing is unavailable here. Press and hold the link to copy it.');
    } finally { setSharing(false); }
  };
  return <View style={{ backgroundColor: '#F8F5ED', borderRadius: 26, padding: compact ? 20 : 25, gap: 20, marginTop: 12 }}>
    <View style={{ backgroundColor: '#FF9392', borderRadius: 99, alignSelf: 'center', paddingHorizontal: 17, paddingVertical: 7, marginTop: -38 }}><Label bold size={11} color="#FFFFFF">INVITE PROGRAM PREVIEW</Label></View>
    <Label bold size={compact ? 21 : 24} color={c.ink} style={{ textAlign: 'center', lineHeight: 33 }}>INVITE FRIENDS. PRACTICE TOGETHER.</Label>
    <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
      {[1, 2, 3, 4, 5].map(number => <View key={number} style={{ width: compact ? 36 : 42, height: compact ? 36 : 42, borderRadius: 24, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#CEC8DB', alignItems: 'center', justifyContent: 'center' }}><Label bold size={17} color="#A8AAB5">{number}</Label></View>)}
    </View>
    <Label size={12} color={c.muted} style={{ textAlign: 'center' }}>Share your code with your study circle. Referral rewards will be announced when the program launches.</Label>
    <View style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E6E9', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7 }}>
      <Text selectable accessibilityLabel="Your Pipwise invitation link" style={{ fontFamily: fonts.medium, fontSize: 12, color: c.muted, minHeight: 40, paddingVertical: 11 }}>{inviteLink || 'Preparing your invitation…'}</Text>
    </View>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !code || sharing, busy: sharing }} disabled={!code || sharing} onPress={() => { void share(); }} style={({ pressed }) => ({ minHeight: 55, borderRadius: 20, backgroundColor: c.green, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9, opacity: !code ? 0.45 : pressed ? 0.75 : 1 })}>
      {sharing ? <ActivityIndicator color="#0F4731" /> : <><Icon name={Platform.OS === 'web' ? 'copy-outline' : 'share-social-outline'} size={19} color="#0F4731" /><Label bold size={15} color="#0F4731">{Platform.OS === 'web' ? 'Copy invite link' : 'Share invite link'}</Label></>}
    </Pressable>
    {!!message && <View accessibilityRole="alert"><Label size={11} color={c.ink} style={{ textAlign: 'center' }}>{message}</Label></View>}
  </View>;
}
