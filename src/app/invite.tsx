import { router } from 'expo-router';
import { ScreenSystemBars } from '../components/ScreenSystemBars';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppLogo } from '../components/AppLogo';
import { Icon, Label } from '../components/design';
import { ReferralCard } from '../components/ReferralCard';
import { referenceColors as c } from '../components/reference';
import { ThemeSurface } from '../lib/theme';

export default function Invite() {
  return <ThemeSurface tone="light"><SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
    <ScreenSystemBars style="dark" backgroundColor="#FFFFFF" />
    <ScrollView contentContainerStyle={{ maxWidth: 620, alignSelf: 'center', width: '100%', padding: 22, paddingBottom: 50, gap: 30 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}><Pressable accessibilityRole="button" accessibilityLabel="Back to profile" onPress={() => router.replace('/profile')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: c.bg }}><Icon name="arrow-back" color={c.ink} /></Pressable><Label bold size={23} color={c.ink}>Better together</Label></View>
      <View style={{ alignItems: 'center', gap: 16, paddingVertical: 12 }}><AppLogo size={76} /><Label bold size={26} color={c.ink} style={{ textAlign: 'center' }}>Build your trading circle.</Label><Label color={c.muted} style={{ textAlign: 'center', maxWidth: 400 }}>Invite a friend to learn, practice, and compare notes. Every confident trader starts with a little curiosity.</Label></View>
      <ReferralCard />
      <Label size={11} color={c.muted} style={{ textAlign: 'center' }}>Invitation links open the installed PipWise app. They do not activate a paid membership.</Label>
    </ScrollView>
  </SafeAreaView></ThemeSurface>;
}
