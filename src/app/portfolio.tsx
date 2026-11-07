import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { EquityCurve } from '../components/EquityCurve';
import { SegmentedControl } from '../components/SegmentedControl';
import { ScreenSystemBars } from '../components/ScreenSystemBars';
import { AppButton, Chip, EmptyState, ErrorState, GlassCard, Icon, Label, LoadingState, PracticeLabel, Row, Sheet, WorkspaceHeader } from '../components/design';
import { portfolioAnalytics } from '../lib/analytics';
import { assets, money, usdNotional } from '../lib/market';
import { contentBottomPadding, navigationLayout } from '../lib/navigation';
import { fitChartHeight, responsiveLayout } from '../lib/responsiveLayout';
import { initialWallet, pnl, Position } from '../lib/simulator';
import { fonts, ThemeSurface, useTheme } from '../lib/theme';
import { useWorkspace } from '../lib/workspace';
import { useDemoMarket } from '../lib/demoMarketProvider';

const signedMoney = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${money(Math.abs(value))}`;
const optionalMoney = (value: number | null) => value === null ? '—' : signedMoney(value);

export default function Portfolio() {
  return <ThemeSurface tone="light"><AnalyticsDashboard /></ThemeSurface>;
}

function AnalyticsDashboard() {
  const { wallet, loaded, storageError, close } = useWorkspace();
  const { quotes, ready: pricesReady } = useDemoMarket({ active: true });
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const layout = responsiveLayout({ width, height, insets });
  const wide = width > navigationLayout.wideBreakpoint;
  const [section, setSection] = useState('Open positions');
  const [filter, setFilter] = useState('All trades');
  const [limit, setLimit] = useState(10);
  const [closing, setClosing] = useState<Position | null>(null);
  const [closeError, setCloseError] = useState('');
  const stats = useMemo(() => portfolioAnalytics(wallet, quotes), [wallet, quotes]);
  const history = useMemo(() => [...stats.chronological].reverse().filter(p =>
    filter === 'Winners' ? (p.pnl ?? 0) > 0 : filter === 'Losers' ? (p.pnl ?? 0) < 0 : filter === 'Breakeven' ? (p.pnl ?? 0) === 0 : true), [stats.chronological, filter]);
  const positions = section === 'Open positions' ? wallet.positions : history;
  const gain = stats.equity - initialWallet.cash;
  const metrics = [
    { label: 'Realized P&L', value: signedMoney(stats.realized), detail: 'Closed trades · after fees', color: stats.realized < 0 ? colors.down : colors.up },
    { label: 'Open P&L', value: signedMoney(stats.unrealized), detail: `${wallet.positions.length} open positions · before fees`, color: stats.unrealized < 0 ? colors.down : colors.up },
    { label: 'Win rate', value: stats.winRate === null ? '—' : `${stats.winRate.toFixed(1)}%`, detail: `${stats.wins} wins / ${wallet.history.length} closed trades`, color: colors.text },
    { label: 'Profit factor', value: stats.profitFactor === null ? '—' : stats.profitFactor.toFixed(2), detail: stats.grossLoss ? 'Gross profit / gross loss' : 'Needs a losing trade', color: colors.text },
  ];
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.bg }}>
    <ScreenSystemBars style="dark" backgroundColor={colors.bg} />
    {!loaded || !pricesReady ? <LoadingState /> : <ScrollView contentContainerStyle={{ padding: wide ? 32 : 22, paddingBottom: contentBottomPadding({ bottomInset: insets.bottom, wide, tabRoute: false, contentGap: wide ? 40 : 22 }), gap: 24, maxWidth: 1440, width: '100%', alignSelf: 'center' }}>
      <AppButton label="Back to profile" variant="ghost" icon="arrow-back" onPress={() => router.replace('/profile')} /><WorkspaceHeader title="Portfolio analytics" subtitle="PORTFOLIO & PERFORMANCE" />
      <PracticeLabel />
      {!!storageError && <ErrorState message={storageError} />}
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16 }}>
        <GlassCard style={{ flex: 1, padding: 24 }}>
          <Row><Label muted size={12}>Total account equity</Label><Icon name="wallet-outline" color={colors.primary} /></Row>
          <Label size={width < 360 ? 32 : 40} bold style={{ fontFamily: fonts.extraBold, letterSpacing: -1.5 }}>{money(stats.equity)}</Label>
          <Row style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}><Label bold size={13} color={gain < 0 ? colors.down : colors.up}>{signedMoney(gain)} ({(gain / initialWallet.cash * 100).toFixed(2)}%)</Label><Label muted size={11}>all time</Label></Row>
          <Row style={{ flexWrap: 'wrap', borderTopWidth: 1, borderColor: colors.border, paddingTop: 16 }}><View><Label muted size={11}>Available cash</Label><Label bold>{money(wallet.cash)}</Label></View><View><Label muted size={11}>Reserved capital</Label><Label bold>{money(stats.reserved)}</Label></View></Row>
        </GlassCard>
        <View style={{ flex: wide ? 1.6 : undefined, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {metrics.map(metric => <GlassCard key={metric.label} style={{ flexBasis: width < 360 ? '100%' : '46%', flexGrow: 1, padding: 18, gap: 8 }}><Label muted size={11}>{metric.label}</Label><Label bold size={24} color={metric.color}>{metric.value}</Label><Label muted size={10}>{metric.detail}</Label></GlassCard>)}
        </View>
      </View>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16, alignItems: 'stretch' }}>
        <GlassCard style={{ flex: wide ? 1.7 : undefined }}>
          <Row><View style={{ flex: 1 }}><Label bold size={20}>Equity curve</Label><Label muted size={11}>All-time closed results, net of trading fees</Label></View><Icon name="pulse-outline" color={colors.primary} /></Row>
          <Label bold size={28}>{money(stats.curve[stats.curve.length - 1])}</Label>
          <EquityCurve values={stats.curve} height={layout.compactHeight ? fitChartHeight(Math.max(80, layout.usableHeight - 180), 140, 100) : 190} />
          <Label muted size={11}>{wallet.history.length ? `Current equity also includes ${signedMoney(stats.unrealized)} open P&L and ${money(stats.openFees)} in open entry fees. The curve records balances when trades close.` : 'Your curve begins at $10,000. Close a practice trade to record your first result.'}</Label>
        </GlassCard>
        <GlassCard style={{ flex: wide ? 1 : undefined }}>
          <Label bold size={20}>Trade outcomes</Label>
          <Label bold size={36} color={colors.primary}>{stats.winRate === null ? '—' : `${stats.winRate.toFixed(1)}%`}<Label muted size={12}> win rate</Label></Label>
          <View accessible accessibilityLabel={`${stats.wins} winning, ${stats.losses} losing, ${stats.breakeven} breakeven trades`} style={{ height: 12, borderRadius: 6, overflow: 'hidden', flexDirection: 'row', backgroundColor: colors.raised }}>
            {stats.wins > 0 && <View style={{ flex: stats.wins, backgroundColor: colors.up }} />}
            {stats.losses > 0 && <View style={{ flex: stats.losses, backgroundColor: colors.down }} />}
            {stats.breakeven > 0 && <View style={{ flex: stats.breakeven, backgroundColor: colors.sub }} />}
          </View>
          {[['Winning trades', stats.wins, colors.up], ['Losing trades', stats.losses, colors.down], ['Breakeven trades', stats.breakeven, colors.sub]].map(([label, count, color]) => <Row key={label}><Row><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color as string }} /><Label muted size={12}>{label}</Label></Row><Label bold>{count}</Label></Row>)}
          <Label muted size={11}>A win is a closed trade with positive P&L after fees. Breakeven trades count toward the total.</Label>
        </GlassCard>
      </View>
      <GlassCard>
        <Label bold size={20}>Performance statistics</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 24 }}>
          {[
            ['Average win', optionalMoney(stats.averageWin)], ['Average loss', optionalMoney(stats.averageLoss)],
            ['Best trade', optionalMoney(stats.bestTrade)], ['Worst trade', optionalMoney(stats.worstTrade)],
            ['Average trade', optionalMoney(stats.expectancy)], ['Max. closed drawdown', wallet.history.length ? `${stats.maxDrawdown.toFixed(2)}%` : '—'],
          ].map(([label, value]) => <View key={label} style={{ flexBasis: wide ? '28%' : '43%', flexGrow: 1, gap: 8 }}><Label muted size={11}>{label}</Label><Label bold size={18}>{value}</Label></View>)}
        </View>
        <Label muted size={10}>Statistics use all closed trades after fees. Drawdown measures the largest peak-to-trough drop in the closed-trade balance; intratrade movements are not recorded.</Label>
      </GlassCard>
      <GlassCard style={{ padding: 18 }}>
        <Row><Label bold size={20}>Your portfolio</Label><Label muted size={11}>{positions.length} {section === 'Open positions' ? 'open' : 'results'}</Label></Row>
        <SegmentedControl tone="light" options={['Open positions', 'Trade history']} value={section} onChange={value => { setSection(value); setLimit(10); }} />
        {section === 'Trade history' && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{['All trades', 'Winners', 'Losers', 'Breakeven'].map(value => <Chip key={value} label={value} selected={filter === value} onPress={() => { setFilter(value); setLimit(10); }} />)}</ScrollView>}
        {!positions.length ? <EmptyState icon={section === 'Open positions' ? 'layers-outline' : 'receipt-outline'} title={section === 'Open positions' ? 'No open positions' : filter === 'All trades' ? 'Your journal starts here' : 'No matching trades'} detail={section === 'Open positions' ? 'Open a virtual trade from the Trade tab to track your positions here.' : 'Closed trades appear here with their results after fees. Try another filter or close a practice position.'} /> : positions.slice(0, limit).map(position => <PositionRow key={position.id} position={position} closed={section === 'Trade history'} onClose={() => { setCloseError(''); setClosing(position); }} />)}
        {positions.length > limit && <AppButton variant="secondary" label={`Show more (${positions.length - limit} remaining)`} onPress={() => setLimit(value => value + 10)} />}
        <AppButton variant="secondary" label="Go to trading" icon="arrow-forward" onPress={() => router.push({ pathname: '/(tabs)/practice', params: { mode: 'sample' } })} />
      </GlassCard>
    </ScrollView>}
    <Sheet visible={!!closing} title="Close virtual position?" onClose={() => setClosing(null)}>
      {closing && <><Label bold>{closing.symbol} · {closing.direction.toUpperCase()} · {closing.quantity} units</Label><Label muted>{closing.pricingSource === 'moving-demo-v1' ? 'This position will close at the current moving demo quote.' : 'This older position will close at its original fixed demo quote.'} Reserved collateral returns to your virtual cash balance, including the simulated result and less the closing fee.</Label><Label>Open P&L before fees: {signedMoney(pnl(closing, closing.pricingSource === 'moving-demo-v1' ? quotes[closing.symbol] : undefined))}</Label>{!!closeError && <ErrorState message={closeError} />}<AppButton label="Confirm close" variant="danger" onPress={() => { try { close(closing.id); setClosing(null); } catch (error) { setCloseError(error instanceof Error ? error.message : 'Could not close this position.'); } }} /><AppButton label="Keep position open" variant="secondary" onPress={() => setClosing(null)} /></>}
    </Sheet>
  </SafeAreaView>;
}

function PositionRow({ position: p, closed, onClose }: { position: Position; closed: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const asset = assets.find(a => a.symbol === p.symbol);
  const { quotes } = useDemoMarket();
  const mark = p.pricingSource === 'moving-demo-v1' ? quotes[p.symbol] : undefined;
  const result = closed ? p.pnl ?? 0 : pnl(p, mark);
  const date = new Date((closed ? p.closed : p.opened) || p.opened);
  return <View style={{ paddingVertical: 16, gap: 10, borderTopWidth: 1, borderColor: colors.border }}>
    <Row style={{ flexWrap: 'wrap' }}><Row><View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center' }}><Icon name={p.direction === 'buy' ? 'arrow-up' : 'arrow-down'} size={18} color={p.direction === 'buy' ? colors.up : colors.down} /></View><View><Label bold>{p.symbol}</Label><Label muted size={10}>{p.direction === 'buy' ? 'BUY / LONG' : 'SELL / SHORT'} · {p.quantity} units · {p.pricingSource === 'moving-demo-v1' ? 'MOVING DEMO' : 'LEGACY FIXED'}</Label></View></Row><View><Label bold color={result < 0 ? colors.down : result > 0 ? colors.up : colors.sub}>{signedMoney(result)}</Label><Label muted size={10} style={{ textAlign: 'right' }}>{closed ? result > 0 ? 'WIN · NET P&L' : result < 0 ? 'LOSS · NET P&L' : 'BREAKEVEN' : 'UNREALIZED · BEFORE FEES'}</Label></View></Row>
    <Row style={{ flexWrap: 'wrap' }}><Label muted size={11}>Entry {p.entry.toFixed(asset?.precision ?? 2)}{!closed && asset ? ` · Mark ${(mark ?? asset.price).toFixed(asset.precision)}` : ''}</Label><Label muted size={10}>{closed ? 'Closed' : 'Opened'} {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Label></Row>
    {!closed && <><Label muted size={10}>Reserved {money(asset ? usdNotional({ ...asset, price: p.entry }, p.quantity) : p.entry * p.quantity)} · SL {p.stopLoss ?? '—'} · TP {p.takeProfit ?? '—'}</Label><AppButton label="Close position" variant="secondary" compact onPress={onClose} /></>}
  </View>;
}
