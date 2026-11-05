import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useId } from 'react';
import { Pressable, ScrollView, StyleSheet, View, ViewStyle, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { money } from '../lib/market';
import { summary } from '../lib/simulator';
import { useDemoMarket } from '../lib/demoMarketProvider';
import { navigationLayout, tabBarClearance } from '../lib/navigation';
import { ThemeSurface } from '../lib/theme';
import { useWorkspace } from '../lib/workspace';
import { ErrorState, Icon, Label, LoadingState, Row } from './design';

export const referenceColors = {
  bg: '#F4F6F1', white: '#FFFFFF', ink: '#202622', muted: '#68736A',
  // Retain legacy accent names so existing screens inherit the new palette.
  blue: '#202622', green: '#138360', red: '#C44850', line: '#E1E6DE', purple: '#C7D8C3',
  charcoal: '#191D1B', mint: '#00DDA8', lemon: '#F5F749',
  heroStart: '#191D1B', heroEnd: '#303B32',
};
export function ReferenceGradient({ style }: { style?: ViewStyle }) {
  const id = useId().replace(/:/g, '');
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: referenceColors.charcoal }, style]}><Svg width="100%" height="100%"><Defs><LinearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%"><Stop offset="0" stopColor={referenceColors.heroStart} /><Stop offset="1" stopColor={referenceColors.heroEnd} /></LinearGradient></Defs><Rect width="100%" height="100%" fill={`url(#${id})`} /><Rect x="0" y="98%" width="100%" height="2%" fill={referenceColors.mint} opacity={0.5} /></Svg></View>;
}
export function CoinMark({ size = 26 }: { size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: referenceColors.lemon, borderWidth: 2, borderColor: referenceColors.charcoal, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: size - 8, height: size - 8, borderRadius: size / 2, borderWidth: 1, borderColor: '#9FA534', alignItems: 'center', justifyContent: 'center' }}><Label bold size={size * 0.5} color={referenceColors.charcoal}>$</Label></View></View>;
}
export function ReferenceHeader() {
  const insets = useSafeAreaInsets();
  const { wallet } = useWorkspace();
  const { quotes } = useDemoMarket();
  return <View style={{ paddingTop: insets.top + 14, paddingBottom: 16, paddingHorizontal: 16, overflow: 'hidden' }}>
    <ReferenceGradient />
    <Row style={{ maxWidth: 1120, width: '100%', alignSelf: 'center', gap: 10, flexWrap: 'wrap' }}>
      <Pressable accessibilityRole="button" accessibilityLabel="View virtual portfolio" onPress={() => router.push('/portfolio')} style={({ pressed }) => ({ minHeight: 42, borderRadius: 26, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#FFFFFF65', backgroundColor: '#FFFFFF16', opacity: pressed ? 0.65 : 1 })}><CoinMark /><Label size={15} bold color="white">{money(summary(wallet, quotes).equity).replace('$', '')}</Label></Pressable>
      <Row style={{ gap: 12 }}><ReferenceRoundButton name="folder-open-outline" label="Portfolio and trade history" onPress={() => router.push('/portfolio')} /><Pressable accessibilityRole="button" accessibilityLabel="Explore Pro" onPress={() => router.push('/paywall')} style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: 15, borderRadius: 24, backgroundColor: referenceColors.lemon, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.65 : 1 })}><Label bold size={13} color={referenceColors.charcoal}>PRO</Label></Pressable></Row>
    </Row>
  </View>;
}
export function ReferenceRoundButton({ name, label, onPress }: { name: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ height: 40, width: 40, borderRadius: 22, borderWidth: 1, borderColor: '#FFFFFF65', backgroundColor: '#FFFFFF16', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.65 : 1 })}><Icon name={name} size={22} color="white" /></Pressable>;
}
export function ReferenceCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[{ backgroundColor: 'white', borderRadius: 24, borderWidth: 1, borderColor: referenceColors.line, padding: 20, gap: 16 }, style]}>{children}</View>;
}
export function ReferenceScreen({ children, header, contentStyle, footer }: { children: React.ReactNode; header?: React.ReactNode; contentStyle?: ViewStyle; footer?: React.ReactNode }) {
  return <ThemeSurface tone="light"><ReferenceScreenBody header={header} contentStyle={contentStyle} footer={footer}>{children}</ReferenceScreenBody></ThemeSurface>;
}
function ReferenceScreenBody({ children, header, contentStyle, footer }: { children: React.ReactNode; header?: React.ReactNode; contentStyle?: ViewStyle; footer?: React.ReactNode }) {
  const insets = useSafeAreaInsets(); const wide = useWindowDimensions().width > navigationLayout.wideBreakpoint;
  const dockClearance = tabBarClearance(insets.bottom);
  const { loaded, storageError } = useWorkspace();
  return <View style={{ flex: 1, backgroundColor: referenceColors.bg, paddingLeft: insets.left, paddingRight: insets.right }}>
    <StatusBar style="light" />
    {header === undefined ? <ReferenceHeader /> : header}
    {!loaded ? <LoadingState /> : <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 18, gap: 22, maxWidth: 1120, width: '100%', alignSelf: 'center', ...contentStyle, paddingBottom: (wide ? 32 : dockClearance + 20) + (footer ? 90 : 0) }}>{storageError ? <ErrorState message={storageError} /> : null}{children}</ScrollView>}
    {footer && <View style={{ position: 'absolute', left: insets.left, right: insets.right, bottom: wide ? 0 : dockClearance + 10, backgroundColor: referenceColors.bg, borderTopWidth: 1, borderColor: referenceColors.line }}><View style={{ width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 12 }}>{footer}</View></View>}
  </View>;
}
