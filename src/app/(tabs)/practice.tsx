import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MarketBadge } from '../../components/MarketBadge';
import { OrderBottomSheet } from '../../components/OrderBottomSheet';
import { TradingChart } from '../../components/TradingChart';
import { AppInput, ErrorState, Icon, Label, LoadingState, Row, Sheet } from '../../components/design';
import { lightHaptic } from '../../lib/haptics';
import { Asset, assets, money } from '../../lib/market';
import { marketVisual } from '../../lib/marketVisuals';
import { navigationLayout, tabBarClearance } from '../../lib/navigation';
import { Direction, summary } from '../../lib/simulator';
import { fonts, ThemeSurface } from '../../lib/theme';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { useWorkspace } from '../../lib/workspace';

const displayOrder = ['EUR/USD', 'BTC/USD', 'USD/JPY', 'WTI/USD', 'GBP/USD', 'XAU/USD', 'SPX/USD'];
const markets = displayOrder.map(symbol => assets.find(asset => asset.symbol === symbol)!);
const terminal = { bg: '#0C100F', surface: '#151B18', line: '#29332D', text: '#F4F6EF', muted: '#A0AAA2', mint: '#6EE7BE', coral: '#FF9DA5' };

export default function Trade() {
  return <ThemeSurface tone="dark"><TradeWorkspace /></ThemeSurface>;
}

