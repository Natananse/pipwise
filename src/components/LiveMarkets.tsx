import { router, useIsFocused } from 'expo-router';
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Asset, assets } from '../lib/market';
import { navigationLayout, tabBarClearance } from '../lib/navigation';
import { fitChartHeight, responsiveLayout } from '../lib/responsiveLayout';
import { getProviderChart } from '../lib/providerCharts';
import { useWorkspace } from '../lib/workspace';
import { MarketBadge } from './MarketBadge';
import { ProviderChart } from './ProviderChart';
import { Icon, Label, Row, ScreenSystemBars } from './design';

const c = { bg: '#0C100F', card: '#151B18', border: '#29332D', text: '#F4F6EF', muted: '#A0AAA2', mint: '#6EE7BE' };
const subscribeToHydration = () => () => {};
const clientHydrated = () => true;
const serverHydrated = () => false;

/** Public provider displays. No sample quote, order execution or widget-data extraction. */
export function LiveMarkets({ embedded = false, initialSymbol = 'EUR/USD', onPractice }: {
  embedded?: boolean; initialSymbol?: string; onPractice?: (symbol: string) => void;
}) {
  const { favorites, toggle, storageError } = useWorkspace();
  const [symbol, setSymbol] = useState(() => assets.some(asset => asset.symbol === initialSymbol) ? initialSymbol : 'EUR/USD');
  const [filter, setFilter] = useState<'all' | 'watchlist'>('all');
  const [foreground, setForeground] = useState(() => AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const focused = useIsFocused();
  const hydrated = useSyncExternalStore(subscribeToHydration, clientHydrated, serverHydrated);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = responsiveLayout({ width, height, insets });
  const wide = width > navigationLayout.wideBreakpoint;
  const watchlist = assets.filter(asset => favorites.includes(asset.symbol));
  const visible = filter === 'all' ? assets : watchlist;
  const asset = assets.find(item => item.symbol === symbol)!;
  const source = getProviderChart(symbol);
  const chartHeight = layout.compactHeight ? fitChartHeight(Math.max(140, layout.usableHeight - 120), 360, 180) : hydrated ? wide ? 520 : Math.max(400, Math.min(520, height * 0.61)) : 420;
  const openPractice = () => onPractice ? onPractice(symbol) : router.push({ pathname: '/(tabs)/practice', params: { mode: 'sample', symbol } });

  useEffect(() => {
    const listener = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => listener.remove();
  }, []);

  return <View style={[s.screen, { paddingLeft: insets.left, paddingRight: insets.right }]}>
    <ScreenSystemBars style="light" backgroundColor={c.bg} />
    <View style={{ paddingTop: insets.top + (layout.compactHeight ? 6 : 12), paddingHorizontal: 18, paddingBottom: layout.compactHeight ? 6 : 12 }}>
      <Row style={s.header}>
        {!embedded && <IconButton label="Back to Trade" name="arrow-back" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/practice')} />}
        <View style={{ flex: 1, gap: 2 }}><Label bold size={20} color={c.text}>{embedded ? 'pipwise' : 'Market charts'}</Label><Label size={10} color={c.muted}>{embedded ? 'YOUR MARKET WORKSPACE' : 'Provider market data'}</Label></View>
        <IconButton label="View virtual portfolio" name="wallet-outline" onPress={() => router.push('/portfolio')} />
        <IconButton label="Your profile" name="person-outline" onPress={() => router.push('/profile')} />
      </Row>
    </View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ width: '100%', maxWidth: 1140, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 4, paddingBottom: embedded && !wide ? tabBarClearance(insets.bottom) + 24 : insets.bottom + 28, gap: 18 }}>
      <View style={{ gap: 10 }}>
        <Label bold size={27} color={c.text}>Follow the market.</Label>
        <Label size={13} color={c.muted}>Provider charts for forex, Bitcoin, gold, oil and the S&amp;P 500.</Label>
        <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
          <Pill label="Market charts" selected onPress={() => {}} />
          <Pill label="Practice · simulated" onPress={openPractice} />
        </Row>
      </View>

      {!!storageError && <View accessibilityRole="alert" style={s.card}><Label size={12} color="#FF9DA5">{storageError}</Label></View>}

      <View style={{ gap: 10 }}>
        <Row style={{ gap: 10, flexWrap: 'wrap' }}><Label bold size={14} color={c.text}>Your markets</Label><Row style={{ gap: 8 }}><Pill label="All 7" selected={filter === 'all'} onPress={() => setFilter('all')} /><Pill label={`Watchlist (${watchlist.length})`} selected={filter === 'watchlist'} onPress={() => setFilter('watchlist')} /></Row></Row>
        {!visible.length ? <View style={s.card}><Icon name="star-outline" color={c.mint} /><Label bold color={c.text}>Build your watchlist</Label><Label size={12} color={c.muted}>Open All 7 and save markets with their stars.</Label><Pill label="Add markets" onPress={() => setFilter('all')} /></View>
          : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>{visible.map(item => <MarketChoice key={item.symbol} asset={item} selected={symbol === item.symbol} saved={favorites.includes(item.symbol)} onPress={() => setSymbol(item.symbol)} onStar={() => toggle('favorites', item.symbol)} />)}</ScrollView>}
      </View>

      <View style={s.card}>
        <Row style={{ gap: 10 }}><Row style={{ gap: 10, justifyContent: 'flex-start', flex: 1 }}><MarketBadge asset={asset} size={36} paired /><View style={{ flex: 1, gap: 3 }}><Label bold size={19} color={c.text}>{symbol}</Label><Label size={11} color={c.muted}>{source?.title ?? asset.name}</Label></View></Row><IconButton label={`${favorites.includes(symbol) ? 'Remove' : 'Add'} ${symbol} ${favorites.includes(symbol) ? 'from' : 'to'} watchlist`} name={favorites.includes(symbol) ? 'star' : 'star-outline'} selected={favorites.includes(symbol)} onPress={() => toggle('favorites', symbol)} /></Row>
        <Row style={{ gap: 6, justifyContent: 'flex-start' }}><Icon name="globe-outline" size={14} color={c.mint} /><Label bold size={10} color={c.mint}>TRADINGVIEW · PROVIDER CHART</Label></Row>
        <Label size={12} color={c.muted}>{source?.note}</Label>
      </View>

      <View style={{ backgroundColor: c.card, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>
        {hydrated && focused && foreground ? <ProviderChart key={symbol} symbol={symbol} height={chartHeight} /> : <View style={{ height: chartHeight, padding: 24, gap: 10, alignItems: 'center', justifyContent: 'center' }}><Icon name={hydrated ? 'pause-circle-outline' : 'globe-outline'} size={30} color={c.muted} /><Label bold color={c.text}>{hydrated ? 'Chart paused' : 'Preparing provider chart…'}</Label><Label size={12} color={c.muted}>{hydrated ? 'Return to this screen to load the provider chart.' : 'The chart loads after this screen is ready.'}</Label></View>}
      </View>

      <View style={{ gap: 8 }}>
        <Label size={11} color={c.muted}>Prices and candles appear inside the provider chart. Availability, delay and connection messages come from TradingView. If the provider cannot load, this screen shows an error without substituting generated candles.</Label>
      </View>

      <View style={s.card}>
        <Row style={{ justifyContent: 'flex-start', gap: 10 }}><Icon name="analytics-outline" color={c.mint} /><Label bold size={16} color={c.text}>Build your analysis</Label></Row>
        <Label size={12} color={c.muted}>Use the provider chart’s timeframe, drawing and indicator controls. Custom candle analysis and news tools remain available in Market desk; their data feed still needs to be connected.</Label>
        <Pill label="Open custom analysis tools" icon="arrow-forward" onPress={() => router.push('/market-tools')} />
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="Open practice with simulated prices and virtual funds" onPress={openPractice} style={({ pressed }) => [s.card, { flexDirection: 'row', alignItems: 'center', opacity: pressed ? 0.65 : 1 }]}><Icon name="school-outline" color={c.mint} size={26} /><View style={{ flex: 1, gap: 5 }}><Label bold size={15} color={c.text}>Put an idea into practice</Label><Label size={12} color={c.muted}>A separate simulator with sample prices and virtual funds.</Label></View><Icon name="arrow-forward" color={c.mint} size={20} /></Pressable>
    </ScrollView>
  </View>;
}

function MarketChoice({ asset, selected, saved, onPress, onStar }: { asset: Asset; selected: boolean; saved: boolean; onPress: () => void; onStar: () => void }) {
  return <View style={[s.market, { backgroundColor: selected ? '#1C3026' : c.card, borderColor: selected ? '#538B70' : c.border }]}>
    <Row><MarketBadge asset={asset} size={28} /><IconButton label={`${saved ? 'Remove' : 'Add'} ${asset.symbol} ${saved ? 'from' : 'to'} watchlist`} name={saved ? 'star' : 'star-outline'} selected={saved} onPress={onStar} /></Row>
    <Pressable accessibilityRole="button" accessibilityLabel={`Show ${asset.symbol} provider chart`} accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => ({ minHeight: 58, gap: 5, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}><Label bold size={14} color={c.text}>{asset.symbol}</Label><Label size={10} color={c.muted}>{asset.category}</Label></Pressable>
  </View>;
}
function IconButton({ label, name, selected = false, onPress }: { label: string; name: React.ComponentProps<typeof Icon>['name']; selected?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [s.icon, { opacity: pressed ? 0.6 : 1 }]}><Icon name={name} size={20} color={selected ? c.mint : c.text} /></Pressable>;
}
function Pill({ label, selected = false, onPress, icon }: { label: string; selected?: boolean; onPress: () => void; icon?: React.ComponentProps<typeof Icon>['name'] }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [s.pill, { backgroundColor: selected ? '#21382D' : c.card, borderColor: selected ? '#538B70' : c.border, opacity: pressed ? 0.65 : 1 }]}><Label bold size={12} color={selected ? c.mint : c.text}>{label}</Label>{icon && <Icon name={icon} size={16} color={c.mint} />}</Pressable>;
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg }, header: { maxWidth: 1140, width: '100%', alignSelf: 'center', gap: 10 },
  card: { padding: 17, borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, gap: 12 },
  market: { width: 148, padding: 12, borderRadius: 20, borderWidth: 1, gap: 4 },
  icon: { width: 44, minHeight: 44, borderRadius: 14, backgroundColor: '#202923', justifyContent: 'center', alignItems: 'center' },
  pill: { minHeight: 44, paddingHorizontal: 13, borderRadius: 14, borderWidth: 1, alignSelf: 'flex-start', flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
});
