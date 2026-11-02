import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import { BottomSheet } from '../../components/BottomSheet';
import { GhostButton } from '../../components/GhostButton';
import { OrderBottomSheet } from '../../components/OrderBottomSheet';
import { PairChip } from '../../components/PairChip';
import { PrimaryButton } from '../../components/PrimaryButton';
import { TradingChart } from '../../components/TradingChart';
import { ErrorState, GlassCard, Icon, Label, PracticeLabel, Row } from '../../components/design';
import { assets, money, price } from '../../lib/market';
import { Direction, summary } from '../../lib/simulator';
import { fonts, ThemeSurface, useTheme } from '../../lib/theme';
import { useWorkspace } from '../../lib/workspace';

export default function Analyse() { return <ThemeSurface tone="dark"><AnalysisWorkspace /></ThemeSurface>; }
function AnalysisWorkspace() {
  const { t, wallet, storageError } = useWorkspace(); const { colors } = useTheme();
  const [asset, setAsset] = useState(assets[0]); const [direction, setDirection] = useState<Direction | null>(null);
  const stats = summary(wallet); const { width, height } = useWindowDimensions(); const insets = useSafeAreaInsets(); const wide = width > 1050;
  const wins = wallet.history.filter(p => (p.pnl || 0) > 0).length;
  const tabSpace = wide ? 24 : 84 + Math.max(insets.bottom, 14);
  const plotHeight = Math.max(200, Math.min(640, height - insets.top - tabSpace - (wide ? 280 : 408)));
  const movement = asset.change < 0 ? colors.down : colors.up;
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.bg }}>
    <StatusBar style="light" />
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24, maxWidth: 1600, width: '100%', alignSelf: 'center' }}>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 24 : 0 }}>
        <View style={{ flex: wide ? 2.2 : undefined }}>
          <View style={{ paddingHorizontal: 22, paddingTop: 16, paddingBottom: 16, gap: 16 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{assets.map(a => <PairChip key={a.symbol} label={a.symbol} mark={a.mark} selected={asset.symbol === a.symbol} onPress={() => setAsset(a)} />)}</ScrollView>
            <Row style={{ alignItems: 'center', flexWrap: 'wrap' }}><View><Label size={width < 360 ? 34 : 40} bold style={{ fontFamily: fonts.extraBold, letterSpacing: -1.5 }}>{price(asset)}</Label><Label size={11} muted>{asset.name} · fixed demo quote</Label></View><Row style={{ justifyContent: 'flex-end' }}><Icon name={asset.change < 0 ? 'arrow-down' : 'arrow-up'} color={movement} size={16} /><Label bold size={15} color={movement}>{Math.abs(asset.change).toFixed(2)}%</Label></Row></Row>
          </View>
          <View style={{ paddingHorizontal: 22, paddingBottom: 16 }}><TradingChart key={asset.symbol} asset={asset} plotHeight={plotHeight} compactControls /></View>

        </View>
        {wide && <View style={{ flex: 1, paddingTop: 24, paddingRight: 22 }}><MarketContext change={asset.change} /></View>}
      </View>
      <View style={{ padding: 22, paddingTop: 32, gap: 24 }}>
        {!!storageError && <ErrorState message={storageError} />}
        {!wide && <MarketContext change={asset.change} />}
        <View style={{ gap: 8 }}><Label muted size={11}>YOUR PRACTICE REVIEW</Label><Label size={23} bold>{t('Market perspective.')}</Label></View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>{[['Account equity', money(stats.equity)], ['Realized P/L', money(stats.realized)], ['Win rate', wallet.history.length ? `${(wins / wallet.history.length * 100).toFixed(0)}%` : 'No closed trades'], ['Completed trades', String(wallet.history.length)]].map(([label, value]) => <GlassCard key={label} style={{ width: wide ? '23%' : width < 400 ? '100%' : '47%', padding: 16 }}><Label muted size={11}>{label}</Label><Label size={value.length > 14 ? 16 : 22} bold>{value}</Label></GlassCard>)}</View>
        <GlassCard><Label bold size={20}>Equity journal</Label><Label muted size={13}>{wallet.history.length ? 'Closed trade results in chronological order, net of fees. Open position fees are reflected in current equity.' : 'Your curve starts at $10,000. Close your first virtual position to begin your equity journal.'}</Label><EquityCurve values={[10000, ...wallet.history.slice().reverse().map((_, i, history) => 10000 + history.slice(0, i + 1).reduce((s, p) => s + (p.pnl || 0), 0))]} /></GlassCard>
      </View>
    </ScrollView>
          <BottomSheet style={{ paddingBottom: wide ? 24 : tabSpace + 8 }}>
            <View style={{ gap: 8 }}><Row><PrimaryButton label={t('Buy')} icon="arrow-up" tone="light" haptic onPress={() => setDirection('buy')} style={{ flex: 1 }} /><GhostButton label={t('Sell')} icon="arrow-down" tone="light" intent="negative" haptic onPress={() => setDirection('sell')} style={{ flex: 1 }} /></Row><PracticeLabel /></View>
          </BottomSheet>
    <OrderBottomSheet asset={asset} direction={direction} onClose={() => setDirection(null)} />
  </SafeAreaView>;
}
function MarketContext({ change }: { change: number }) {
  return <GlassCard><Label muted size={11}>READING THE MARKET</Label><Label size={22} bold>{change > 0 ? 'An upward sample session' : 'A softer sample session'}</Label><Label muted size={13}>The example session shows a {Math.abs(change)}% {change > 0 ? 'rise' : 'decline'}. This describes the sample, not a forecast or a trading recommendation.</Label><Label bold>Before taking a view</Label><Label muted size={13}>Compare timeframes. Identify what would invalidate your idea. Decide your risk before opening a position.</Label><Label muted size={11}>Live indicators and external market research are not connected. No buy or sell signals are generated.</Label></GlassCard>;
}
function EquityCurve({ values }: { values: number[] }) {
  const { colors } = useTheme(); const min = Math.min(...values) - 1; const max = Math.max(...values) + 1;
  const path = values.map((v, i) => `${i ? 'L' : 'M'}${20 + i / Math.max(1, values.length - 1) * 650},${130 - (v - min) / (max - min) * 110}`).join(' ');
  return <Svg height={170} width="100%" viewBox="0 0 740 170" accessibilityLabel={`Equity journal, ${values.length - 1} closed trades`}><Line x1="20" x2="670" y1="130" y2="130" stroke={colors.border} /><Path d={values.length === 1 ? 'M20,75 L670,75' : path} stroke={values[values.length - 1] >= values[0] ? colors.up : colors.down} strokeWidth="3" fill="none" /><SvgText x="20" y="160" fill={colors.sub} fontSize="12" fontFamily={fonts.medium}>Start · $10,000</SvgText><SvgText x="600" y="160" fill={colors.sub} fontSize="12" fontFamily={fonts.medium}>{values.length - 1} trades</SvgText></Svg>;
}