function TradeWorkspace() {
  const { loaded, wallet, storageError } = useWorkspace();
  const [asset, setAsset] = useState(markets[0]);
  const [direction, setDirection] = useState<Direction | null>(null);
  const [marketInfo, setMarketInfo] = useState(false);
  const [search, setSearch] = useState('');
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const marketRail = useRef<React.ElementRef<typeof ScrollView>>(null);
  const [reveal] = useState(() => new Animated.Value(1));
  const visual = marketVisual(asset);
  const wide = width > navigationLayout.wideBreakpoint;
  const columns = width > 820;
  const bottomSpace = wide ? insets.bottom + 12 : tabBarClearance(insets.bottom) + 8;
  const cardWidth = width < 360 ? 106 : 114;
  const currency = asset.symbol === 'USD/JPY' ? 'JPY' : 'USD';
  const quote = `${currency === 'JPY' ? '¥' : '$'}${asset.price.toLocaleString('en-US', { minimumFractionDigits: asset.precision, maximumFractionDigits: asset.precision })}`;
  const selectMarket = (next: Asset) => {
    if (next.symbol !== asset.symbol) { lightHaptic(); setAsset(next); }
    const index = markets.findIndex(item => item.symbol === next.symbol);
    marketRail.current?.scrollTo({ x: Math.max(0, index * (cardWidth + 10) - cardWidth), animated: reducedMotion === false });
  };

  useEffect(() => {
    if (reducedMotion !== false) { reveal.setValue(1); return; }
    reveal.setValue(0);
    const animation = Animated.timing(reveal, { toValue: 1, duration: 240, useNativeDriver: Platform.OS !== 'web', isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [asset.symbol, reducedMotion, reveal]);

  return <View style={[styles.screen, { paddingLeft: insets.left, paddingRight: insets.right }]}>
    <StatusBar style="light" />
    <View style={{ paddingTop: insets.top + 12, paddingBottom: 12, paddingHorizontal: 20 }}>
      <Row style={styles.header}>
        <View style={{ flex: 1, gap: 1 }}><Row style={{ justifyContent: 'flex-start', gap: 4 }}><Label bold size={18} color={terminal.text}>pipwise</Label><View style={styles.brandDot} /></Row><Label size={width < 360 ? 8 : 9} color={terminal.muted} style={{ letterSpacing: width < 360 ? 0.4 : 1.2 }}>THE TRADING ROOM</Label></View>
        <Pressable accessibilityRole="button" accessibilityLabel="View virtual portfolio" onPress={() => router.push('/portfolio')} style={({ pressed }) => [styles.wallet, { opacity: pressed ? 0.65 : 1 }]}>
          <Icon name="wallet-outline" color={terminal.mint} size={17} /><View><Label size={8} color={terminal.muted}>VIRTUAL EQUITY</Label><Label bold size={12} color={terminal.text}>{money(summary(wallet).equity)}</Label></View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Explore Pro" onPress={() => router.push('/paywall')} style={({ pressed }) => [styles.pro, { opacity: pressed ? 0.65 : 1 }]}><Icon name="sparkles" color="#E8F479" size={19} /></Pressable>
      </Row>
    </View>

    {!loaded ? <LoadingState /> : <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ width: '100%', maxWidth: 1160, alignSelf: 'center', paddingTop: 4, paddingBottom: bottomSpace + 116, gap: 16 }}>
      {storageError ? <View style={{ paddingHorizontal: 20 }}><ErrorState message={storageError} /></View> : null}
      <Row style={{ paddingHorizontal: 20, alignItems: 'center' }}>
        <View style={{ flex: 1 }}><Text style={[styles.title, { fontSize: width < 360 ? 19 : 22 }]}>Your market. Your move.</Text><Label size={10} color={terminal.muted}>A real feel. With virtual funds.</Label></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Find a practice market" onPress={() => setMarketInfo(true)} style={({ pressed }) => [styles.search, { opacity: pressed ? 0.65 : 1 }]}><Icon name="search-outline" size={21} color={terminal.text} /></Pressable>
      </Row>

      <ScrollView ref={marketRail} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
        {markets.map(item => {
          const identity = marketVisual(item);
          const selected = item.symbol === asset.symbol;
          const foreground = selected ? identity.ink : terminal.text;
          return <Pressable key={item.symbol} accessibilityRole="tab" accessibilityLabel={`${item.symbol}, ${identity.label}`} accessibilityState={{ selected }} aria-selected={selected} onPress={() => selectMarket(item)} style={({ pressed }) => [styles.marketCard, { width: cardWidth, backgroundColor: selected ? identity.color : identity.tint, borderColor: selected ? identity.color : '#FFFFFF0D', transform: [{ scale: pressed && reducedMotion === false ? 0.97 : 1 }], opacity: pressed ? 0.8 : 1 }]}>
            <Row><MarketBadge asset={item} size={30} paired /><Icon name={selected ? 'checkmark-circle' : 'arrow-forward'} size={17} color={selected ? identity.ink : identity.color} /></Row>
            <View style={{ gap: 1 }}><Label bold size={12} color={foreground}>{item.symbol}</Label><Label size={9} color={selected ? '#343A34' : '#BEC5BF'}>{identity.label}</Label></View>
          </Pressable>;
        })}
      </ScrollView>

      <View style={{ paddingHorizontal: 16, flexDirection: columns ? 'row' : 'column', alignItems: 'stretch', gap: 14 }}>
        <Animated.View style={[styles.quoteCard, { flex: columns ? 0.38 : undefined, opacity: reveal, transform: [{ translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }]}>
          <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={styles.watermark}><Text allowFontScaling={false} style={{ fontSize: 126, lineHeight: 150, fontFamily: fonts.extraBold, color: visual.color, opacity: 0.09 }}>{visual.mark}</Text></View>
          <Row><Row style={{ justifyContent: 'flex-start', gap: 9 }}><MarketBadge asset={asset} size={34} paired /><View><Label bold size={13} color={terminal.text}>{visual.label}</Label><Label size={9} color={terminal.muted}>{asset.symbol} · {asset.category}</Label></View></Row><View style={[styles.change, { backgroundColor: asset.change >= 0 ? '#1B342A' : '#39252B' }]}><Icon name={asset.change >= 0 ? 'trending-up' : 'trending-down'} size={13} color={asset.change >= 0 ? terminal.mint : terminal.coral} /><Label bold size={10} color={asset.change >= 0 ? terminal.mint : terminal.coral}>{asset.change >= 0 ? '+' : ''}{asset.change.toFixed(2)}%</Label></View></Row>
          <View style={{ gap: 2, marginTop: columns ? 28 : 10 }}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.price, { fontSize: width < 360 ? 34 : columns ? 40 : 39 }]}>{quote}</Text><Row style={{ justifyContent: 'flex-start', gap: 6 }}><View style={[styles.statusDot, { backgroundColor: visual.color }]} /><Label size={9} color={terminal.muted}>Fixed demo quote · {currency}</Label></Row></View>
          {columns && <View style={{ marginTop: 'auto', paddingTop: 40, gap: 10 }}><View style={{ height: 1, backgroundColor: terminal.line }} /><Label size={12} color={terminal.muted}>One market. A thousand ways to learn.</Label><Label size={10} color={terminal.muted}>Explore the chart, switch timeframes and practice your next idea with virtual funds.</Label></View>}
        </Animated.View>

        <View style={[styles.chartCard, { flex: columns ? 0.62 : undefined }]}>
          <TradingChart key={asset.symbol} asset={asset} referenceUI terminal accentColor={visual.color} plotHeight={columns ? 350 : Math.max(210, Math.min(300, height - 610))} />
          <Row style={styles.chartCaption}><Row style={{ justifyContent: 'flex-start', gap: 5 }}><Icon name="shield-checkmark-outline" size={12} color={terminal.mint} /><Label size={8} color={terminal.muted}>SIMULATED MARKET</Label></Row><Label size={8} color={terminal.muted}>Touch chart to inspect</Label></Row>
        </View>
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="About the practice markets" onPress={() => setMarketInfo(true)} style={({ pressed }) => [styles.practiceNote, { opacity: pressed ? 0.65 : 1 }]}><View style={styles.noteIcon}><Icon name="flash-outline" color={terminal.mint} size={19} /></View><View style={{ flex: 1 }}><Label bold size={11} color={terminal.text}>Build your edge, one practice at a time.</Label><Label size={9} color={terminal.muted}>7 markets · Virtual funds · No real-money orders</Label></View><Icon name="arrow-forward" color={terminal.muted} size={17} /></Pressable>
    </ScrollView>}

    {loaded && <View style={[styles.footer, { paddingBottom: bottomSpace + 10, left: insets.left, right: insets.right }]}><Row style={{ width: '100%', maxWidth: 1120, alignSelf: 'center', gap: 12 }}><TradeAction direction="sell" onPress={() => { lightHaptic(); setDirection('sell'); }} /><TradeAction direction="buy" onPress={() => { lightHaptic(); setDirection('buy'); }} /></Row></View>}

    <Sheet visible={marketInfo} title="Find your market" onClose={() => setMarketInfo(false)}>
      <Label muted size={12}>Seven markets. Your own practice space. Prices and charts are simulated examples.</Label>
      <AppInput label="Find a market" value={search} onChangeText={setSearch} placeholder="Try Bitcoin, gold or EUR/USD" />
      {markets.filter(item => `${item.symbol} ${item.name}`.toLowerCase().includes(search.toLowerCase())).map(item => <Pressable key={item.symbol} accessibilityRole="button" accessibilityLabel={`Select ${item.symbol}`} onPress={() => { selectMarket(item); setMarketInfo(false); }} style={({ pressed }) => ({ minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 1, borderColor: '#E1E6DE', opacity: pressed ? 0.65 : 1 })}><MarketBadge asset={item} size={36} paired /><View style={{ flex: 1 }}><Label bold color="#202622">{item.symbol}</Label><Label muted size={11}>{marketVisual(item).label}</Label></View><Icon name={item.symbol === asset.symbol ? 'checkmark-circle' : 'arrow-forward'} color="#202622" /></Pressable>)}
      {!markets.some(item => `${item.symbol} ${item.name}`.toLowerCase().includes(search.toLowerCase())) && <Label muted>No matching markets. Try a symbol or market name.</Label>}
      <Label muted size={10}>Virtual funds only. Practice orders reserve full collateral with no leverage. Live market data and brokerage execution are not connected.</Label>
    </Sheet>
    <OrderBottomSheet key={`${asset.symbol}-${direction}`} asset={asset} direction={direction} onClose={() => setDirection(null)} />
  </View>;
}

function TradeAction({ direction, onPress }: { direction: Direction; onPress: () => void }) {
  const buy = direction === 'buy';
  const color = buy ? '#12241B' : terminal.coral;
  return <Pressable accessibilityRole="button" accessibilityLabel={buy ? 'Buy' : 'Sell'} onPress={onPress} style={({ pressed }) => [styles.tradeAction, { backgroundColor: buy ? terminal.mint : '#302027', borderColor: buy ? terminal.mint : '#69404B', opacity: pressed ? 0.7 : 1 }]}><Icon name={buy ? 'arrow-up' : 'arrow-down'} size={20} color={color} /><Label bold size={17} color={color}>{buy ? 'Buy' : 'Sell'}</Label><Icon name="arrow-forward" size={17} color={color} /></Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: terminal.bg },
  header: { width: '100%', maxWidth: 1120, alignSelf: 'center', gap: 10 },
  brandDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: terminal.mint, marginTop: 9 },
  wallet: { minHeight: 44, paddingHorizontal: 11, borderRadius: 16, borderWidth: 1, borderColor: terminal.line, backgroundColor: terminal.surface, flexDirection: 'row', alignItems: 'center', gap: 8 },
  pro: { width: 44, height: 44, borderRadius: 16, borderWidth: 1, borderColor: '#3B422A', backgroundColor: '#23291D', alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.extraBold, fontSize: 22, lineHeight: 30, color: terminal.text, letterSpacing: -0.8 },
  search: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: terminal.surface, borderWidth: 1, borderColor: terminal.line },
  marketCard: { minHeight: 104, borderRadius: 22, borderWidth: 1, padding: 13, justifyContent: 'space-between', gap: 12 },
  quoteCard: { padding: 17, backgroundColor: terminal.surface, borderRadius: 25, borderWidth: 1, borderColor: terminal.line, overflow: 'hidden' },
  watermark: { position: 'absolute', right: 0, top: 4, transform: [{ rotate: '-14deg' }] },
  change: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingVertical: 5, paddingHorizontal: 7 },
  price: { color: terminal.text, fontFamily: fonts.extraBold, lineHeight: 51, letterSpacing: -1.7, fontVariant: ['tabular-nums'] },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  chartCard: { padding: 12, gap: 7, backgroundColor: terminal.surface, borderRadius: 25, borderWidth: 1, borderColor: terminal.line },
  chartCaption: { paddingTop: 7, borderTopWidth: 1, borderColor: terminal.line, gap: 6, flexWrap: 'wrap' },
  practiceNote: { marginHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  noteIcon: { width: 36, height: 36, borderRadius: 13, backgroundColor: '#1A2D24', alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', bottom: 0, backgroundColor: terminal.bg, paddingHorizontal: 18, paddingVertical: 10, borderTopWidth: 1, borderColor: terminal.line },
  tradeAction: { flex: 1, minHeight: 57, borderRadius: 20, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
});
