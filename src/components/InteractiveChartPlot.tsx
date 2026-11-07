import React, { memo, useEffect, useId, useState } from 'react';
import { View } from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, ReduceMotion, useAnimatedProps, useAnimatedReaction, useDerivedValue, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Circle, ClipPath, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { buildChartGeometry, clampViewport, type ChartViewport, type PreparedChartData } from '../lib/chartViewport';
import { fonts } from '../lib/theme';
import { Label } from './design';
import type { useChartGestures } from './useChartGestures';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
type Crosshair = { active: boolean; x: number; y: number };
type Geometry = ReturnType<typeof buildChartGeometry>;
type Values = {
  prepared: SharedValue<PreparedChartData>;
  viewport: SharedValue<ChartViewport>;
  crosshair: SharedValue<Crosshair>;
};
type Paint = { line: string; price: string; onPrice: string; grid: string; axis: string; up: string; down: string; text: string };
type Layout = { width: number; height: number; plotW: number; precision: number };
export type ChartPlotLevel = { label: string; price: number; color: string };

/** A bounded number of SVG nodes; gesture updates only their native animated props. */
export const InteractiveChartPlot = memo(function InteractiveChartPlot({ prepared, viewport, crosshair, gesture, width, height, plotW, precision, frame, mode, average, terminal, area, paint, levels }: Values & Layout & {
  gesture: ReturnType<typeof useChartGestures>['gesture'];
  frame: string; mode: string; average: boolean; terminal: boolean; area: boolean; paint: Paint; levels: ChartPlotLevel[];
}) {
  const id = useId().replace(/:/g, '');
  const top = 16;
  const bottom = height - 32;
  const layout = { left: 8, top, width: Math.max(1, plotW - 16), height: bottom - top, precision };
  const geometry = useDerivedValue(() => buildChartGeometry(prepared.value, viewport.value, layout, average, Math.max(16, Math.min(180, Math.floor(plotW / 1.5)))));
  const lineProps = useAnimatedProps(() => ({ d: geometry.value.linePath }));
  const areaProps = useAnimatedProps(() => ({ d: geometry.value.areaPath }));
  const averageProps = useAnimatedProps(() => ({ d: geometry.value.averagePath }));
  const upProps = useAnimatedProps(() => ({ d: geometry.value.upBodyPath, strokeWidth: Math.min(0.8, geometry.value.spacing * 0.15) }));
  const downProps = useAnimatedProps(() => ({ d: geometry.value.downBodyPath, strokeWidth: Math.min(0.8, geometry.value.spacing * 0.15) }));
  const upWickProps = useAnimatedProps(() => ({ d: geometry.value.upWickPath, strokeWidth: Math.min(1, geometry.value.spacing * 0.3) }));
  const downWickProps = useAnimatedProps(() => ({ d: geometry.value.downWickPath, strokeWidth: Math.min(1, geometry.value.spacing * 0.3) }));
  const priceLineProps = useAnimatedProps(() => ({ y1: geometry.value.lastY, y2: geometry.value.lastY, opacity: geometry.value.renderedBars ? 0.6 : 0 }));
  const crossXProps = useAnimatedProps(() => {
    const view = clampViewport(viewport.value, prepared.value.candles.length);
    const index = Math.max(Math.ceil(view.start), Math.min(Math.floor(view.start + view.count - 1), Math.round(view.start + Math.max(0, Math.min(1, (crosshair.value.x - 8) / Math.max(1, plotW - 16))) * Math.max(0, view.count - 1))));
    const x = 8 + (index - view.start) / Math.max(1, view.count - 1) * (plotW - 16);
    return { x1: x, x2: x, opacity: crosshair.value.active ? 1 : 0 };
  });
  const crossYProps = useAnimatedProps(() => {
    const y = Math.max(top, Math.min(bottom, crosshair.value.y));
    return { y1: y, y2: y, opacity: crosshair.value.active ? 1 : 0 };
  });
  const dotProps = useAnimatedProps(() => ({ cx: geometry.value.lastX, cy: geometry.value.lastY, opacity: geometry.value.renderedBars && mode === 'Line' ? 1 : 0 }));

  return <GestureHandlerRootView unstable_forceActive style={{ height, width: '100%' }}>
    <GestureDetector gesture={gesture} touchAction="none">
      <View collapsable={false} style={{ height }}>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <Defs>
            <ClipPath id={`plot-${id}`}><Rect x={0} y={top} width={plotW} height={bottom - top} /></ClipPath>
            <LinearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={paint.line} stopOpacity={terminal ? 0.24 : 0.55} /><Stop offset="1" stopColor={paint.line} stopOpacity={0} /></LinearGradient>
          </Defs>
          {[0, 0.25, 0.5, 0.75, 1].map(fraction => <React.Fragment key={fraction}>
            <Line x1={plotW * fraction} x2={plotW * fraction} y1={top} y2={bottom} stroke={paint.grid} strokeWidth={0.6} />
            <Line x1={0} x2={plotW} y1={top + fraction * (bottom - top)} y2={top + fraction * (bottom - top)} stroke={paint.grid} strokeWidth={0.6} />
          </React.Fragment>)}
          <G clipPath={`url(#plot-${id})`}>
            {levels.map(level => <ReferenceLevel key={level.label} level={level} geometry={geometry} viewport={viewport} prepared={prepared} plotW={plotW} top={top} bottom={bottom} />)}
            {mode === 'Line' ? <>
              {area && <AnimatedPath animatedProps={areaProps} fill={`url(#fill-${id})`} />}
              {terminal && <AnimatedPath animatedProps={lineProps} stroke={paint.line} strokeOpacity={0.13} strokeWidth={8} fill="none" />}
              <AnimatedPath animatedProps={lineProps} stroke={paint.line} strokeWidth={terminal ? 2.4 : 1.8} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            </> : <>
              <AnimatedPath animatedProps={upWickProps} stroke={paint.up} strokeWidth={1} fill="none" />
              <AnimatedPath animatedProps={downWickProps} stroke={paint.down} strokeWidth={1} fill="none" />
              <AnimatedPath animatedProps={upProps} stroke={paint.up} strokeWidth={0.8} fill="none" />
              <AnimatedPath animatedProps={downProps} stroke={paint.down} strokeWidth={0.8} fill={paint.down} />
            </>}
            {average && <AnimatedPath animatedProps={averageProps} stroke="#EFAD43" strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />}
            <AnimatedLine animatedProps={priceLineProps} x1={0} x2={plotW} stroke={paint.price} strokeDasharray="4 4" strokeWidth={1} />
            <AnimatedCircle animatedProps={dotProps} r={3.5} fill={paint.line} />
            <AnimatedLine animatedProps={crossXProps} y1={top} y2={bottom} stroke={paint.axis} strokeDasharray="4 4" />
            <AnimatedLine animatedProps={crossYProps} x1={0} x2={plotW} stroke={paint.axis} strokeDasharray="4 4" />
          </G>
          <ChartAxes prepared={prepared} viewport={viewport} crosshair={crosshair} geometry={geometry} width={width} height={height} plotW={plotW} precision={precision} frame={frame} paint={paint} levels={levels} clipId={`plot-${id}`} />
        </Svg>
      </View>
    </GestureDetector>
  </GestureHandlerRootView>;
});

