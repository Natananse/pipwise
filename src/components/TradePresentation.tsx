import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { Asset, Candle } from '../lib/market';
import { fonts } from '../lib/theme';
import { tradeColors as c, tradeRadii as r, tradeSpace as s, tradeType as t } from '../lib/tradeTheme';
import { useReducedMotion } from '../lib/useReducedMotion';
import { ScreenSystemBars } from './ScreenSystemBars';

export function TradeSurface({ children, style, onTouchStart }: { children: React.ReactNode; style?: ViewStyle; onTouchStart?: () => void }) {
  return <View onTouchStart={onTouchStart} style={[styles.screen, style]}><ScreenSystemBars style="dark" backgroundColor={c.bg} immersive />{children}</View>;
}

export function TradeTopBar({ equity, onInfo, topInset }: { equity: string; onInfo: () => void; topInset: number }) {
  return <View style={[styles.topBar, { paddingTop: topInset + s.xs }]}>
    <View style={{ flex: 1, gap: 2 }}><Text style={styles.caption}>Virtual equity</Text><Text accessibilityLabel={`Virtual equity ${equity}`} style={styles.equity}>{equity}</Text></View>
    <Pressable accessibilityRole="button" accessibilityLabel="About this practice" onPress={onInfo} style={({ pressed }) => [styles.infoButton, { opacity: pressed ? 0.6 : 1 }]}><Ionicons name="information" size={22} color={c.text} /></Pressable>
  </View>;
}

/** Surface only: the route owns selection and its accessible Pressable. */
export function TradeAssetTile({ children, selected }: { children: React.ReactNode; selected: boolean }) {
  return <View style={[styles.assetTile, selected && styles.selectedTile]}>{children}</View>;
}

/** These points are the simulator's recent closes, not decorative invented data. */
export function TradeSparkline({ candles, positive }: { candles: readonly Candle[]; positive: boolean }) {
  const path = useMemo(() => {
    const closes = candles.slice(-18).map(candle => candle.close);
    if (!closes.length) return '';
    const low = Math.min(...closes), high = Math.max(...closes);
    const span = Math.max(high - low, Math.abs(high) * 0.00001, Number.EPSILON);
    return closes.map((value, index) => `${index ? 'L' : 'M'}${2 + index / Math.max(1, closes.length - 1) * 44},${18 - (value - low) / span * 14}`).join(' ');
  }, [candles]);
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden><Svg width={48} height={22} viewBox="0 0 48 22"><Path d={path} stroke={positive ? c.up : c.down} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" /></Svg></View>;
}

export function TradeHeroQuote({ asset, quote, paused, compact = false }: { asset: Asset; quote: string; paused: boolean; compact?: boolean }) {
  const reducedMotion = useReducedMotion();
  const previous = useRef({ symbol: asset.symbol, price: asset.price });
  const [move, setMove] = useState(0);
  const [glow] = useState(() => new Animated.Value(0));
  const [reveal] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const before = previous.current;
    previous.current = { symbol: asset.symbol, price: asset.price };
    const delta = before.symbol === asset.symbol ? Math.sign(asset.price - before.price) : 0;
    setMove(delta);
    if (reducedMotion !== false) { glow.setValue(0); reveal.setValue(1); return; }
    if (!delta && before.symbol === asset.symbol) return;
    reveal.setValue(0);
    glow.setValue(delta ? 0.8 : 0);
    const animation = Animated.parallel([
      Animated.timing(reveal, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
      Animated.timing(glow, { toValue: 0, duration: 260, useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [asset.price, asset.symbol, glow, reducedMotion, reveal]);
  const positive = asset.change >= 0;
  return <View style={styles.hero}>
    <Animated.View pointerEvents="none" style={[styles.glow, { backgroundColor: move < 0 ? c.negativeTint : c.positiveTint, opacity: glow }]} />
    <Animated.Text accessibilityLabel={`Current simulated price ${quote}`} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[styles.heroPrice, compact && { fontSize: 34, lineHeight: 44, letterSpacing: -1 }, { opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [3, 0] }) }] }]}>{quote}</Animated.Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s.xs, flexWrap: 'wrap' }}>
      <Text style={[styles.change, { color: positive ? c.up : c.down }]}>{positive ? '↗ +' : '↘ '}{asset.change.toFixed(2)}%</Text>
      {paused && <Text accessibilityLiveRegion="polite" style={styles.caption}>Paused</Text>}
    </View>
  </View>;
}

