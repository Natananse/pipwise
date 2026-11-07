import { Ionicons } from '@expo/vector-icons';
import { router, useSegments } from 'expo-router';
import React, { useId, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View, ViewStyle, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { money } from '../lib/market';
import { summary } from '../lib/simulator';
import { useDemoMarket } from '../lib/demoMarketProvider';
import { contentBottomPadding, floatingFooterBottom, navigationLayout } from '../lib/navigation';
import { responsiveLayout } from '../lib/responsiveLayout';
import { ThemeSurface } from '../lib/theme';
import { useWorkspace } from '../lib/workspace';
import { ErrorState, Icon, Label, LoadingState, Row } from './design';
import { ScreenSystemBars } from './ScreenSystemBars';

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
  const compact = responsiveLayout({ ...useWindowDimensions(), insets }).compactHeight;
  const { wallet } = useWorkspace();
  const { quotes } = useDemoMarket();
  return <View style={{ paddingTop: insets.top + (compact ? 6 : 14), paddingBottom: compact ? 6 : 16, paddingHorizontal: 16, overflow: 'hidden' }}>
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
  const insets = useSafeAreaInsets(); const dimensions = useWindowDimensions(); const wide = dimensions.width > navigationLayout.wideBreakpoint;
  const compact = responsiveLayout({ ...dimensions, insets }).compactHeight;
  const tabRoute = useSegments()[0] === '(tabs)';
  const [footerHeight, setFooterHeight] = useState(90);
  const clearance = { bottomInset: insets.bottom, wide, tabRoute };
  const { loaded, storageError } = useWorkspace();
  return <View style={{ flex: 1, backgroundColor: referenceColors.bg, paddingLeft: insets.left, paddingRight: insets.right }}>
    <ScreenSystemBars style={header === undefined ? 'light' : 'dark'} navigationStyle="dark" backgroundColor={referenceColors.bg} />
    {header === undefined ? <ReferenceHeader /> : header}
    {!loaded ? <LoadingState /> : <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} automaticallyAdjustKeyboardInsets={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: compact ? 12 : 18, gap: compact ? 12 : 22, maxWidth: 1120, width: '100%', alignSelf: 'center', ...contentStyle, paddingBottom: contentBottomPadding({ ...clearance, contentGap: compact ? 12 : wide ? 32 : 20, footerHeight: footer ? footerHeight : 0 }) }}>{storageError ? <ErrorState message={storageError} /> : null}{children}</ScrollView>}
    {footer && <View onLayout={event => setFooterHeight(event.nativeEvent.layout.height)} style={{ position: 'absolute', left: insets.left, right: insets.right, bottom: floatingFooterBottom(clearance), backgroundColor: referenceColors.bg, borderTopWidth: 1, borderColor: referenceColors.line }}><View style={{ width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: 18, paddingVertical: compact ? 8 : 12 }}>{footer}</View></View>}
  </View>;
}
