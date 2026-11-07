import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { Asset, Candle, marketData } from '../lib/market';
import { useTheme } from '../lib/theme';
import { useReducedMotion } from '../lib/useReducedMotion';
import { ContentState } from './ContentState';
import { ChartReadout, InteractiveChartPlot } from './InteractiveChartPlot';
import { useChartController } from './useChartController';
import { useChartGestures } from './useChartGestures';
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
  const [demoError, setError] = useState('');
  const [demoLoading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [width, setWidth] = useState(320);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [framesOpen, setFramesOpen] = useState(false);
  const [average, setAverage] = useState(false);
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
      }
    }).catch(() => {
      if (active) {
        setError('Chart unavailable. Try loading the simulated series again.');
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [asset, frame, retry, externalMode]);

  const h = Math.max(180, plotHeight ?? (small ? 180 : 300));
  const axisWidth = Math.max(72, asset.price.toFixed(asset.precision).length * 7 + 16);
  const plotW = Math.max(80, width - axisWidth);
  const controller = useChartController({ candles, identity: `${asset.symbol}:${frame}`, initialCount: referenceUI ? 80 : 36 });
  const focused = useIsFocused();
  const reducedMotion = useReducedMotion();
  const { gesture, cancelInteractions } = useChartGestures({
    viewport: controller.viewport, candles: controller.candles, crosshair: controller.crosshair,
    interacting: controller.interacting, plotWidth: Math.max(1, plotW - 16), left: 8,
    enabled: focused && !loading && !error && candles.length > 0,
    reducedMotion: reducedMotion !== false,
  });
  useEffect(() => { cancelInteractions(); }, [asset.symbol, frame, cancelInteractions]);
  const act = (action: () => void) => { cancelInteractions(); action(); };
  const reload = () => { if (external) external.onRetry(); else { setLoading(true); setError(''); setRetry(value => value + 1); } };
  const tools: { label: string; icon: keyof typeof Ionicons.glyphMap; disabled: boolean; onPress: () => void }[] = [
    { label: 'Pan to earlier candles', icon: 'chevron-back', disabled: loading || !controller.controls.canEarlier, onPress: () => act(controller.panEarlier) },
    { label: 'Zoom out', icon: 'remove', disabled: loading || !controller.controls.canZoomOut, onPress: () => act(controller.zoomOut) },
    { label: 'Zoom in', icon: 'add', disabled: loading || !controller.controls.canZoomIn, onPress: () => act(controller.zoomIn) },
    { label: 'Pan to later candles', icon: 'chevron-forward', disabled: loading || !controller.controls.canLater, onPress: () => act(controller.panLater) },
    { label: 'Reset chart view', icon: 'refresh', disabled: loading || !candles.length, onPress: () => act(controller.reset) },
  ];

  return <View style={{ gap: 8 }}>
    {referenceUI && <Row style={{ justifyContent: terminal ? 'space-between' : 'flex-end', gap: terminal ? 6 : 10, flexWrap: 'wrap' }}>
      {terminal && <Label bold size={9} color="#A0AAA2" style={{ letterSpacing: 1.3 }}>PRICE ACTION</Label>}
      <Row style={{ gap: terminal ? 6 : 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Change chart timeframe" onPress={() => act(() => setFramesOpen(true))} style={({ pressed }) => ({ minHeight: terminal ? 44 : 42, paddingHorizontal: terminal ? 11 : 14, borderRadius: 14, borderWidth: terminal ? 1 : 0, borderColor: gridColor, backgroundColor: controlSurface, flexDirection: 'row', gap: 8, alignItems: 'center', opacity: pressed ? 0.6 : 1 })}><Label bold size={12} color={controlColor}>{frame}</Label><Ionicons name="chevron-down" size={12} color={controlColor} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Switch to ${mode === 'Line' ? 'candlestick' : 'line'} chart`} onPress={() => act(() => setMode(value => value === 'Line' ? 'Candles' : 'Line'))} style={({ pressed }) => ({ minHeight: terminal ? 44 : 42, width: 44, borderRadius: 14, borderWidth: terminal ? 1 : 0, borderColor: gridColor, backgroundColor: controlSurface, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}><Ionicons name={mode === 'Line' ? 'stats-chart-outline' : 'pulse-outline'} size={21} color={controlColor} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Chart indicators and controls" onPress={() => act(() => setControlsOpen(true))} style={({ pressed }) => ({ minHeight: terminal ? 44 : 42, width: 44, borderRadius: 14, borderWidth: terminal ? 1 : 0, borderColor: gridColor, backgroundColor: controlSurface, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}><Ionicons name="color-wand-outline" size={21} color={average ? terminal ? lineColor : colors.primary : controlColor} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Reset chart view" disabled={loading || !candles.length} accessibilityState={{ disabled: loading || !candles.length }} onPress={() => act(controller.reset)} style={({ pressed }) => ({ minHeight: 44, width: 44, borderRadius: 14, borderWidth: terminal ? 1 : 0, borderColor: gridColor, backgroundColor: controlSurface, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}><Ionicons name="refresh" size={19} color={controlColor} /></Pressable>
      </Row>
    </Row>}
    {!small && (!referenceUI || external) && <ChartReadout prepared={controller.prepared} viewport={controller.viewport} crosshair={controller.crosshair} plotW={plotW} precision={asset.precision} frame={frame} axisColor={axisColor} up={colors.up} down={colors.down} muted={colors.sub} />}
    <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ height: h }}
      accessibilityLabel={`${asset.symbol} ${external?.moving ? 'moving simulated' : sample ? 'sample' : 'historical'} ${mode.toLowerCase()} chart. Pinch to zoom, drag sideways to pan, double tap to zoom, and hold to inspect. Chart tools include zoom, pan and reset buttons.`}>
      {loading ? <View style={{ flex: 1, justifyContent: 'center' }}><ContentState kind="skeleton" tone={tone} title="Loading chart" /></View>
        : error ? <View style={{ flex: 1, justifyContent: 'center' }}><ContentState kind="error" tone={tone} title="Chart unavailable" detail={error} onRetry={reload} /></View>
          : !candles.length ? <View style={{ flex: 1, justifyContent: 'center' }}><ContentState kind="empty" tone={tone} title="No chart data" detail={sample ? 'There are no sample candles for this asset and timeframe.' : 'Candles will appear when the market feed is connected.'} /></View>
            : <InteractiveChartPlot prepared={controller.prepared} viewport={controller.viewport} crosshair={controller.crosshair} gesture={gesture}
              width={width} height={h} plotW={plotW} precision={asset.precision} frame={frame} mode={small ? 'Line' : mode} average={average} terminal={terminal} area={referenceUI} levels={keyLevels}
              paint={{ line: lineColor, price: priceColor, onPrice: terminal ? '#101811' : colors.onPrimary, grid: gridColor, axis: axisColor, text: colors.text, up: terminal ? '#6EE7BE' : colors.up, down: terminal ? '#FF8993' : colors.down }} />}
    </View>
    {referenceUI && <>
      <Sheet visible={framesOpen} title="Chart timeframe" onClose={() => setFramesOpen(false)}>{['1m', '5m', '15m', '1h', '4h', '1D'].map(value => <AppButton key={value} label={value} variant={frame === value ? 'primary' : 'secondary'} onPress={() => { if (value !== frame) { setLoading(true); setFrame(value); } setFramesOpen(false); }} />)}</Sheet>
      <Sheet visible={controlsOpen} title="Chart tools" onClose={() => setControlsOpen(false)}><AppButton label={average ? 'Hide 7-period moving average' : 'Show 7-period moving average'} variant="secondary" onPress={() => act(() => setAverage(value => !value))} /><Label muted size={12}>The moving average smooths historical {sample ? 'sample ' : ''}closing prices. It is not a forecast.</Label>{keyLevels.length > 0 && <><Label bold>Reference levels · {frame}</Label>{keyLevels.map(level => <Row key={level.label}><Label size={12}>{level.label}</Label><Label bold size={12}>{level.price.toFixed(asset.precision)}</Label></Row>)}<Label muted size={11}>Support and resistance use the previous 20 completed bars. The pivot uses the previous bar. Levels exclude the forming candle and are practice references.</Label></>}<ChartTools mode={mode} onModeChange={() => act(() => setMode(mode === 'Candles' ? 'Line' : 'Candles'))} tools={tools} width={width} /><HistoricalCaption candles={candles} sample={sample} moving={external?.moving} /></Sheet>
    </>}
    {!small && !referenceUI && <>
      <Row style={{ gap: 8 }}>
        <View style={{ flex: 1 }}><SegmentedControl options={['5m', '15m', '1h', '4h', '1D']} value={frame} tone={tone} onChange={value => { if (value === frame) return; setLoading(true); setError(''); setFrame(value); }} /></View>
        {compactControls && <Pressable accessibilityRole="button" accessibilityLabel="Chart controls" onPress={() => act(() => setControlsOpen(true))} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, opacity: pressed ? 0.6 : 1 })}><Ionicons name="options-outline" size={20} color={colors.text} /></Pressable>}
      </Row>
      {compactControls ? <Sheet visible={controlsOpen} title="Chart controls" onClose={() => setControlsOpen(false)}><ChartTools mode={mode} onModeChange={() => act(() => setMode(mode === 'Candles' ? 'Line' : 'Candles'))} tools={tools} width={width} /><HistoricalCaption /></Sheet> : <><ChartTools mode={mode} onModeChange={() => act(() => setMode(mode === 'Candles' ? 'Line' : 'Candles'))} tools={tools} width={width} /><HistoricalCaption /></>}
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
  return <Row style={{ flexWrap: 'wrap' }}><Label muted size={9}>{moving ? 'Simulated history + forming bar · no live feed' : `Candle close · historical ${sample ? 'sample ' : ''}series`}</Label><Label muted size={9}>{last ? new Date(last.time).toISOString().slice(0, 10) : 'No candle date'} · UTC</Label></Row>;
}
