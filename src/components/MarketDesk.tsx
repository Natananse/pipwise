import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type Asset, assets } from '../lib/market';
import { analyzeMarket, type MarketAnalysis } from '../lib/marketAnalysis';
import { useMarketResource } from '../lib/marketProvider';
import { sampleMarket } from '../lib/marketSample';
import { type MarketArticle, type MarketResource, type MarketTimeframe, marketTimeframes } from '../lib/marketTypes';
import { useWorkspace } from '../lib/workspace';
import { MarketBadge } from './MarketBadge';
import { TradingChart } from './TradingChart';
import { Icon, Label, Row } from './design';

const c = { bg: '#0C100F', card: '#151B18', line: '#29332D', ink: '#F4F6EF', sub: '#A0AAA2', mint: '#6EE7BE', coral: '#FF9DA5', gold: '#EFCC83' };
const emptyCandles: never[] = [];
const stateLabels: Record<MarketResource<unknown>['state'], string> = {
  idle: 'Not checked', loading: 'Connecting', ready: 'Available', stale: 'Saved data · refresh needed',
  offline: 'Feed unreachable', unavailable: 'Not connected', error: 'Request failed',
};

export function MarketDesk() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { favorites, toggle, storageError } = useWorkspace();
  const [symbol, setSymbol] = useState('EUR/USD');
  const [timeframe, setTimeframe] = useState<MarketTimeframe>('1h');
  const [mode, setMode] = useState<'provider' | 'sample'>('provider');
  const [filter, setFilter] = useState<'all' | 'watchlist'>('all');
  const [linkError, setLinkError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const asset = assets.find(item => item.symbol === symbol) ?? assets[0];
  const sample = mode === 'sample';
  const quote = useMarketResource('quote', symbol, timeframe, !sample);
  const candles = useMarketResource('candles', symbol, timeframe, !sample);
  const news = useMarketResource('news', symbol, timeframe, !sample);
  const fixture = useMemo(() => sampleMarket(asset, timeframe), [asset, timeframe]);
  const shownQuote = sample ? fixture.quote : quote.data;
  const series = sample ? fixture.series : candles.data;
  const evaluationNow = Math.max(now, quote.lastCheckedAt ?? 0, candles.lastCheckedAt ?? 0, news.lastCheckedAt ?? 0);
  const analysis = useMemo(() => series ? analyzeMarket(series, { now: evaluationNow, sample, news: sample ? null : news.data }) : null, [news.data, evaluationNow, sample, series]);
  const articles = sample ? [] : (news.data?.articles ?? []).filter(article => article.publishedAt <= evaluationNow && evaluationNow - article.publishedAt <= 72 * 3600000);
  const visible = assets.filter(item => filter === 'all' || favorites.includes(item.symbol));
  const busy = !sample && [quote, candles, news].some(item => item.state === 'loading');
  const refresh = () => { void Promise.allSettled([quote.refresh(), candles.refresh(), news.refresh()]); };
  const saved = favorites.includes(symbol);
  const wide = width >= 900;
  const openArticle = async (article: MarketArticle) => {
    setLinkError('');
    try { await WebBrowser.openBrowserAsync(article.url); }
    catch { setLinkError('This article could not be opened. Try again.'); }
  };

  return <View style={[s.screen, { paddingLeft: insets.left, paddingRight: insets.right }]}>
    <StatusBar style="light" />
    <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1, borderColor: c.line }}>
      <Row style={s.header}>
        <Action label="Back to practice" icon="arrow-back" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/practice')} />
        <View style={{ flex: 1 }}><Label bold size={19} color={c.ink}>Market desk</Label><Label size={10} color={c.sub}>Prices, context &amp; conditional outlooks</Label></View>
        <Action label={sample ? 'Sample data is fixed' : 'Refresh selected market'} icon="refresh" disabled={sample || busy} onPress={refresh} />
      </Row>
    </View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ width: '100%', maxWidth: 1180, alignSelf: 'center', padding: 18, paddingBottom: insets.bottom + 36, gap: 18 }}>
      <Row style={{ flexWrap: 'wrap', gap: 8, justifyContent: 'flex-start' }}>
        <Pill label="Provider data" selected={!sample} onPress={() => setMode('provider')} />
        <Pill label="Try sample data" selected={sample} onPress={() => setMode('sample')} />
      </Row>
      {sample ? <Notice title="SAMPLE DATA" detail="Synthetic prices and candles for testing the tools. These are fixed examples from October 2026, with no real news feed." color={c.gold} />
        : <Notice title={quote.data || candles.data ? 'PROVIDER DATA' : 'LIVE FEEDS AWAITING ACCESS'} detail={quote.data || candles.data ? 'Each feed shows its own source and timestamp. Saved or delayed prices may differ from the current market.' : 'Market prices and news are not connected yet. You can save a watchlist and try all chart and analysis tools with sample data.'} color={c.mint} />}
      {storageError && <Notice title="Watchlist storage" detail={storageError} color={c.coral} />}

      <View style={{ gap: 10 }}>
        <Row style={{ flexWrap: 'wrap', gap: 8 }}><Label bold size={14} color={c.ink}>Your markets</Label><Row style={{ gap: 6 }}><Pill label="All 7" selected={filter === 'all'} onPress={() => setFilter('all')} /><Pill label={`Watchlist ${assets.filter(item => favorites.includes(item.symbol)).length}`} selected={filter === 'watchlist'} onPress={() => setFilter('watchlist')} /></Row></Row>
        {!visible.length ? <View style={s.card}><Label bold color={c.ink}>Your watchlist is empty</Label><Label size={12} color={c.sub}>Choose All 7, then save markets with their stars.</Label><Pill label="Add markets" onPress={() => setFilter('all')} /></View>
          : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>{visible.map(item => <MarketTile key={item.symbol} asset={item} selected={symbol === item.symbol} sample={sample} saved={favorites.includes(item.symbol)} onSelect={() => { setSymbol(item.symbol); setLinkError(''); }} onStar={() => toggle('favorites', item.symbol)} />)}</ScrollView>}
      </View>

      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16, alignItems: 'stretch' }}>
        <View style={[s.card, { flex: wide ? 0.36 : undefined }]}>
          <Row><Row style={{ gap: 10, justifyContent: 'flex-start', flex: 1 }}><MarketBadge asset={asset} size={36} paired /><View><Label bold size={17} color={c.ink}>{symbol}</Label><Label size={10} color={c.sub}>{asset.name}</Label></View></Row><Action label={`${saved ? 'Remove' : 'Add'} ${symbol} ${saved ? 'from' : 'to'} watchlist`} icon={saved ? 'star' : 'star-outline'} selected={saved} onPress={() => toggle('favorites', symbol)} /></Row>
          <View style={{ gap: 5, marginVertical: 6 }}>
            <Label bold size={36} color={c.ink} style={{ fontVariant: ['tabular-nums'], letterSpacing: -1 }}>{shownQuote ? formatPrice(asset, shownQuote.price) : '—'}</Label>
            <Label size={11} color={c.sub}>{symbol === 'USD/JPY' ? 'JPY per USD' : symbol === 'SPX/USD' ? 'Index points' : 'Quoted in USD'}</Label>
            {shownQuote?.changePercent !== null && shownQuote?.changePercent !== undefined && <Label bold size={14} color={shownQuote.changePercent >= 0 ? c.mint : c.coral}>{shownQuote.changePercent >= 0 ? '+' : ''}{shownQuote.changePercent.toFixed(2)}% · {sample ? 'sample comparison' : 'provider change'}</Label>}
          </View>
          {shownQuote && <View style={{ gap: 5 }}><Label size={11} color={c.sub}>{shownQuote.source} · {sample ? 'synthetic' : shownQuote.kind}</Label><Label size={10} color={c.sub}>Price as of {utc(shownQuote.asOf)}</Label>{!sample && <Label size={10} color={c.sub}>Market {shownQuote.marketOpen === null ? 'hours unknown' : shownQuote.marketOpen ? 'open' : 'closed'}{quote.fromCache ? ' · cached' : ''}</Label>}</View>}
          {!sample && <FeedStatus label="Price" resource={quote} />}
          <View style={s.rule} /><Label size={11} color={c.sub}>Research prices are separate from fixed practice quotes and virtual orders.</Label>
        </View>

        <View style={[s.card, { flex: wide ? 0.64 : undefined, padding: 12 }]}>
          <TradingChart key={`${symbol}-${timeframe}-${mode}`} asset={asset} terminal referenceUI accentColor={c.mint} plotHeight={wide ? 330 : 260} external={{
            candles: series?.candles ?? emptyCandles, timeframe, sample,
            loading: !sample && !series && candles.state === 'loading',
            error: !sample && !series && candles.state !== 'loading' ? candles.error ?? 'Candles are not connected yet. Try sample data to explore the chart.' : '',
            onTimeframeChange: value => { if (marketTimeframes.includes(value as MarketTimeframe)) setTimeframe(value as MarketTimeframe); },
            onRetry: () => { void candles.refresh(); },
          }} />
          <Label size={10} color={c.sub}>{series ? `${series.source} · ${series.candles.length} bars · UTC` : 'Historical candles awaiting a connected feed'}</Label>
          <Label size={10} color={c.sub}>Touch to inspect OHLC · Zoom and pan in chart tools. The latest candle may still be forming.</Label>
          {!sample && <FeedStatus label="Candles" resource={candles} />}
        </View>
      </View>

      <Outlook analysis={analysis} asset={asset} sample={sample} cached={!sample && candles.fromCache} />

      <View style={s.card}>
        <SectionTitle eyebrow="FUNDAMENTAL CONTEXT" title="News behind the market" icon="newspaper-outline" />
        <Label size={12} color={c.sub}>{sample ? 'Sample mode has no news. Switch to Provider data to check for connected coverage.' : articles.length ? `${articles.length} related headline${articles.length === 1 ? '' : 's'} from the past 72 hours. News is context; it does not establish price direction or cause.` : 'No recent coverage is available. Missing news is not neutral sentiment.'}</Label>
        {!sample && <FeedStatus label="News" resource={news} />}
        {articles.map(article => <Pressable key={article.id} accessibilityRole="link" accessibilityLabel={`Read ${article.title} from ${article.source}`} onPress={() => { void openArticle(article); }} style={({ pressed }) => [s.article, { opacity: pressed ? 0.65 : 1 }]}>
          <Label size={10} color={c.sub}>{article.source} · {utc(article.publishedAt)}</Label><Row style={{ gap: 10 }}><Label bold size={14} color={c.ink} style={{ flex: 1 }}>{article.title}</Label><Icon name="open-outline" size={18} color={c.mint} /></Row>
          {article.sentiment && <Label size={10} color={c.sub}>Provider tone for {article.sentiment.entity}: {article.sentiment.score > 0.15 ? 'positive' : article.sentiment.score < -0.15 ? 'negative' : 'mixed / neutral'}. This describes the article, not a price forecast.</Label>}
        </Pressable>)}
        {!!linkError && <Label size={12} color={c.coral}>{linkError}</Label>}
        <View style={s.rule} /><Label bold size={12} color={c.ink}>What to compare with the chart</Label>
        <Label size={12} color={c.sub}>{fundamentalDrivers[symbol]}</Label>
        <Label size={11} color={c.sub}>Headlines alone do not reveal what was already priced in. Check the event time, the surprise relative to expectations, and the subsequent price response.</Label>
      </View>

      <View style={s.card}>
        <SectionTitle eyebrow="DATA & CONNECTION" title={sample ? 'Sample mode' : 'Feed health'} icon="cloud-outline" />
        {sample ? <Label size={12} color={c.sub}>No provider requests run in this mode. Sample values never enter the provider cache.</Label> : <>
          <FeedStatus label="Latest price" resource={quote} /><FeedStatus label={`${timeframe} candles`} resource={candles} /><FeedStatus label="News" resource={news} />
          <Pill label={busy ? 'Checking feeds…' : 'Refresh selected market'} icon="refresh" disabled={busy} onPress={refresh} />
          <Label size={11} color={c.sub}>The cache keeps last good data available when a refresh fails, with source timestamps visible. Automatic checks pause when you leave this screen or put the app in the background.</Label>
        </>}
      </View>
    </ScrollView>
  </View>;
}