export function TradeChartCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.chartCard, style]}>{children}</View>;
}

export function TradeFooter({ children, bottomSpace, leftInset, rightInset }: { children: React.ReactNode; bottomSpace: number; leftInset: number; rightInset: number }) {
  return <View style={[styles.footer, { paddingBottom: bottomSpace + s.xs, left: leftInset, right: rightInset }]}><View style={styles.actions}>{children}</View></View>;
}

export function TradeActionButton({ direction, onPress }: { direction: 'buy' | 'sell'; onPress: () => void }) {
  const reducedMotion = useReducedMotion();
  const buy = direction === 'buy';
  return <Pressable accessibilityRole="button" accessibilityLabel={buy ? 'Buy' : 'Sell'} onPress={onPress} style={({ pressed }) => [styles.action, { backgroundColor: buy ? c.primary : c.sell, opacity: pressed ? 0.75 : 1, transform: [{ scale: pressed && reducedMotion === false ? 0.98 : 1 }] }]}><Text style={styles.actionText}>{buy ? 'Buy' : 'Sell'}</Text></Pressable>;
}

export function TradeSkeleton() {
  return <View accessibilityLabel="Preparing your practice workspace" accessibilityState={{ busy: true }} style={{ padding: s.md, gap: s.md }}>
    <View style={{ flexDirection: 'row', gap: s.xs }}>{[0, 1].map(index => <View key={index} style={{ width: 144, height: 76, borderRadius: r.control, backgroundColor: c.raised }} />)}</View>
    <View style={{ height: 64, width: '75%', borderRadius: r.control, backgroundColor: c.raised }} />
    <View style={{ height: 280, borderRadius: r.card, backgroundColor: c.raised }} />
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: s.sm, paddingHorizontal: s.md, paddingBottom: s.sm, width: '100%', maxWidth: 1160, alignSelf: 'center' },
  caption: { color: c.sub, fontFamily: fonts.medium, fontSize: t.caption, lineHeight: 17 },
  equity: { color: c.text, fontFamily: fonts.bold, fontSize: t.title, fontVariant: ['tabular-nums'] },
  infoButton: { width: 44, height: 44, borderRadius: r.pill, backgroundColor: c.raised, alignItems: 'center', justifyContent: 'center' },
  assetTile: { width: 152, backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, borderRadius: r.control, overflow: 'hidden' },
  selectedTile: { backgroundColor: c.positiveTint, borderColor: c.text, borderWidth: 2 },
  hero: { paddingHorizontal: s.md, paddingVertical: s.xs, gap: 4 },
  heroPrice: { color: c.text, fontFamily: fonts.extraBold, fontSize: t.hero, lineHeight: 68, letterSpacing: -1.8, fontVariant: ['tabular-nums'] },
  glow: { position: 'absolute', left: s.sm, right: s.md, top: 0, height: 80, borderRadius: r.pill },
  change: { fontFamily: fonts.semibold, fontSize: t.body, lineHeight: 22 },
  chartCard: { marginHorizontal: s.sm, padding: s.sm, borderWidth: 1, borderColor: c.border, borderRadius: r.card, backgroundColor: c.surface },
  footer: { position: 'absolute', bottom: 0, paddingHorizontal: s.md, paddingTop: s.xs, backgroundColor: c.bg },
  actions: { flexDirection: 'row', gap: s.xs, width: '100%', maxWidth: 1120, alignSelf: 'center' },
  action: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', borderRadius: r.control, paddingHorizontal: s.sm, paddingVertical: s.xs },
  actionText: { fontFamily: fonts.bold, color: c.text, fontSize: 18 },
});
