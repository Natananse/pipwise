import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MarketBadge } from '../../components/MarketBadge';
import { LiveMarkets } from '../../components/LiveMarkets';
import { OrderBottomSheet } from '../../components/OrderBottomSheet';
import { TradingChart } from '../../components/TradingChart';
import {
  AppButton, AppInput, ErrorState, Icon, Label, Row, Sheet,
  TradeSurface, TradeTopBar, TradeAssetTile, TradeSparkline, TradeHeroQuote,
  TradeChartCard, TradeFooter, TradeActionButton, TradeSkeleton,
} from '../../components/design';
import { lightHaptic } from '../../lib/haptics';
import { useDemoMarket } from '../../lib/demoMarketProvider';
import { Asset, assets, money } from '../../lib/market';
import { marketVisual } from '../../lib/marketVisuals';
import { marketTimeframes, MarketTimeframe } from '../../lib/marketTypes';
import { navigationLayout, tabBarClearance } from '../../lib/navigation';
import { Direction, summary } from '../../lib/simulator';
import { ThemeSurface } from '../../lib/theme';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { useWorkspace } from '../../lib/workspace';

const displayOrder = ['EUR/USD', 'BTC/USD', 'USD/JPY', 'WTI/USD', 'GBP/USD', 'XAU/USD', 'SPX/USD'];
const markets = displayOrder.map(symbol => assets.find(asset => asset.symbol === symbol)!);

export default function Trade() {
  const { mode, symbol } = useLocalSearchParams<{ mode?: string; symbol?: string }>();
  return <ThemeSurface tone={mode === 'markets' ? 'dark' : 'light'}>{mode === 'markets'
    ? <LiveMarkets embedded initialSymbol={symbol} onPractice={selected => router.setParams({ mode: 'sample', symbol: selected })} />
    : <TradeWorkspace key={symbol ?? 'default'} initialSymbol={symbol} />}</ThemeSurface>;
}

