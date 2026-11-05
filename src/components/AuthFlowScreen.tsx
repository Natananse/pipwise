import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fonts, ThemeSurface } from '../lib/theme';
import { AppLogo } from './AppLogo';
import { Icon, Label } from './design';

export function AuthFlowScreen({ title, detail, icon, children }: {
  title: string; detail: string; icon: React.ComponentProps<typeof Icon>['name']; children: React.ReactNode;
}) {
  return <ThemeSurface tone="light"><SafeAreaView style={{ flex: 1, backgroundColor: '#F4F3EF' }}>
    <StatusBar style="dark" />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 24, gap: 28 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><AppLogo size={38} decorative /><Label bold size={22} color="#0D1011" style={{ fontFamily: fonts.extraBold, letterSpacing: -0.8 }}>pipwise<Label size={22} color="#63852D">.</Label></Label></View>
        <View style={{ gap: 15, marginTop: 20 }}><View style={{ width: 60, height: 60, borderRadius: 22, backgroundColor: '#0D1011', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={27} color="#C8F169" /></View><Label size={30} bold color="#0D1011" style={{ fontFamily: fonts.extraBold, letterSpacing: -1 }}>{title}</Label><Label size={13} color="#71766B">{detail}</Label></View>
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 26, borderWidth: 1, borderColor: '#E7E7E0', padding: 20, gap: 18 }}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView></ThemeSurface>;
}
