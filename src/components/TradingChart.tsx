import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useId, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Line, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { Asset, Candle, marketData } from '../lib/market';
import { fonts, useTheme } from '../lib/theme';
import { ContentState } from './ContentState';
import { AppButton, Label, Row, Sheet } from './design';
import { SegmentedControl } from './SegmentedControl';

type ExternalChartData = {
  candles: Candle[]; timeframe: string; loading: boolean; error: string;
  onTimeframeChange: (timeframe: string) => void; onRetry: () => void; sample: boolean;
  moving?: boolean;
};
type ChartLevel = { label: string; price: number; color: string };

export function TradingChart({ asset, small = false, plotHeight, compactControls = false, referenceUI = false, terminal = false, accentColor, external, keyLevels = [] }: {
  asset: Asset; small?: boolean; plotHeight?: number; compactControls?: boolean; referenceUI?: boolean; terminal?: boolean; accentColor?: string;
  external?: ExternalChartData;
  keyLevels?: ChartLevel[];
}) {
  const { colors } = useTheme();
  const tone = colors.text === colors.sheetText ? 'light' : 'dark';
  const lineColor = accentColor ?? (referenceUI ? '#456987' : colors.text);
  const priceColor = terminal ? accentColor ?? colors.primary : colors.primary;
  const gridColor = terminal ? '#29332D' : colors.border;
  const axisColor = terminal ? '#A0AAA2' : colors.sub;
  const controlColor = terminal ? '#F4F6EF' : colors.text;
  const controlSurface = terminal ? '#202923' : colors.raised;
  const [demoCandles, setCandles] = useState<Candle[]>([]);
  const [demoFrame, setDemoFrame] = useState('1h');
  const [mode, setMode] = useState(referenceUI && !external?.moving ? 'Line' : 'Candles');
  const [zoom, setZoom] = useState(referenceUI ? 80 : 36);
  const [offset, setOffset] = useState(0);
  const [cross, setCross] = useState<number | null>(null);
  const [demoError, setError] = useState('');
  const [demoLoading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [width, setWidth] = useState(320);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [framesOpen, setFramesOpen] = useState(false);
  const [average, setAverage] = useState(false);
  const gradientId = useId().replace(/:/g, '');
  const candles = external ? external.candles : demoCandles;
  const frame = external?.timeframe ?? demoFrame;
  const error = external?.error ?? demoError;
  const loading = external?.loading ?? demoLoading;
  const sample = external?.sample ?? true;
  const externalMode = !!external;
  const setFrame = (next: string) => {
    if (external) external.onTimeframeChange(next);
    else { setLoading(true); setError(''); setDemoFrame(next); }
  };

  useEffect(() => {
    if (externalMode) return;
    let active = true;
    marketData.candles(asset, frame).then(data => {
      if (active) {
        setCandles(data);
        setError('');
        setLoading(false);
        setCross(null);
        setOffset(0);
      }
    }).catch(() => {
      if (active) {
        setError('Chart unavailable. Try loading the simulated series again.');
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [asset, frame, retry, externalMode]);

  const data = useMemo(() => candles.slice(
    Math.max(0, candles.length - zoom - offset), candles.length - offset,
  ), [candles, zoom, offset]);
  const h = Math.max(180, plotHeight ?? (small ? 180 : 300));
  const axisWidth = Math.max(72, asset.price.toFixed(asset.precision).length * 7 + 16);
  const plotW = Math.max(80, width - axisWidth);
  const plotTop = 16;
  const plotBottom = h - 32;
  const rawLow = data.length ? Math.min(...data.map(d => d.low)) : 0;
  const rawHigh = data.length ? Math.max(...data.map(d => d.high)) : 1;
  const span = Math.max(rawHigh - rawLow, Math.pow(10, -asset.precision) * 4);
  const low = rawLow - span * 0.08;
  const high = rawHigh + span * 0.08;
  const y = (value: number) => plotTop + (high - value) / (high - low) * (plotBottom - plotTop);
  const x = (index: number) => 8 + index / Math.max(1, data.length - 1) * (plotW - 16);
  const candleWidth = Math.max(2, Math.min(16, plotW / Math.max(1, data.length) * 0.62));
  const path = data.map((d, index) => `${index ? 'L' : 'M'}${x(index)},${y(d.close)}`).join(' ');
  const averagePath = data.slice(6).map((_, index) => {
    const point = index + 6;
    const value = data.slice(point - 6, point + 1).reduce((sum, candle) => sum + candle.close, 0) / 7;
    return `${index ? 'L' : 'M'}${x(point)},${y(value)}`;
  }).join(' ');
  const selectedIndex = cross === null ? null : Math.min(data.length - 1, Math.max(0, Math.round((cross - 8) / Math.max(1, plotW - 16) * (data.length - 1))));
  const selected = selectedIndex === null ? undefined : data[selectedIndex];
  const last = data[data.length - 1];
  const inspected = selected || last;
  const lastY = last ? Math.max(plotTop + 12, Math.min(plotBottom - 12, y(last.close))) : 0;
  const maxOffset = Math.max(0, candles.length - zoom);
  const reload = () => { if (external) external.onRetry(); else { setLoading(true); setError(''); setRetry(value => value + 1); } };
  const tools: { label: string; icon: keyof typeof Ionicons.glyphMap; disabled: boolean; onPress: () => void }[] = [
    { label: 'Pan to earlier candles', icon: 'chevron-back', disabled: loading || offset >= maxOffset, onPress: () => { setOffset(Math.min(maxOffset, offset + 8)); setCross(null); } },
    { label: 'Zoom out', icon: 'remove', disabled: loading || zoom >= 100, onPress: () => { setZoom(Math.min(100, zoom + 12)); setOffset(0); setCross(null); } },
    { label: 'Zoom in', icon: 'add', disabled: loading || zoom <= 24, onPress: () => { setZoom(Math.max(24, zoom - 12)); setOffset(0); setCross(null); } },
    { label: 'Pan to later candles', icon: 'chevron-forward', disabled: loading || !offset, onPress: () => { setOffset(Math.max(0, offset - 8)); setCross(null); } },
  ];

  return <View style={{ gap: 8 }}>
    {referenceUI && <Row style={{ justifyContent: terminal ? 'space-between' : 'flex-end', gap: terminal ? 6 : 10, flexWrap: 'wrap' }}>
      {terminal && <Label bold size={9} color="#A0AAA2" style={{ letterSpacing: 1.3 }}>PRICE ACTION</Label>}
      <Row style={{ gap: terminal ? 6 : 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Change chart timeframe" onPress={() => setFramesOpen(true)} style={({ pressed }) => ({ minHeight: terminal ? 44 : 42, paddingHorizontal: terminal ? 11 : 14, borderRadius: 14, borderWidth: terminal ? 1 : 0, borderColor: gridColor, backgroundColor: controlSurface, flexDirection: 'row', gap: 8, alignItems: 'center', opacity: pressed ? 0.6 : 1 })}><Label bold size={12} color={controlColor}>{frame}</Label><Ionicons name="chevron-down" size={12} color={controlColor} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Switch to ${mode === 'Line' ? 'candlestick' : 'line'} chart`} onPress={() => setMode(value => value === 'Line' ? 'Candles' : 'Line')} style={({ pressed }) => ({ minHeight: terminal ? 44 : 42, width: 44, borderRadius: 14, borderWidth: terminal ? 1 : 0, borderColor: gridColor, backgroundColor: controlSurface, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}><Ionicons name={mode === 'Line' ? 'stats-chart-outline' : 'pulse-outline'} size={21} color={controlColor} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Chart indicators and controls" onPress={() => setControlsOpen(true)} style={({ pressed }) => ({ minHeight: terminal ? 44 : 42, width: 44, borderRadius: 14, borderWidth: terminal ? 1 : 0, borderColor: gridColor, backgroundColor: controlSurface, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}><Ionicons name="color-wand-outline" size={21} color={average ? terminal ? lineColor : colors.primary : controlColor} /></Pressable>
      </Row>
    </Row>}
    {!small && (!referenceUI || external) && <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 4, minHeight: width < 300 ? 36 : 20 }}>
      {(['open', 'high', 'low', 'close'] as const).map((key, index) => <View key={key} style={{ flex: 1, flexBasis: width < 300 ? '44%' : '20%', flexDirection: 'row', gap: 4, alignItems: 'center' }}>
        <Label muted size={9}>{['O', 'H', 'L', 'C'][index]}</Label>
        <Label size={9} color={key === 'close' && inspected ? inspected.close >= inspected.open ? colors.up : colors.down : colors.sub}>{!loading && !error && inspected ? `${key === 'close' ? inspected.close >= inspected.open ? '↗ ' : '↘ ' : ''}${inspected[key].toFixed(asset.precision)}` : '—'}</Label>
      </View>)}
    </View>}
    {external && inspected && !loading && !error && <Label size={9} color={axisColor}>{selected ? 'Selected bar' : 'Latest bar'} · {frame === '1D' ? `${new Date(inspected.time).toISOString().slice(0, 10)} · UTC date anchor` : `${new Date(inspected.time).toISOString().slice(0, 16).replace('T', ' ')} UTC · open time`}</Label>}
    <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ height: h }}
      onStartShouldSetResponder={() => !loading && !error && !!data.length}
      onMoveShouldSetResponder={() => !loading && !error && !!data.length}
      onResponderGrant={event => setCross(Math.max(0, Math.min(plotW, event.nativeEvent.locationX)))}
      onResponderMove={event => setCross(Math.max(0, Math.min(plotW, event.nativeEvent.locationX)))}
      onResponderTerminationRequest={() => true}
      accessibilityLabel={`${asset.symbol} ${external?.moving ? 'moving simulated' : sample ? 'sample' : 'historical'} ${mode.toLowerCase()} chart. Touch to inspect; use controls below to zoom and pan.`}
    >
      {loading ? <View style={{ flex: 1, justifyContent: 'center' }}><ContentState kind="skeleton" tone={tone} title="Loading chart" /></View>
        : error ? <View style={{ flex: 1, justifyContent: 'center' }}><ContentState kind="error" tone={tone} title="Chart unavailable" detail={error} onRetry={reload} /></View>
          : !data.length ? <View style={{ flex: 1, justifyContent: 'center' }}><ContentState kind="empty" tone={tone} title="No chart data" detail={sample ? 'There are no sample candles for this asset and timeframe.' : 'Candles will appear when the market feed is connected.'} /></View>
            : <Svg width="100%" height={h} viewBox={`0 0 ${width} ${h}`}>
              <Defs><LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={terminal ? lineColor : '#80B8EC'} stopOpacity={terminal ? 0.24 : 0.55} /><Stop offset="1" stopColor={terminal ? lineColor : '#D8EBFA'} stopOpacity={terminal ? 0 : 0.06} /></LinearGradient></Defs>
              {[0, 0.25, 0.5, 0.75, 1].map(fraction => <Line key={fraction} x1={plotW * fraction} x2={plotW * fraction} y1={plotTop} y2={plotBottom} stroke={gridColor} strokeWidth={terminal ? 0.5 : 0.7} />)}
              {Array.from({ length: 5 }, (_, index) => {
                const value = low + (high - low) * index / 4;
                return <React.Fragment key={index}><Line x1={0} x2={plotW} y1={y(value)} y2={y(value)} stroke={gridColor} strokeWidth={terminal ? 0.6 : 1} /><SvgText x={plotW + 8} y={y(value) + 3} fill={axisColor} fontSize={9} fontFamily={fonts.medium}>{value.toFixed(asset.precision)}</SvgText></React.Fragment>;
              })}
              {offset === 0 && keyLevels.filter(level => level.price >= low && level.price <= high).map(level => <React.Fragment key={level.label}>
                <Line x1={0} x2={plotW} y1={y(level.price)} y2={y(level.price)} stroke={level.color} strokeOpacity={0.6} strokeDasharray={level.label.startsWith('Prior') ? '2 6' : '6 5'} strokeWidth={0.8} />
                {!level.label.startsWith('Prior') && <SvgText x={7} y={Math.max(plotTop + 8, y(level.price) - 4)} fill={level.color} fontSize={8} fontFamily={fonts.medium}>{level.label.split(' · ')[0].toUpperCase()}</SvgText>}
              </React.Fragment>)}
              {(mode === 'Line' || small) && referenceUI && data.length > 0 && <Path d={`${path} L${x(data.length - 1)},${plotBottom} L${x(0)},${plotBottom} Z`} fill={`url(#${gradientId})`} />}
              {terminal && (mode === 'Line' || small) && <Path d={path} stroke={lineColor} strokeOpacity={0.13} strokeWidth={8} fill="none" strokeLinejoin="round" strokeLinecap="round" />}
              {mode === 'Line' || small ? <Path d={path} stroke={lineColor} strokeWidth={terminal ? 2.4 : 1.8} fill="none" strokeLinejoin="round" strokeLinecap="round" /> : data.map((candle, index) => {
                const up = candle.close >= candle.open;
                const color = terminal ? up ? '#6EE7BE' : '#FF8993' : up ? colors.up : colors.down;
                return <React.Fragment key={candle.time}><Line x1={x(index)} x2={x(index)} y1={y(candle.high)} y2={y(candle.low)} stroke={color} strokeWidth={1.2} /><Rect x={x(index) - candleWidth / 2} y={Math.min(y(candle.open), y(candle.close))} width={candleWidth} height={Math.max(1.5, Math.abs(y(candle.close) - y(candle.open)))} fill={color} rx={1} /></React.Fragment>;
              })}
              {average && averagePath && <Path d={averagePath} stroke="#EFAD43" strokeWidth={2} fill="none" />}
              {last && <><Line x1={0} x2={plotW + 2} y1={y(last.close)} y2={y(last.close)} stroke={priceColor} strokeOpacity={terminal ? 0.45 : 1} strokeDasharray="4 4" strokeWidth={1} /><Rect x={plotW + 2} y={lastY - 12} width={axisWidth - 2} height={24} rx={terminal ? 8 : 5} fill={priceColor} /><SvgText x={plotW + axisWidth / 2 + 1} y={lastY + 3.5} fill={terminal ? '#101811' : colors.onPrimary} fontSize={9} fontFamily={fonts.bold} textAnchor="middle">{last.close.toFixed(asset.precision)}</SvgText>{terminal && (mode === 'Line' || small) && <><Circle cx={x(data.length - 1)} cy={y(last.close)} r={8} fill={lineColor} fillOpacity={0.13} /><Circle cx={x(data.length - 1)} cy={y(last.close)} r={3.5} fill={lineColor} stroke="#151B18" strokeWidth={1.5} /></>}</>}
              {selected && selectedIndex !== null && <><Line x1={x(selectedIndex)} x2={x(selectedIndex)} y1={plotTop} y2={plotBottom} stroke={colors.sub} strokeDasharray="4 4" /><Line x1={0} x2={plotW} y1={y(selected.close)} y2={y(selected.close)} stroke={colors.sub} strokeDasharray="4 4" /><Circle cx={x(selectedIndex)} cy={y(selected.close)} r={3} fill={colors.text} /></>}
              {[0, 0.5, 1].map((fraction, index) => {
                const candleIndex = Math.floor((data.length - 1) * fraction);
                return <SvgText key={index} x={x(candleIndex)} y={h - 8} fill={axisColor} fontSize={9} fontFamily={fonts.medium} textAnchor={index === 0 ? 'start' : index === 2 ? 'end' : 'middle'}>{new Date(data[candleIndex].time).toISOString().slice(frame === '1D' ? 5 : 11, frame === '1D' ? 10 : 16)}</SvgText>;
              })}
            </Svg>}
    </View>
    {referenceUI && <>
      <Sheet visible={framesOpen} title="Chart timeframe" onClose={() => setFramesOpen(false)}>{['1m', '5m', '15m', '1h', '4h', '1D'].map(value => <AppButton key={value} label={value} variant={frame === value ? 'primary' : 'secondary'} onPress={() => { if (value !== frame) { setLoading(true); setFrame(value); } setFramesOpen(false); }} />)}</Sheet>
      <Sheet visible={controlsOpen} title="Chart tools" onClose={() => setControlsOpen(false)}><AppButton label={average ? 'Hide 7-period moving average' : 'Show 7-period moving average'} variant="secondary" onPress={() => setAverage(value => !value)} /><Label muted size={12}>The moving average smooths historical {sample ? 'sample ' : ''}closing prices. It is not a forecast.</Label>{keyLevels.length > 0 && <><Label bold>Reference levels · {frame}</Label>{keyLevels.map(level => <Row key={level.label}><Label size={12}>{level.label}</Label><Label bold size={12}>{level.price.toFixed(asset.precision)}</Label></Row>)}<Label muted size={11}>Support and resistance use the previous 20 completed bars. The pivot uses the previous bar. Levels exclude the forming candle and are practice references.</Label></>}<ChartTools mode={mode} onModeChange={() => setMode(mode === 'Candles' ? 'Line' : 'Candles')} tools={tools} width={width} /><HistoricalCaption candles={candles} sample={sample} moving={external?.moving} /></Sheet>
    </>}
    {!small && !referenceUI && <>
      <Row style={{ gap: 8 }}>
        <View style={{ flex: 1 }}><SegmentedControl options={['5m', '15m', '1h', '4h', '1D']} value={frame} tone={tone} onChange={value => { if (value === frame) return; setLoading(true); setError(''); setFrame(value); }} /></View>
        {compactControls && <Pressable accessibilityRole="button" accessibilityLabel="Chart controls" onPress={() => setControlsOpen(true)} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 })}><Ionicons name="options-outline" size={20} color={colors.text} /></Pressable>}
      </Row>
      {compactControls ? <Sheet visible={controlsOpen} title="Chart controls" onClose={() => setControlsOpen(false)}><ChartTools mode={mode} onModeChange={() => setMode(mode === 'Candles' ? 'Line' : 'Candles')} tools={tools} width={width} /><HistoricalCaption /></Sheet> : <><ChartTools mode={mode} onModeChange={() => setMode(mode === 'Candles' ? 'Line' : 'Candles')} tools={tools} width={width} /><HistoricalCaption /></>}
    </>}
  </View>;
}


type ChartTool = { label: string; icon: keyof typeof Ionicons.glyphMap; disabled: boolean; onPress: () => void };
function ChartTools({ mode, onModeChange, tools, width }: { mode: string; onModeChange: () => void; tools: ChartTool[]; width: number }) {
  const { colors } = useTheme();
  return <Row style={{ flexWrap: 'wrap', gap: 8 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Switch to ${mode === 'Candles' ? 'line' : 'candlestick'} chart`} onPress={onModeChange} style={({ pressed }) => ({ minHeight: 44, minWidth: 44, paddingHorizontal: 8, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}><Ionicons name={mode === 'Candles' ? 'stats-chart-outline' : 'pulse-outline'} color={colors.sub} size={16} />{width >= 270 && <Label size={10} muted>{mode}</Label>}</Pressable>
    <Row style={{ gap: 0 }}>{tools.map(tool => <Pressable key={tool.label} accessibilityRole="button" accessibilityLabel={tool.label} accessibilityState={{ disabled: tool.disabled }} disabled={tool.disabled} onPress={tool.onPress} style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: tool.disabled ? 0.3 : pressed ? 0.6 : 1 })}><Ionicons name={tool.icon} size={17} color={colors.text} /></Pressable>)}</Row>
  </Row>;
}
function HistoricalCaption({ candles, sample = true, moving = false }: { candles?: Candle[]; sample?: boolean; moving?: boolean }) {
  const last = candles?.[candles.length - 1];
  return <Row style={{ flexWrap: 'wrap' }}><Label muted size={9}>{moving ? 'Simulated history + forming bar · no live feed' : `Candle close · historical ${sample ? 'sample ' : ''}series`}</Label><Label muted size={9}>{last ? new Date(last.time).toISOString().slice(0, 10) : '30 OCT 2026'} · UTC</Label></Row>;
}