function ReferenceLevel({ level, geometry, viewport, prepared, plotW, top, bottom }: { level: ChartPlotLevel; geometry: SharedValue<Geometry>; viewport: SharedValue<ChartViewport>; prepared: SharedValue<PreparedChartData>; plotW: number; top: number; bottom: number }) {
  const props = useAnimatedProps(() => {
    const g = geometry.value;
    const y = top + (g.high - level.price) / Math.max(Number.EPSILON, g.high - g.low) * (bottom - top);
    const view = viewport.value;
    const latest = view.start + view.count >= prepared.value.candles.length - 0.25;
    return { y1: y, y2: y, opacity: latest && level.price >= g.low && level.price <= g.high ? 0.6 : 0 };
  });
  return <AnimatedLine animatedProps={props} x1={0} x2={plotW} stroke={level.color} strokeDasharray={level.label.startsWith('Prior') ? '2 6' : '6 5'} strokeWidth={0.8} />;
}

type Snapshot = { low: number; high: number; startTime: number; midTime: number; endTime: number; close: number; lastY: number; active: boolean; cursorPrice: number; cursorY: number; latest: boolean };
function ChartAxes({ prepared, viewport, crosshair, geometry, width, height, plotW, precision, frame, paint, levels, clipId }: Values & Layout & { geometry: SharedValue<Geometry>; frame: string; paint: Paint; levels: ChartPlotLevel[]; clipId: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const lastSent = useSharedValue(0);
  const trailing = useSharedValue(0);
  useEffect(() => () => cancelAnimation(trailing), [trailing]);
  useAnimatedReaction(() => {
    const g = geometry.value;
    const view = clampViewport(viewport.value, prepared.value.candles.length);
    const candles = prepared.value.candles;
    const index = (fraction: number) => Math.max(0, Math.min(candles.length - 1, Math.round(view.start + fraction * Math.max(0, view.count - 1))));
    const cursorY = Math.max(16, Math.min(height - 32, crosshair.value.y));
    return { low: g.low, high: g.high, startTime: candles[index(0)]?.time ?? 0, midTime: candles[index(0.5)]?.time ?? 0, endTime: candles[index(1)]?.time ?? 0,
      close: candles[g.lastIndex]?.close ?? 0, lastY: g.lastY, active: crosshair.value.active, cursorY, latest: view.start + view.count >= candles.length - 0.25,
      cursorPrice: g.high - (cursorY - 16) / Math.max(1, height - 48) * (g.high - g.low) };
  }, (next, previous) => {
    // Only text is sent to React at a bounded rate; plot geometry never crosses
    // back to JS during a gesture. Native paths keep updating on the UI thread.
    const now = Date.now();
    if (!previous || next.active !== previous.active || now - lastSent.value >= 80) { lastSent.value = now; scheduleOnRN(setSnapshot, next); }
    // A paused/static chart still gets its final exact labels after motion ends.
    cancelAnimation(trailing);
    trailing.set(0);
    trailing.set(withDelay(90, withTiming(1, { duration: 0 }, finished => { if (finished) scheduleOnRN(setSnapshot, next); }), ReduceMotion.Never));
  });
  if (!snapshot) return null;
  const top = 16;
  const bottom = height - 32;
  const markerY = Math.max(top + 12, Math.min(bottom - 12, snapshot.active ? snapshot.cursorY : snapshot.lastY));
  const time = (value: number) => Number.isFinite(value) ? new Date(value).toISOString().slice(frame === '1D' ? 5 : 11, frame === '1D' ? 10 : 16) : '—';
  return <>
    {snapshot.latest && <G clipPath={`url(#${clipId})`}>{levels.filter(level => !level.label.startsWith('Prior') && level.price >= snapshot.low && level.price <= snapshot.high).map(level => <SvgText key={level.label} x={7} y={Math.max(top + 8, top + (snapshot.high - level.price) / Math.max(Number.EPSILON, snapshot.high - snapshot.low) * (bottom - top) - 4)} fill={level.color} fontSize={8} fontFamily={fonts.medium}>{level.label.split(' · ')[0].toUpperCase()}</SvgText>)}</G>}
    {[0, 0.25, 0.5, 0.75, 1].map(fraction => <SvgText key={fraction} x={plotW + 8} y={top + fraction * (bottom - top) + 3} fill={paint.axis} fontSize={9} fontFamily={fonts.medium}>{(snapshot.high - fraction * (snapshot.high - snapshot.low)).toFixed(precision)}</SvgText>)}
    {[snapshot.startTime, snapshot.midTime, snapshot.endTime].map((value, index) => <SvgText key={index} x={8 + index / 2 * (plotW - 16)} y={height - 8} fill={paint.axis} fontSize={9} fontFamily={fonts.medium} textAnchor={index === 0 ? 'start' : index === 2 ? 'end' : 'middle'}>{time(value)}</SvgText>)}
    <Rect x={plotW + 2} y={markerY - 12} width={width - plotW - 2} height={24} rx={5} fill={paint.price} />
    <SvgText x={plotW + (width - plotW) / 2} y={markerY + 3.5} fill={paint.onPrice} fontSize={9} fontFamily={fonts.bold} textAnchor="middle">{(snapshot.active ? snapshot.cursorPrice : snapshot.close).toFixed(precision)}</SvgText>
  </>;
}

/** Independent text updates keep React OHLC rendering out of the gesture path. */
export function ChartReadout({ prepared, viewport, crosshair, plotW, precision, frame, axisColor, up, down, muted }: Values & { plotW: number; precision: number; frame: string; axisColor: string; up: string; down: string; muted: string }) {
  const [reading, setReading] = useState<{ candle: PreparedChartData['candles'][number]; active: boolean } | null>(null);
  const lastSent = useSharedValue(0);
  const trailing = useSharedValue(0);
  useEffect(() => () => cancelAnimation(trailing), [trailing]);
  useAnimatedReaction(() => {
    const candles = prepared.value.candles;
    const view = clampViewport(viewport.value, candles.length);
    const ratio = Math.max(0, Math.min(1, (crosshair.value.x - 8) / Math.max(1, plotW - 16)));
    const last = Math.floor(view.start + Math.max(0, view.count - 1));
    const index = crosshair.value.active ? Math.max(Math.ceil(view.start), Math.min(last, Math.round(view.start + ratio * Math.max(0, view.count - 1)))) : last;
    return { candle: candles[index], active: crosshair.value.active };
  }, (next, previous) => {
    cancelAnimation(trailing);
    if (!next.candle) { scheduleOnRN(setReading, null); return; }
    const now = Date.now();
    if (next.candle && (!previous?.candle || next.active !== previous.active || now - lastSent.value >= 80)) { lastSent.value = now; scheduleOnRN(setReading, next); }
    trailing.set(0);
    trailing.set(withDelay(90, withTiming(1, { duration: 0 }, finished => { if (finished) scheduleOnRN(setReading, next); }), ReduceMotion.Never));
  });
  const candle = reading?.candle;
  return <View style={{ gap: 4 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 4, minHeight: 20 }}>
      {(['open', 'high', 'low', 'close'] as const).map((key, index) => <View key={key} style={{ flex: 1, flexBasis: plotW < 220 ? '44%' : '20%', flexDirection: 'row', gap: 4, alignItems: 'center' }}>
        <Label size={9} color={muted}>{['O', 'H', 'L', 'C'][index]}</Label><Label size={9} color={key === 'close' && candle ? candle.close >= candle.open ? up : down : muted}>{candle ? `${key === 'close' ? candle.close >= candle.open ? '↗ ' : '↘ ' : ''}${candle[key].toFixed(precision)}` : '—'}</Label>
      </View>)}
    </View>
    {candle && <Label size={9} color={axisColor}>{reading?.active ? 'Selected bar' : 'Latest visible bar'} · {frame === '1D' ? `${new Date(candle.time).toISOString().slice(0, 10)} · UTC date anchor` : `${new Date(candle.time).toISOString().slice(0, 16).replace('T', ' ')} UTC · open time`}</Label>}
  </View>;
}