function TradeWorkspace({ initialSymbol }: { initialSymbol?: string }) {
  const { loaded, wallet, storageError, favorites, toggle } = useWorkspace();
  const { market, quotes, paused, setPaused, ready, storageError: demoStorageError } = useDemoMarket({ active: true });
  const [selectedSymbol, setSelectedSymbol] = useState(() => markets.find(item => item.symbol === initialSymbol)?.symbol ?? markets[0].symbol);
  const [timeframe, setTimeframe] = useState<MarketTimeframe>('1m');
  const [marketList, setMarketList] = useState<'all' | 'watchlist'>('all');
  const [direction, setDirection] = useState<Direction | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [marketInfo, setMarketInfo] = useState(false);
  const [search, setSearch] = useState('');
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const marketRail = useRef<React.ElementRef<typeof ScrollView>>(null);
  const asset = market.getAsset(selectedSymbol);
  const series = market.getSeries(selectedSymbol, timeframe);
  const levels = market.getLevels(selectedSymbol, timeframe);
  const wide = width > navigationLayout.wideBreakpoint;
  const bottomSpace = wide ? insets.bottom + 12 : tabBarClearance(insets.bottom) + 8;
  const watchlist = markets.filter(item => favorites.includes(item.symbol));
  const visibleMarkets = marketList === 'watchlist' ? watchlist : markets;
  const formatQuote = (item: Asset) => `${item.symbol === 'USD/JPY' ? '¥' : '$'}${item.price.toLocaleString('en-US', { minimumFractionDigits: item.precision, maximumFractionDigits: item.precision })}`;
  const selectMarket = (next: Asset, rail = visibleMarkets) => {
    if (next.symbol !== asset.symbol) { lightHaptic(); setSelectedSymbol(next.symbol); }
    const index = rail.findIndex(item => item.symbol === next.symbol);
    marketRail.current?.scrollTo({ x: Math.max(0, index * 160 - 152), animated: reducedMotion === false });
  };
  const changeMarketList = (next: 'all' | 'watchlist') => {
    setMarketList(next);
    if (next === 'watchlist' && !favorites.includes(asset.symbol) && watchlist[0]) selectMarket(watchlist[0], watchlist);
    else marketRail.current?.scrollTo({ x: 0, animated: reducedMotion === false });
  };
  const openSelector = () => { setDetailsOpen(false); setMarketInfo(true); };

  return <TradeSurface style={{ paddingLeft: insets.left, paddingRight: insets.right }}>
    <TradeTopBar topInset={insets.top} equity={loaded && ready ? money(summary(wallet, quotes).equity) : '—'} onInfo={() => setDetailsOpen(true)} />
    {!loaded || !ready ? <TradeSkeleton /> : <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ width: '100%', maxWidth: 1160, alignSelf: 'center', paddingTop: 8, paddingBottom: bottomSpace + 96, gap: 16 }}>
      {storageError ? <View style={{ paddingHorizontal: 24 }}><ErrorState message={storageError} /></View> : null}
      {demoStorageError ? <View style={{ paddingHorizontal: 24 }}><ErrorState message={demoStorageError} /></View> : null}
      {visibleMarkets.length ? <ScrollView ref={marketRail} horizontal snapToInterval={160} decelerationRate="fast" showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}>
        {visibleMarkets.map(item => {
          const current = market.getAsset(item.symbol);
          const selected = current.symbol === asset.symbol;
          return <TradeAssetTile key={item.symbol} selected={selected}>
            <Pressable accessibilityRole="tab" accessibilityLabel={`${item.symbol}, ${marketVisual(item).label}`} accessibilityState={{ selected }} aria-selected={selected} onPress={() => selectMarket(item)} style={({ pressed }) => ({ padding: 16, minHeight: 80, justifyContent: 'center', gap: 4, opacity: pressed ? 0.65 : 1 })}>
              <Label bold={selected} size={14}>{item.symbol}</Label>
              <Row style={{ gap: 4 }}><Label size={11} style={{ flex: 1 }}>{formatQuote(current)}</Label><TradeSparkline candles={market.getSeries(item.symbol, '1m').candles} positive={current.change >= 0} /></Row>
            </Pressable>
          </TradeAssetTile>;
        })}
      </ScrollView> : <View style={{ paddingHorizontal: 24, gap: 8 }}><Label bold>Your watchlist is empty</Label><Label muted size={12}>Save a market in Markets and watchlist.</Label><AppButton label="Browse all markets" variant="secondary" onPress={() => changeMarketList('all')} /></View>}
      <TradeHeroQuote asset={asset} quote={formatQuote(asset)} paused={paused} />
      <TradeChartCard>
        <TradingChart key={`${asset.symbol}-${timeframe}`} asset={asset} presentation="trade" referenceUI plotHeight={wide ? 380 : Math.max(230, Math.min(320, height - 540))} external={{ candles: series.candles, timeframe, loading: false, error: '', sample: true, moving: true, onRetry: () => {}, onTimeframeChange: next => { if (marketTimeframes.includes(next as MarketTimeframe)) setTimeframe(next as MarketTimeframe); } }} keyLevels={levels} />
      </TradeChartCard>
      <View style={{ paddingHorizontal: 24 }}><Label muted size={11}>Practice money · Simulated prices</Label></View>
    </ScrollView>}
    {loaded && ready && <TradeFooter bottomSpace={bottomSpace} leftInset={insets.left} rightInset={insets.right}>
      <TradeActionButton direction="sell" onPress={() => { lightHaptic(); setDirection('sell'); }} />
      <TradeActionButton direction="buy" onPress={() => { lightHaptic(); setDirection('buy'); }} />
    </TradeFooter>}
    <Sheet visible={detailsOpen} title="Practice details" onClose={() => setDetailsOpen(false)}>
      <Label bold size={18}>Moving simulated prices</Label>
      <Label muted size={13}>SIMULATED · No live market feed. Seven simulated markets update once a second. Quotes, candles and virtual orders use the same price source. The demo pauses in the background and when you leave demo screens.</Label>
      <AppButton label="Markets and watchlist" icon="search-outline" variant="secondary" onPress={openSelector} />
      <Pressable accessibilityRole="button" accessibilityLabel={paused ? 'Resume simulated market' : 'Pause simulated market'} onPress={() => { lightHaptic(); setPaused(!paused); }} style={({ pressed }) => ({ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.65 : 1 })}><Icon name={paused ? 'play' : 'pause'} /><Label bold>{paused ? 'Resume simulated market' : 'Pause simulated market'}</Label></Pressable>
      <Label bold>Reading this chart</Label>
      <Label muted size={13}>Pinch to zoom, drag sideways to pan, double-tap to zoom in, or hold and drag to inspect a candle. Chart tools provide zoom, pan, reset and moving-average controls. The percentage change compares this market with its demo starting price; it is not your return.</Label>
      <Label muted size={13}>The 7-period moving average smooths closing prices. Support and resistance use the previous 20 completed bars; the pivot uses the previous bar. These references exclude the forming candle and are not forecasts. Candle timestamps are UTC opening times; daily bars use a UTC date anchor.</Label>
      <Label bold>Virtual orders</Label>
      <Label muted size={13}>Orders reserve full collateral at 1:1, with no leverage or spread. Entry and closing each incur a 0.02% simulated fee. Stop-loss and take-profit levels are saved practice targets, not automatic exits. Close positions manually in Portfolio. Prices can move during order review.</Label>
      <AppButton label="Portfolio and trade history" icon="wallet-outline" variant="secondary" onPress={() => { setDetailsOpen(false); router.push('/portfolio'); }} />
      <AppButton label="Full trading disclaimer" icon="information-circle-outline" variant="secondary" onPress={() => { setDetailsOpen(false); router.push('/disclaimer'); }} />
    </Sheet>
    <Sheet visible={marketInfo} title="Markets and watchlist" onClose={() => setMarketInfo(false)}>
      <AppInput label="Find a market" value={search} onChangeText={setSearch} placeholder="Try Bitcoin, gold or EUR/USD" />
      <Row style={{ gap: 8 }}>{(['all', 'watchlist'] as const).map(value => <AppButton key={value} compact label={value === 'all' ? 'All markets' : `Watchlist (${watchlist.length})`} variant={marketList === value ? 'primary' : 'secondary'} onPress={() => changeMarketList(value)} />)}</Row>
      {markets.filter(item => (marketList !== 'watchlist' || favorites.includes(item.symbol)) && `${item.symbol} ${item.name}`.toLowerCase().includes(search.toLowerCase())).map(item => <View key={item.symbol} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Select ${item.symbol}`} onPress={() => { selectMarket(item); setMarketInfo(false); }} style={({ pressed }) => ({ flex: 1, minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 16, opacity: pressed ? 0.65 : 1 })}><MarketBadge asset={item} size={32} paired /><View style={{ flex: 1 }}><Label bold>{item.symbol}</Label><Label muted size={12}>{marketVisual(item).label}</Label></View></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`${favorites.includes(item.symbol) ? 'Remove' : 'Add'} ${item.symbol} ${favorites.includes(item.symbol) ? 'from' : 'to'} watchlist`} accessibilityState={{ selected: favorites.includes(item.symbol) }} onPress={() => toggle('favorites', item.symbol)} style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.65 : 1 })}><Icon name={favorites.includes(item.symbol) ? 'star' : 'star-outline'} /></Pressable>
      </View>)}
      {!markets.some(item => (marketList !== 'watchlist' || favorites.includes(item.symbol)) && `${item.symbol} ${item.name}`.toLowerCase().includes(search.toLowerCase())) && <Label muted>No matching markets. Try another name or choose All markets.</Label>}
    </Sheet>
    <OrderBottomSheet key={`${asset.symbol}-${direction}`} asset={asset} direction={direction} onClose={() => setDirection(null)} />
  </TradeSurface>;
}
