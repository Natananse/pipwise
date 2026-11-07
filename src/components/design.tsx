import { Ionicons } from '@expo/vector-icons';
import { router, useSegments } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, TextStyle, View, ViewStyle, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, ThemeSurface, useTheme, type Colors } from '../lib/theme';
import { contentBottomPadding, navigationLayout } from '../lib/navigation';
import { focusedFieldScrollOffset, responsiveLayout } from '../lib/responsiveLayout';
import { useWorkspace } from '../lib/workspace';
import { AppLogo } from './AppLogo';
import { ModalSystemBars, ScreenSystemBars } from './ScreenSystemBars';
export { ScreenSystemBars };
export { TradeSurface, TradeTopBar, TradeAssetTile, TradeSparkline, TradeHeroQuote, TradeChartCard, TradeFooter, TradeActionButton, TradeSkeleton } from './TradePresentation';
// Compatibility for screens outside this restyle; new screens use colors directly.
export const tokens = { space: 24, radius: 24, lime: '#C8F169', navy: '#0D1011', red: '#B83A33', green: '#117A4B' };
export function Icon({ name, size = 20, color }: { name: keyof typeof Ionicons.glyphMap; size?: number; color?: string }) {
  const { colors } = useTheme();
  return <Ionicons name={name} size={size} color={color || colors.text} />;
}
export function Label({ children, size = 14, muted = false, bold = false, color, style }: { children: React.ReactNode; size?: number; muted?: boolean; bold?: boolean; color?: string; style?: TextStyle }) {
  const { colors } = useTheme();
  return <Text style={[{ color: color || (muted ? colors.sub : colors.text), fontSize: size, fontFamily: bold ? fonts.bold : fonts.medium, lineHeight: size * 1.45, fontVariant: ['tabular-nums'] }, style]}>{children}</Text>;
}
export function Brand({ large = false }: { large?: boolean }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><AppLogo size={large ? 96 : 40} />{!large && <Label size={22} bold>PipWise.</Label>}</View>;
}
export function AppButton({ label, onPress, variant = 'primary', icon, disabled, busy, compact = false }: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; icon?: keyof typeof Ionicons.glyphMap; disabled?: boolean; busy?: boolean; compact?: boolean }) {
  const { colors } = useTheme();
  const fg = variant === 'primary' ? colors.onPrimary : variant === 'danger' ? colors.down : colors.text;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress} style={({ pressed }) => ({ minHeight: compact ? 44 : 56, paddingHorizontal: compact ? 16 : 24, paddingVertical: 8, borderRadius: 100, backgroundColor: variant === 'primary' ? colors.primary : variant === 'ghost' ? colors.transparent : colors.raised, borderWidth: variant === 'secondary' || variant === 'danger' ? 1 : 0, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: disabled ? 0.4 : pressed ? 0.65 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}>{busy ? <ActivityIndicator color={fg} /> : <>{icon && <Icon name={icon} color={fg} size={18} />}<Label bold color={fg}>{label}</Label></>}</Pressable>;
}
export function IconButton({ name, label, onPress }: { name: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.raised, opacity: pressed ? 0.6 : 1 })}><Icon name={name} /></Pressable>;
}
export function GlassCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return <View style={[{ backgroundColor: colors.card, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: 24, gap: 16 }, style]}>{children}</View>;
}
export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, style]}>{children}</View>;
}
export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 16, paddingVertical: 8, justifyContent: 'center', borderRadius: 24, backgroundColor: selected ? colors.text : colors.raised, opacity: pressed ? 0.65 : 1 })}><Label size={12} bold color={selected ? colors.bg : colors.sub}>{label}</Label></Pressable>;
}
export function Badge({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <View style={{ alignSelf: 'flex-start', backgroundColor: colors.raised, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}><Label size={10} bold color={colors.sub}>{children}</Label></View>;
}
export function AppInput({ label, ...props }: TextInputProps & { label: string }) {
  const { colors } = useTheme();
  return <View style={{ gap: 8 }}><Label size={12} bold>{label}</Label><TextInput accessibilityLabel={label} placeholderTextColor={colors.sub} {...props} style={[{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, minHeight: 52, backgroundColor: colors.raised, color: colors.text, fontFamily: fonts.medium, fontSize: 15 }, props.style]} /></View>;
}
export function EmptyState({ title, detail, icon = 'layers-outline' }: { title: string; detail: string; icon?: keyof typeof Ionicons.glyphMap }) {
  const { colors } = useTheme();
  return <View style={{ alignItems: 'center', padding: 24, gap: 8 }}><Icon name={icon} size={28} color={colors.sub} /><Label bold style={{ textAlign: 'center' }}>{title}</Label><Label muted size={13} style={{ textAlign: 'center', maxWidth: 320 }}>{detail}</Label></View>;
}
export function LoadingState() {
  const { colors } = useTheme();
  return <View style={{ padding: 48, alignItems: 'center', gap: 8 }}><ActivityIndicator color={colors.sub} /><Label muted>Preparing your workspace…</Label></View>;
}
export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  const { colors } = useTheme();
  return <View accessibilityRole="alert" style={{ padding: 16, gap: 8 }}><Label color={colors.down}>{message}</Label>{retry && <AppButton label="Try again" onPress={retry} variant="secondary" />}</View>;
}
type SheetProps = { visible: boolean; onClose: () => void; title: string; children: React.ReactNode };
export function Sheet({ visible, onClose, title, children }: SheetProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const content = <ThemeSurface tone="light">{visible && <ModalSystemBars centered={width > 700} />}<SheetContent colors={colors} onClose={onClose} title={title}>{children}</SheetContent></ThemeSurface>;
  return <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']} animationType="fade" onRequestClose={onClose}>
    {Platform.OS === 'web' ? content : <SafeAreaProvider>{content}</SafeAreaProvider>}
  </Modal>;
}
function SheetContent({ colors, onClose, title, children }: Omit<SheetProps, 'visible'> & { colors: Colors }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [frameHeight, setFrameHeight] = useState<number | null>(null);
  const compact = responsiveLayout({ width, height: frameHeight ?? height, insets }).compactHeight;
  const scroll = useRef<React.ElementRef<typeof ScrollView>>(null);
  const offset = useRef(0);
  const focusedWithin = useRef(false);
  const focusFrame = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const revealFocused = useCallback(() => {
    if (Platform.OS === 'web' || !focusedWithin.current) return;
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    focusFrame.current = requestAnimationFrame(() => {
      focusFrame.current = null;
      if (!focusedWithin.current) return;
      const input = TextInput.State.currentlyFocusedInput();
      const viewport = scroll.current;
      if (!input || !viewport) return;
      input.measureInWindow((_x, top, _width, fieldHeight) => viewport.measureInWindow((_left, viewportTop, _w, viewportHeight) => {
        if (!focusedWithin.current || scroll.current !== viewport || TextInput.State.currentlyFocusedInput() !== input) return;
        const next = focusedFieldScrollOffset({ offset: offset.current, viewportTop, viewportHeight, fieldTop: top, fieldHeight });
        if (Math.abs(next - offset.current) > 1) viewport.scrollTo({ y: next, animated: false });
      }));
    });
  }, []);
  useEffect(() => () => { if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current); }, []);
  return <KeyboardAvoidingView behavior={Platform.OS === 'web' ? undefined : 'padding'} style={{ flex: 1 }}>
    <View onLayout={event => setFrameHeight(event.nativeEvent.layout.height)} style={{ flex: 1, backgroundColor: colors.overlay, paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right, justifyContent: width > 700 && !compact ? 'center' : 'flex-end', alignItems: 'center' }}>
      <Pressable accessibilityLabel="Close dialog" accessibilityRole="button" onPress={onClose} style={StyleSheet.absoluteFill} />
      <SafeAreaView edges={['bottom']} style={{ width: '100%', maxWidth: 560, maxHeight: compact ? '100%' : '92%', flexShrink: 1, backgroundColor: colors.sheet, borderTopLeftRadius: compact ? 20 : 32, borderTopRightRadius: compact ? 20 : 32, borderBottomLeftRadius: width > 700 && !compact ? 32 : 0, borderBottomRightRadius: width > 700 && !compact ? 32 : 0, padding: compact ? 12 : 24 }}>
        {!compact && <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.sheetBorder, alignSelf: 'center', marginBottom: 16 }} />}
        <Row><Label size={compact ? 18 : 22} bold style={{ flex: 1 }}>{title}</Label><IconButton name="close" label="Close" onPress={onClose} /></Row>
        <ScrollView ref={scroll} style={{ flexShrink: 1, minHeight: 0 }} onFocus={() => { focusedWithin.current = true; revealFocused(); }} onBlur={() => { focusedWithin.current = false; }} onLayout={revealFocused} onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16} scrollsChildToFocus automaticallyAdjustKeyboardInsets={false} keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: compact ? 12 : 16, paddingTop: compact ? 8 : 24, paddingBottom: compact ? 8 : 16 }}>{children}</ScrollView>
      </SafeAreaView>
    </View>
  </KeyboardAvoidingView>;
}
export function ConfirmationDialog({ visible, title, detail, onClose, onConfirm }: { visible: boolean; title: string; detail: string; onClose: () => void; onConfirm: () => void }) {
  return <Sheet visible={visible} title={title} onClose={onClose}><Label muted>{detail}</Label><AppButton label="Confirm" onPress={onConfirm} /><AppButton label="Cancel" variant="secondary" onPress={onClose} /></Sheet>;
}
export function PracticeLabel() {
  const { colors } = useTheme();
  return <Row style={{ justifyContent: 'flex-start', gap: 8 }}><Icon name="shield-checkmark-outline" color={colors.sub} size={13} /><Label size={10} muted>Simulated market / practice money only</Label></Row>;
}
export function WorkspaceHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return <Row><View style={{ flex: 1, gap: 4 }}>{subtitle && <Label muted size={11}>{subtitle}</Label>}<Label bold size={24}>{title}</Label></View><IconButton name="newspaper-outline" label="Market reading" onPress={() => router.push('/news')} /><IconButton name="person-outline" label="Profile" onPress={() => router.push('/profile')} /></Row>;
}
export function Page({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle: string }) {
  const { colors } = useTheme(); const { width } = useWindowDimensions(); const { storageError } = useWorkspace(); const [notice, setNotice] = useState(false); const insets = useSafeAreaInsets();
  const segments = useSegments();
  const wide = width > navigationLayout.wideBreakpoint;
  const padding = wide ? 32 : 22;
  const bottomPadding = contentBottomPadding({ bottomInset: insets.bottom, wide, tabRoute: segments[0] === '(tabs)', contentGap: padding });
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}><ScreenSystemBars style={colors.bg === colors.darkBg ? 'light' : 'dark'} backgroundColor={colors.bg} /><ScrollView automaticallyAdjustKeyboardInsets={false} keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding, paddingBottom: bottomPadding, gap: 24, maxWidth: 1600, width: '100%', alignSelf: 'center' }}><Row style={{ flexWrap: 'wrap' }}><Brand /><Row><Badge>SIMULATOR</Badge><IconButton name="notifications-outline" label="Notifications" onPress={() => setNotice(true)} /><IconButton name="person-outline" label="Profile" onPress={() => router.push('/profile')} /></Row></Row><WorkspaceHeader title={title} subtitle={subtitle} /><PracticeLabel />{storageError ? <ErrorState message={storageError} /> : null}{children}</ScrollView><Sheet visible={notice} title="Notifications" onClose={() => setNotice(false)}><EmptyState title="You're all caught up" detail="Order confirmations appear in your trading history. No live market alerts are connected." icon="notifications-outline" /></Sheet></SafeAreaView>;
}