function MarketTile({ asset, selected, sample, saved, onSelect, onStar }: { asset: Asset; selected: boolean; sample: boolean; saved: boolean; onSelect: () => void; onStar: () => void }) {
  const quote = useMarketResource('quote', asset.symbol, '1h', !sample);
  const fixture = useMemo(() => sampleMarket(asset, '1h').quote, [asset]);
  const data = sample ? fixture : quote.data;
  return <View style={[s.tile, { borderColor: selected ? '#538B70' : c.line, backgroundColor: selected ? '#1C3026' : c.card }]}>
    <Row><MarketBadge asset={asset} size={25} /><Action label={`${saved ? 'Remove' : 'Add'} ${asset.symbol} ${saved ? 'from' : 'to'} watchlist`} icon={saved ? 'star' : 'star-outline'} selected={saved} onPress={onStar} /></Row>
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${asset.symbol}${selected ? ', selected' : ''}`} accessibilityState={{ selected }} onPress={onSelect} style={({ pressed }) => ({ gap: 5, minHeight: 64, justifyContent: 'center', opacity: pressed ? 0.65 : 1 })}>
      <Label bold size={13} color={c.ink}>{asset.symbol}</Label><Label bold size={14} color={c.ink}>{data ? formatPrice(asset, data.price) : '—'}</Label><Label size={9} color={sample ? c.gold : c.sub}>{sample ? 'SAMPLE' : quote.state === 'loading' ? 'Checking…' : data ? `${quote.fromCache ? 'Cached · ' : ''}${utc(data.asOf)}` : stateLabels[quote.state]}</Label>
    </Pressable>
  </View>;
}

function Outlook({ analysis, asset, sample, cached }: { analysis: MarketAnalysis | null; asset: Asset; sample: boolean; cached: boolean }) {
  const i = analysis?.indicators;
  const ready = analysis?.status === 'ready' && !!i;
  const color = analysis?.bias === 'bullish' ? c.mint : analysis?.bias === 'bearish' ? c.coral : c.gold;
  const values = i ? [
    ['EMA 20 / 50', `${formatPrice(asset, i.ema20)} / ${formatPrice(asset, i.ema50)}`],
    ['RSI 14', i.rsi14.toFixed(1)], ['MACD 12, 26, 9', formatPrice(asset, i.macd)],
    ['MACD signal / histogram', `${formatPrice(asset, i.macdSignal)} / ${formatPrice(asset, i.macdHistogram)}`],
    ['ATR 14', formatPrice(asset, i.atr14)],
  ] : [];
  return <View style={s.card}>
    <SectionTitle eyebrow={sample ? 'SAMPLE OUTLOOK' : 'TECHNICAL OUTLOOK'} title="Trend, momentum & breakout levels" icon="analytics-outline" />
    {ready ? <><View style={[s.badge, { backgroundColor: `${color}16` }]}><Label bold size={13} color={color}>{sample ? 'Sample · ' : ''}{analysis.bias === 'mixed' ? 'Mixed conditions' : `${analysis.bias === 'bullish' ? 'Bullish' : 'Bearish'} alignment`}</Label></View>
      <Label size={13} color={c.sub}>{analysis.explanation}</Label>
      <Label size={10} color={c.sub}>{analysis.metadata.candlesUsed} completed {analysis.metadata.timeframe} candles · {analysis.metadata.timeframe === '1D' ? `Latest analyzed bar date ${new Date(analysis.metadata.lastClosedAt! - 86400000).toISOString().slice(0, 10)} (UTC date anchor)` : `Last close ${utc(analysis.metadata.lastClosedAt!)}`}{cached ? ' · saved data' : ''}</Label>
      <View style={s.rule} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{values.map(([label, value]) => <View key={label} style={s.indicator}><Label size={10} color={c.sub}>{label}</Label><Label bold size={13} color={c.ink}>{value}</Label></View>)}</View>
      <Label bold size={14} color={c.ink}>Conditional scenarios</Label>
      {analysis.scenarios.map(scenario => <View key={scenario.name} style={s.scenario}><Label bold size={13} color={scenario.name === 'Upside' ? c.mint : scenario.name === 'Downside' ? c.coral : c.gold}>{scenario.name}{scenario.trigger !== null ? ` · ${formatPrice(asset, scenario.trigger)}` : ''}</Label><Label size={12} color={c.sub}>{scenario.description}</Label></View>)}
    </> : <View style={{ gap: 8 }}><Label bold size={15} color={c.ink}>{analysis?.status === 'stale' ? 'Waiting for fresh candles' : 'Outlook awaiting candles'}</Label><Label size={12} color={c.sub}>{analysis?.explanation ?? 'Connect a candle feed or select Try sample data. At least 60 completed candles are needed to calculate the strategies.'}</Label></View>}
    <View style={s.rule} /><Label size={11} color={c.sub}>EMA20/50 trend, RSI14 momentum, MACD12/26/9 confirmation, and a prior 20-bar breakout range. ATR14 describes volatility. These rules use completed candles and have no measured forecast accuracy or guaranteed price target.</Label>
  </View>;
}

function FeedStatus({ label, resource }: { label: string; resource: MarketResource<unknown> }) {
  const color = resource.state === 'ready' ? c.mint : resource.state === 'error' || resource.state === 'offline' ? c.coral : c.gold;
  return <View style={{ gap: 4, paddingVertical: 5 }}><Row style={{ gap: 8, justifyContent: 'flex-start', flexWrap: 'wrap' }}>{resource.state === 'loading' ? <ActivityIndicator size="small" color={c.gold} /> : <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />}<Label bold size={11} color={c.ink}>{label}</Label><Label size={11} color={color}>{stateLabels[resource.state]}{resource.state === 'ready' && resource.fromCache ? ' · cached' : ''}</Label></Row>{resource.error && <Label size={11} color={c.sub}>{resource.error}</Label>}{resource.lastCheckedAt && <Label size={9} color={c.sub}>Last checked {utc(resource.lastCheckedAt)}</Label>}</View>;
}
function SectionTitle({ eyebrow, title, icon }: { eyebrow: string; title: string; icon: React.ComponentProps<typeof Icon>['name'] }) {
  return <Row style={{ gap: 12, justifyContent: 'flex-start' }}><View style={s.sectionIcon}><Icon name={icon} size={22} color={c.mint} /></View><View style={{ flex: 1, gap: 3 }}><Label bold size={9} color={c.sub} style={{ letterSpacing: 1.3 }}>{eyebrow}</Label><Label bold size={17} color={c.ink}>{title}</Label></View></Row>;
}
function Notice({ title, detail, color }: { title: string; detail: string; color: string }) {
  return <View style={[s.notice, { borderLeftColor: color }]}><Label bold size={10} color={color} style={{ letterSpacing: 1 }}>{title}</Label><Label size={12} color={c.sub}>{detail}</Label></View>;
}
function Action({ label, icon, onPress, disabled = false, selected = false }: { label: string; icon: React.ComponentProps<typeof Icon>['name']; onPress: () => void; disabled?: boolean; selected?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.action, { opacity: disabled ? 0.35 : pressed ? 0.6 : 1 }]}><Icon name={icon} size={20} color={selected ? c.mint : c.ink} /></Pressable>;
}
function Pill({ label, onPress, selected = false, disabled = false, icon }: { label: string; onPress: () => void; selected?: boolean; disabled?: boolean; icon?: React.ComponentProps<typeof Icon>['name'] }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.pill, { alignSelf: 'flex-start', borderColor: selected ? '#538B70' : c.line, backgroundColor: selected ? '#21382D' : c.card, opacity: disabled ? 0.5 : pressed ? 0.65 : 1 }]}>{icon && <Icon name={icon} size={16} color={c.mint} />}<Label bold size={12} color={selected ? c.mint : c.ink}>{label}</Label></Pressable>;
}
function formatPrice(asset: Asset, value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: asset.precision, maximumFractionDigits: asset.precision });
}
function utc(time: number) { return new Date(time).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'; }
const fundamentalDrivers: Record<string, string> = {
  'EUR/USD': 'Compare ECB and Federal Reserve rate expectations, euro area and US inflation, and relative growth. A story about one currency does not automatically determine the pair’s direction.',
  'GBP/USD': 'Compare Bank of England and Federal Reserve expectations, UK and US inflation, employment, and growth. Assess the surprise relative to what markets expected.',
  'USD/JPY': 'Compare US and Japanese yield expectations, Bank of Japan policy, and official intervention announcements. Keep the pair’s USD/JPY quotation direction in mind.',
  'BTC/USD': 'Review crypto regulation, market flows, network developments, and broad risk conditions. A positive headline can coincide with a falling price.',
  'XAU/USD': 'Review real yields, the dollar, central bank demand, and major risk events. Several drivers can move in opposite directions.',
  'WTI/USD': 'Review official inventory releases, OPEC+ supply decisions, demand expectations, and disruptions. Confirm whether the instrument is spot oil or a specific futures contract.',
  'SPX/USD': 'Review earnings expectations, interest rates, inflation, and index breadth. Broad index news can affect sectors in different ways.',
};
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bg }, header: { width: '100%', maxWidth: 1144, alignSelf: 'center', gap: 12 },
  card: { borderRadius: 23, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, padding: 18, gap: 14 },
  tile: { width: 172, borderRadius: 20, borderWidth: 1, padding: 12, gap: 4 },
  pill: { minHeight: 44, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  action: { minWidth: 44, minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#202923' },
  notice: { borderRadius: 14, backgroundColor: c.card, borderLeftWidth: 3, padding: 15, gap: 7 },
  rule: { height: 1, backgroundColor: c.line }, sectionIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#21382D', alignItems: 'center', justifyContent: 'center' },
  badge: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start' },
  indicator: { flexGrow: 1, flexBasis: '44%', borderRadius: 13, backgroundColor: '#202923', padding: 12, gap: 7 },
  scenario: { borderRadius: 13, borderWidth: 1, borderColor: c.line, padding: 14, gap: 7 },
  article: { paddingVertical: 14, borderBottomWidth: 1, borderColor: c.line, gap: 8, minHeight: 64 },
});
