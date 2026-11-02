import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '../../components/BottomSheet';
import { ContentState } from '../../components/ContentState';
import { GhostButton } from '../../components/GhostButton';
import { MarketRow } from '../../components/MarketRow';
import { OrderBottomSheet } from '../../components/OrderBottomSheet';
import { PrimaryButton } from '../../components/PrimaryButton';
import { TradingChart } from '../../components/TradingChart';
import { AppInput, Chip, Icon, Label, PracticeLabel, Row, Sheet, WorkspaceHeader, ErrorState } from '../../components/design';
import { Asset, assets, money, price } from '../../lib/market';
import { Direction, pnl, summary } from '../../lib/simulator';
import { fonts, ThemeSurface, useTheme } from '../../lib/theme';
import { useWorkspace } from '../../lib/workspace';

export default function Trade() { return <ThemeSurface tone="dark"><TradeWorkspace /></ThemeSurface>; }
function TradeWorkspace() {
  const { wallet, favorites, toggle, close, t, loaded, storageError } = useWorkspace();
  const { colors } = useTheme(); const { width } = useWindowDimensions(); const insets = useSafeAreaInsets(); const wide = width > 1050;
  const [asset, setAsset] = useState(assets[0]);
  const [direction, setDirection] = useState<Direction | null>(null);
  const [search, setSearch] = useState(''); const [category, setCategory] = useState('All');
  const [portfolio, setPortfolio] = useState('Open positions'); const [closing, setClosing] = useState<string | null>(null);
  const [preview, setPreview] = useState(false); const [showPortfolio, setShowPortfolio] = useState(false);
  const stats = summary(wallet);
  const filtered = assets.filter(a => (category === 'All' || (category === 'Favorites' ? favorites.includes(a.symbol) : a.category === category)) && `${a.symbol} ${a.name}`.toLowerCase().includes(search.toLowerCase()));
  const choose = (a: Asset) => { setAsset(a); setPreview(true); };
  const balance = money(stats.equity).split('.');
  const gain = stats.equity - 10000;
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.bg }}>
    <StatusBar style="light" />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
      <View style={[styles.workspace, { flexDirection: wide ? 'row' : 'column', maxWidth: wide ? 1440 : undefined }]}>
        <View style={[styles.hero, { flex: wide ? 1 : undefined }]}>
          <WorkspaceHeader title={t('Trade')} subtitle="YOUR PRACTICE ACCOUNT" />
          <View style={{ gap: 8, paddingTop: 16 }}>
            <Label size={13} muted>Total virtual balance</Label>
            <Label size={width < 360 ? 42 : 52} bold style={{ fontFamily: fonts.extraBold, letterSpacing: -2, lineHeight: 68 }}>{balance[0]}<Label size={width < 360 ? 42 : 52} color={colors.sub} style={{ fontFamily: fonts.extraBold }}>.{balance[1]}</Label></Label>
            <Row style={{ justifyContent: 'flex-start' }}><Icon name={gain < 0 ? 'arrow-down' : 'arrow-up'} size={14} color={gain < 0 ? colors.down : colors.up} /><Label size={12} color={gain < 0 ? colors.down : colors.up}>{gain >= 0 ? '+' : ''}{money(gain)} ({((stats.equity / 10000 - 1) * 100).toFixed(2)}%)</Label><Label size={11} muted>all time</Label></Row>
          </View>
          <PrimaryButton label="New trade" icon="add" onPress={() => setPreview(true)} />
          <View style={{ backgroundColor: colors.card, borderRadius: 24, padding: 24, gap: 24 }}>
            <Row style={{ alignItems: 'flex-start' }}><View style={{ flex: 1, gap: 8 }}><Label size={12} muted>Open P&L</Label><Row style={{ justifyContent: 'flex-start' }}><Icon name={stats.unrealized < 0 ? 'trending-down' : 'trending-up'} size={18} color={stats.unrealized < 0 ? colors.down : colors.up} /><Label size={22} bold color={stats.unrealized < 0 ? colors.down : colors.up}>{money(stats.unrealized)}</Label></Row></View>
              <Pressable accessibilityRole="button" accessibilityLabel="View positions and trading history" onPress={() => setShowPortfolio(true)} style={({ pressed }) => ({ flex: 1, gap: 8, minHeight: 56, borderLeftWidth: 1, borderColor: colors.border, paddingLeft: 24, opacity: pressed ? 0.6 : 1 })}><Row><Label size={12} muted>Positions</Label><Icon name="arrow-forward" size={16} color={colors.sub} /></Row><Label size={22} bold>{wallet.positions.length.toString().padStart(2, '0')}</Label></Pressable>
            </Row>
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
            <Row><Label size={11} muted style={{ flex: 1 }}>{t('Available funds')}</Label><Label size={13}>{money(wallet.cash)}</Label></Row>
            <Row><Label size={11} muted>Reserved / realized P&L</Label><Label size={11}>{money(stats.reserved)} / {money(stats.realized)}</Label></Row>
          </View>
          <GhostButton label="Portfolio & history" icon="layers-outline" onPress={() => setShowPortfolio(true)} />
          <PracticeLabel />
          {!!storageError && <ErrorState message={storageError} />}
        </View>
        <BottomSheet style={{ flex: wide ? 1.2 : 1, marginTop: wide ? 24 : 8, borderRadius: wide ? 32 : undefined, paddingBottom: wide ? 32 : 104 + Math.max(insets.bottom, 14) }}>
          <Row><View><Label size={26} bold>{t('Markets')}</Label><Label size={12} muted>Find your next practice.</Label></View><Icon name="search-outline" color={colors.sheetSub} /></Row>
          <AppInput label="Find an asset" value={search} onChangeText={setSearch} placeholder="Search symbol or name" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{['All', 'Favorites', 'Forex', 'Crypto', 'Metals', 'Commodities', 'Indices'].map(c => <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />)}</ScrollView>
          <View>{!loaded ? <ContentState kind="skeleton" tone="light" title="Loading markets" /> : filtered.length ? filtered.map(a => <MarketRow key={a.symbol} asset={a} selected={asset.symbol === a.symbol} favorite={favorites.includes(a.symbol)} onFavorite={() => toggle('favorites', a.symbol)} onPress={() => choose(a)} />) : <><ContentState kind="empty" tone="light" title="No matching markets" detail="Try another category or search term, or add a favorite to your list." /><GhostButton tone="light" label="Show all markets" onPress={() => { setSearch(''); setCategory('All'); }} /></>}</View>
          <PracticeLabel />
        </BottomSheet>
      </View>
    </ScrollView>
    <Sheet visible={preview || direction !== null} onClose={() => { setPreview(false); setDirection(null); }} title={direction ? 'Virtual order' : asset.symbol}>
      {direction ? <OrderBottomSheet key={`${asset.symbol}-${direction}`} embedded asset={asset} direction={direction} onClose={() => setDirection(null)} /> : <>
      <Row><Label muted size={12}>{asset.name}</Label><Label size={24} bold>{price(asset)}</Label></Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{assets.map(a => <Chip key={a.symbol} label={a.symbol} selected={asset.symbol === a.symbol} onPress={() => setAsset(a)} />)}</ScrollView>
      <TradingChart key={asset.symbol} asset={asset} />
      <PrimaryButton label={`${t('Buy')} ${asset.symbol}`} icon="arrow-up" tone="light" haptic onPress={() => { setPreview(false); setDirection('buy'); }} />
      <GhostButton label={`${t('Sell')} ${asset.symbol}`} icon="arrow-down" tone="light" intent="negative" haptic onPress={() => { setPreview(false); setDirection('sell'); }} />
      <PracticeLabel />
      </>}
    </Sheet>
    <Sheet visible={showPortfolio || !!closing} onClose={() => { setShowPortfolio(false); setClosing(null); }} title={closing ? 'Close virtual position?' : 'Your portfolio'}>
      {closing ? <><Label muted>The position will close at the fixed simulated quote. Your reserved funds will return to your wallet, less the closing fee.</Label><PrimaryButton label="Confirm" tone="light" onPress={() => { close(closing); setClosing(null); }} /><GhostButton label="Cancel" tone="light" onPress={() => setClosing(null)} /></> : <>
      <Row>{['Open positions', 'History'].map(v => <Chip key={v} label={v} selected={portfolio === v} onPress={() => setPortfolio(v)} />)}</Row>
      {portfolio === 'Open positions' ? wallet.positions.length ? wallet.positions.map(p => <View key={p.id} style={{ paddingVertical: 16, gap: 16, borderBottomWidth: 1, borderColor: colors.sheetBorder }}><Row><View style={{ flex: 1 }}><Label bold>{p.symbol} · {p.direction.toUpperCase()}</Label><Label muted size={11}>{p.quantity} units @ {p.entry}</Label></View><Label bold color={pnl(p) < 0 ? colors.sheetDown : colors.sheetUp}>{pnl(p) < 0 ? '↘ ' : '↗ '}{money(pnl(p))}</Label></Row><Label muted size={11}>{money(p.entry * p.quantity)} reserved · SL {p.stopLoss || '—'} · TP {p.takeProfit || '—'}</Label><GhostButton tone="light" label="Close position" onPress={() => setClosing(p.id)} /></View>) : <ContentState kind="empty" tone="light" title="Your first trade starts here" detail="Choose a market and open a virtual position. Your real money stays out of it." /> : wallet.history.length ? wallet.history.map(p => <Row key={p.id}><View style={{ flex: 1 }}><Label bold>{p.symbol} · {p.direction.toUpperCase()}</Label><Label muted size={11}>{p.quantity} units · {new Date(p.closed!).toLocaleDateString()}</Label></View><Label color={(p.pnl || 0) < 0 ? colors.sheetDown : colors.sheetUp}>{(p.pnl || 0) < 0 ? '↘ ' : '↗ '}{money(p.pnl || 0)}</Label></Row>) : <ContentState kind="empty" tone="light" title="A clean trading journal" detail="Closed positions appear here with realized profit or loss, including fees." />}
      </>}
    </Sheet>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ workspace: { width: '100%', alignSelf: 'center', flex: 1, gap: 16 }, hero: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 16, gap: 24 } });
