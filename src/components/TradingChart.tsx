import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { Asset, Candle, marketData } from '../lib/market';
import { fonts, useTheme } from '../lib/theme';
import { ContentState } from './ContentState';
import { Label, Row, Sheet } from './design';
import { SegmentedControl } from './SegmentedControl';

export function TradingChart({ asset, small = false, plotHeight, compactControls = false }: {
  asset: Asset; small?: boolean; plotHeight?: number; compactControls?: boolean;
}) {
  const { colors } = useTheme();
  const tone = colors.bg === colors.sheet ? 'light' : 'dark';
  const [candles, setCandles] = useState<Candle[]>([]);
  const [frame, setFrame] = useState('1h');
  const [mode, setMode] = useState('Candles');
  const [zoom, setZoom] = useState(36);
  const [offset, setOffset] = useState(0);
  const [cross, setCross] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [width, setWidth] = useState(320);
  const [controlsOpen, setControlsOpen] = useState(false);

  useEffect(() => {
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
  }, [asset, frame, retry]);

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
  const selectedIndex = cross === null ? null : Math.min(data.length - 1, Math.max(0, Math.round((cross - 8) / Math.max(1, plotW - 16) * (data.length - 1))));
  const selected = selectedIndex === null ? undefined : data[selectedIndex];
  const last = data[data.length - 1];
  const inspected = selected || last;
  const lastY = last ? Math.max(plotTop + 12, Math.min(plotBottom - 12, y(last.close))) : 0;
  const maxOffset = Math.max(0, candles.length - zoom);
  const reload = () => { setLoading(true); setError(''); setRetry(value => value + 1); };
  const tools: { label: string; icon: keyof typeof Ionicons.glyphMap; disabled: boolean; onPress: () => void }[] = [
    { label: 'Pan to earlier candles', icon: 'chevron-back', disabled: loading || offset >= maxOffset, onPress: () => { setOffset(Math.min(maxOffset, offset + 8)); setCross(null); } },
    { label: 'Zoom out', icon: 'remove', disabled: loading || zoom >= 100, onPress: () => { setZoom(Math.min(100, zoom + 12)); setOffset(0); setCross(null); } },
    { label: 'Zoom in', icon: 'add', disabled: loading || zoom <= 24, onPress: () => { setZoom(Math.max(24, zoom - 12)); setOffset(0); setCross(null); } },
    { label: 'Pan to later candles', icon: 'chevron-forward', disabled: loading || !offset, onPress: () => { setOffset(Math.max(0, offset - 8)); setCross(null); } },
  ];

  return <View style={{ gap: 8 }}>
    {!small && <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 4, minHeight: width < 300 ? 36 : 20 }}>
      {(['open', 'high', 'low', 'close'] as const).map((key, index) => <View key={key} style={{ flex: 1, flexBasis: width < 300 ? '44%' : '20%', flexDirection: 'row', gap: 4, alignItems: 'center' }}>
        <Label muted size={9}>{['O', 'H', 'L', 'C'][index]}</Label>
        <Label size={9} color={key === 'close' && inspected ? inspected.close >= inspected.open ? colors.up : colors.down : colors.sub}>{!loading && !error && inspected ? `${key === 'close' ? inspected.close >= inspected.open ? '↗ ' : '↘ ' : ''}${inspected[key].toFixed(asset.precision)}` : '—'}</Label>
      </View>)}
    </View>}
    <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ height: h }}
      onStartShouldSetResponder={() => !loading && !error && !!data.length}
      onMoveShouldSetResponder={() => !loading && !error && !!data.length}
      onResponderGrant={event => setCross(Math.max(0, Math.min(plotW, event.nativeEvent.locationX)))}
      onResponderMove={event => setCross(Math.max(0, Math.min(plotW, event.nativeEvent.locationX)))}
      onResponderTerminationRequest={() => true}
      accessibilityLabel={`${asset.symbol} simulated ${mode.toLowerCase()} chart. Touch to inspect; use controls below to zoom and pan.`}
    >
      {loading ? <View style={{ flex: 1, justifyContent: 'center' }}><ContentState kind="skeleton" tone={tone} title="Loading chart" /></View>
        : error ? <View style={{ flex: 1, justifyContent: 'center' }}><ContentState kind="error" tone={tone} title="Chart unavailable" detail={error} onRetry={reload} /></View>
          : !data.length ? <View style={{ flex: 1, justifyContent: 'center' }}><ContentState kind="empty" tone={tone} title="No chart data" detail="There are no simulated candles for this asset and timeframe." /></View>
            : <Svg width="100%" height={h} viewBox={`0 0 ${width} ${h}`}>
              {Array.from({ length: 5 }, (_, index) => {
                const value = low + (high - low) * index / 4;
                return <React.Fragment key={index}><Line x1={0} x2={plotW} y1={y(value)} y2={y(value)} stroke={colors.border} strokeWidth={1} /><SvgText x={plotW + 8} y={y(value) + 3} fill={colors.sub} fontSize={9} fontFamily={fonts.medium}>{value.toFixed(asset.precision)}</SvgText></React.Fragment>;
              })}
              {mode === 'Line' || small ? <Path d={path} stroke={colors.text} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" /> : data.map((candle, index) => {
                const up = candle.close >= candle.open;
                const color = up ? colors.up : colors.down;
                return <React.Fragment key={candle.time}><Line x1={x(index)} x2={x(index)} y1={y(candle.high)} y2={y(candle.low)} stroke={color} strokeWidth={1.2} /><Rect x={x(index) - candleWidth / 2} y={Math.min(y(candle.open), y(candle.close))} width={candleWidth} height={Math.max(1.5, Math.abs(y(candle.close) - y(candle.open)))} fill={color} rx={1} /></React.Fragment>;
              })}
              {last && <><Line x1={0} x2={plotW + 2} y1={y(last.close)} y2={y(last.close)} stroke={colors.primary} strokeDasharray="4 4" strokeWidth={1} /><Rect x={plotW + 2} y={lastY - 12} width={axisWidth - 2} height={24} rx={5} fill={colors.primary} /><SvgText x={plotW + axisWidth / 2 + 1} y={lastY + 3.5} fill={colors.onPrimary} fontSize={9} fontFamily={fonts.bold} textAnchor="middle">{last.close.toFixed(asset.precision)}</SvgText></>}
              {selected && selectedIndex !== null && <><Line x1={x(selectedIndex)} x2={x(selectedIndex)} y1={plotTop} y2={plotBottom} stroke={colors.sub} strokeDasharray="4 4" /><Line x1={0} x2={plotW} y1={y(selected.close)} y2={y(selected.close)} stroke={colors.sub} strokeDasharray="4 4" /><Circle cx={x(selectedIndex)} cy={y(selected.close)} r={3} fill={colors.text} /></>}
              {[0, 0.5, 1].map((fraction, index) => {
                const candleIndex = Math.floor((data.length - 1) * fraction);
                return <SvgText key={index} x={x(candleIndex)} y={h - 8} fill={colors.sub} fontSize={9} fontFamily={fonts.medium} textAnchor={index === 0 ? 'start' : index === 2 ? 'end' : 'middle'}>{new Date(data[candleIndex].time).toISOString().slice(frame === '1D' ? 5 : 11, frame === '1D' ? 10 : 16)}</SvgText>;
              })}
            </Svg>}
    </View>
    {!small && <>
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
function HistoricalCaption() {
  return <Row style={{ flexWrap: 'wrap' }}><Label muted size={9}>Candle close · historical simulated series</Label><Label muted size={9}>30 OCT 2026 · UTC</Label></Row>;
}
