import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAnimatedReaction, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import {
  type ChartCandle, type ChartViewport, clampViewport, initialViewport,
  prepareChartData, zoomViewport,
} from '../lib/chartViewport';

type Controls = { canEarlier: boolean; canLater: boolean; canZoomIn: boolean; canZoomOut: boolean };
const epsilon = 0.000001;

function availableControls(viewport: ChartViewport, length: number): Controls {
  'worklet';
  const current = clampViewport(viewport, length);
  return {
    canEarlier: current.start > epsilon,
    canLater: current.start + current.count < length - epsilon,
    canZoomIn: zoomViewport(current, 1.5, 0.5, length).count < current.count - epsilon,
    canZoomOut: zoomViewport(current, 1 / 1.5, 0.5, length).count > current.count + epsilon,
  };
}

function sameControls(left: Controls, right: Controls) {
  'worklet';
  return left.canEarlier === right.canEarlier && left.canLater === right.canLater
    && left.canZoomIn === right.canZoomIn && left.canZoomOut === right.canZoomOut;
}

/** Keep the same fractional candle-time anchor when a rolling history drops its oldest bars. */
function preserveAnchor(viewport: ChartViewport, previous: readonly ChartCandle[], next: readonly ChartCandle[]): ChartViewport {
  'worklet';
  if (!previous.length || !next.length) return clampViewport(viewport, next.length);
  const index = Math.min(previous.length - 1, Math.max(0, Math.floor(viewport.start)));
  const fraction = viewport.start - index;
  const after = previous[Math.min(previous.length - 1, index + 1)];
  const time = previous[index].time + (after.time - previous[index].time) * fraction;
  let left = 0;
  let right = next.length - 1;
  while (left < right) {
    const middle = Math.ceil((left + right) / 2);
    if (next[middle].time <= time) left = middle;
    else right = middle - 1;
  }
  const anchor = next[left];
  const following = next[Math.min(next.length - 1, left + 1)];
  const width = following.time - anchor.time;
  const nextFraction = width > 0 ? Math.max(0, Math.min(1, (time - anchor.time) / width)) : 0;
  return clampViewport({ start: left + nextFraction, count: viewport.count }, next.length);
}

/** Data is prepared on JS once per array; all live viewport reads and tools run on the UI runtime. */
export function useChartController({ candles, identity, initialCount }: {
  candles: readonly ChartCandle[]; identity: string; initialCount: number;
}) {
  const preparedData = useMemo(() => prepareChartData(candles), [candles]);
  const sharedCandles = useSharedValue(candles);
  const prepared = useSharedValue(preparedData);
  const viewport = useSharedValue(initialViewport(candles.length, initialCount));
  const crosshair = useSharedValue({ active: false, x: 0, y: 0 });
  const interacting = useSharedValue(false);
  const seriesIdentity = useSharedValue(identity);
  const mounted = useRef(true);
  const [controls, setControls] = useState(() => availableControls(initialViewport(candles.length, initialCount), candles.length));

  const publishControls = useCallback((next: Controls) => {
    if (mounted.current) setControls(previous => sameControls(previous, next) ? previous : next);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useAnimatedReaction(
    () => availableControls(viewport.value, sharedCandles.value.length),
    (next, previous) => {
      if (!previous || !sameControls(previous, next)) scheduleOnRN(publishControls, next);
    },
    [publishControls],
  );

  useEffect(() => {
    scheduleOnUI(() => {
      'worklet';
      const previous = sharedCandles.value;
      const current = clampViewport(viewport.value, previous.length);
      const changedSeries = seriesIdentity.value !== identity;
      const followsLatest = current.start + current.count >= previous.length - epsilon && !interacting.value;
      let next = changedSeries || !previous.length
        ? initialViewport(candles.length, initialCount)
        : preserveAnchor(current, previous, candles);
      if (!changedSeries && previous.length && followsLatest) {
        next = clampViewport({ start: candles.length - current.count, count: current.count }, candles.length);
      }
      sharedCandles.value = candles;
      prepared.value = preparedData;
      viewport.value = next;
      seriesIdentity.value = identity;
      if (changedSeries || !candles.length) {
        crosshair.value = { active: false, x: 0, y: 0 };
        interacting.value = false;
      }
    });
  }, [candles, preparedData, identity, initialCount, sharedCandles, prepared, viewport, seriesIdentity, crosshair, interacting]);

  const zoom = useCallback((scale: number) => {
    scheduleOnUI(() => {
      'worklet';
      viewport.value = zoomViewport(viewport.value, scale, 0.5, sharedCandles.value.length);
      crosshair.value = { active: false, x: 0, y: 0 };
    });
  }, [viewport, sharedCandles, crosshair]);
  const pan = useCallback((direction: number) => {
    scheduleOnUI(() => {
      'worklet';
      const current = viewport.value;
      viewport.value = clampViewport({ start: current.start - direction * current.count * 0.25, count: current.count }, sharedCandles.value.length);
      crosshair.value = { active: false, x: 0, y: 0 };
    });
  }, [viewport, sharedCandles, crosshair]);
  const zoomIn = useCallback(() => zoom(1.5), [zoom]);
  const zoomOut = useCallback(() => zoom(1 / 1.5), [zoom]);
  const panEarlier = useCallback(() => pan(1), [pan]);
  const panLater = useCallback(() => pan(-1), [pan]);
  const reset = useCallback(() => {
    scheduleOnUI(() => {
      'worklet';
      viewport.value = initialViewport(sharedCandles.value.length, initialCount);
      crosshair.value = { active: false, x: 0, y: 0 };
      interacting.value = false;
    });
  }, [viewport, sharedCandles, initialCount, crosshair, interacting]);

  return { candles: sharedCandles, prepared, viewport, crosshair, interacting, controls, zoomIn, zoomOut, panEarlier, panLater, reset };
}
