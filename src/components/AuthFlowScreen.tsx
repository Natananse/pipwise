import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fonts, ThemeSurface } from '../lib/theme';
import { AppLogo } from './AppLogo';
import { Icon, Label } from './design';
import { ScreenSystemBars } from './ScreenSystemBars';
import { responsiveLayout } from '../lib/responsiveLayout';

export function AuthFlowScreen({ title, detail, icon, children }: {
  title: string; detail: string; icon: React.ComponentProps<typeof Icon>['name']; children: React.ReactNode;
}) {
  const compact = responsiveLayout(useWindowDimensions()).compactHeight;
  return <ThemeSurface tone="light"><SafeAreaView style={{ flex: 1, backgroundColor: '#F4F3EF' }}>
    <ScreenSystemBars style="dark" backgroundColor="#F4F3EF" />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
      <ScrollView automaticallyAdjustKeyboardInsets={false} keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: 24, paddingVertical: compact ? 12 : 24, gap: compact ? 16 : 28 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><AppLogo size={38} decorative /><Label bold size={22} color="#0D1011" style={{ fontFamily: fonts.extraBold, letterSpacing: -0.8 }}>pipwise<Label size={22} color="#63852D">.</Label></Label></View>
        <View style={{ gap: compact ? 10 : 15, marginTop: compact ? 4 : 20 }}><View style={{ width: compact ? 44 : 60, height: compact ? 44 : 60, borderRadius: compact ? 16 : 22, backgroundColor: '#0D1011', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={compact ? 23 : 27} color="#C8F169" /></View><Label size={compact ? 26 : 30} bold color="#0D1011" style={{ fontFamily: fonts.extraBold, letterSpacing: -1 }}>{title}</Label><Label size={13} color="#71766B">{detail}</Label></View>
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 26, borderWidth: 1, borderColor: '#E7E7E0', padding: 20, gap: 18 }}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView></ThemeSurface>;
}
