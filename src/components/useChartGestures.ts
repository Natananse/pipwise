import { useIsFocused } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import {
  useCompetingGestures,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import { cancelAnimation, ReduceMotion, useAnimatedReaction, useSharedValue, withDecay, type SharedValue } from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';
import { clampViewport, panViewport, zoomViewport, type ChartViewport } from '../lib/chartViewport';
import type { Candle } from '../lib/market';

export type ChartCrosshair = { active: boolean; x: number; y: number };
type Options = {
  viewport: SharedValue<ChartViewport>;
  candles: SharedValue<readonly Candle[]>;
  crosshair: SharedValue<ChartCrosshair>;
  interacting: SharedValue<boolean>;
  plotWidth: number;
  left?: number;
  enabled: boolean;
  reducedMotion: boolean;
};

function ratioAt(x: number, left: number, width: number) {
  'worklet';
  if (!Number.isFinite(x)) return 0.5;
  return Math.max(0, Math.min(1, (x - left) / width));
}

/** The current GH3 hooks keep viewport updates and deceleration on the UI thread. */
export function useChartGestures({ viewport, candles, crosshair, interacting, plotWidth, left = 8, enabled, reducedMotion }: Options) {
  const focused = useIsFocused();
  const validLayout = Number.isFinite(plotWidth) && plotWidth > 0 && Number.isFinite(left);
  const gestureEnabled = useSharedValue(enabled && focused && validLayout);
  const panning = useSharedValue(false);
  const pinching = useSharedValue(false);
  const inspecting = useSharedValue(false);
  const panNeedsRebase = useSharedValue(false);
  const panPointers = useSharedValue(1);
  const pinchPointers = useSharedValue(2);
  const pinchRatio = useSharedValue(0.5);
  const pinchScale = useSharedValue(1);
  const momentum = useSharedValue(false);
  const momentumEpoch = useSharedValue(0);
  const momentumStart = useSharedValue(0);
  const momentumCount = useSharedValue(0);
  const momentumHistory = useSharedValue({ length: 0, first: 0 });

  const syncInteracting = useCallback(() => {
    'worklet';
    interacting.set(panning.get() || pinching.get() || inspecting.get() || momentum.get());
  }, [inspecting, interacting, momentum, panning, pinching]);

  const stopMomentum = useCallback(() => {
    'worklet';
    // Invalidate the old completion callback before cancelAnimation invokes it.
    momentumEpoch.set(momentumEpoch.get() + 1);
    momentum.set(false);
    cancelAnimation(momentumStart);
    syncInteracting();
  }, [momentum, momentumEpoch, momentumStart, syncInteracting]);

  const cancelOnUI = useCallback(() => {
    'worklet';
    stopMomentum();
    panning.set(false);
    pinching.set(false);
    inspecting.set(false);
    panNeedsRebase.set(true);
    crosshair.set({ ...crosshair.get(), active: false });
    interacting.set(false);
  }, [crosshair, inspecting, interacting, panNeedsRebase, panning, pinching, stopMomentum]);

  const cancelInteractions = useCallback(() => {
    scheduleOnUI(cancelOnUI);
  }, [cancelOnUI]);

  useEffect(() => {
    const updateAvailability = (state: string | null | undefined) => {
      const available = enabled && focused && validLayout && state !== 'background' && state !== 'inactive';
      gestureEnabled.set(available);
      if (!available) cancelInteractions();
    };
    updateAvailability(AppState.currentState);
    const subscription = AppState.addEventListener('change', updateAvailability);
    return () => {
      subscription.remove();
      gestureEnabled.set(false);
      cancelInteractions();
    };
  }, [cancelInteractions, enabled, focused, gestureEnabled, left, plotWidth, validLayout]);

  useEffect(() => {
    if (reducedMotion) scheduleOnUI(stopMomentum);
  }, [reducedMotion, stopMomentum]);

  useAnimatedReaction(
    () => ({ running: momentum.get(), start: momentumStart.get(), count: momentumCount.get() }),
    state => {
      if (!state.running) return;
      const data = candles.get();
      const history = momentumHistory.get();
      if (data.length !== history.length || (data[0]?.time ?? 0) !== history.first) {
        stopMomentum();
        return;
      }
      viewport.set(clampViewport({ start: state.start, count: state.count }, data.length));
    },
    [candles, momentum, momentumCount, momentumHistory, momentumStart, stopMomentum, viewport],
  );

  useAnimatedReaction(
    () => ({ length: candles.get().length, first: candles.get()[0]?.time ?? 0 }),
    (next, previous) => {
      if (!previous || next.length === previous.length && next.first === previous.first) return;
      // Ordinary forming-bar price ticks keep momentum. A different history
      // cancels stale decay bounds, while incremental touch updates stay rebased.
      stopMomentum();
      viewport.set(clampViewport(viewport.get(), next.length));
      if (!next.length) cancelOnUI();
    },
    [cancelOnUI, candles, stopMomentum, viewport],
  );

  const pan = usePanGesture({
    enabled: gestureEnabled,
    minPointers: 1,
    // Keep recognition alive through pinch -> single-finger handoff. Only
    // single-finger frames below can actually pan or start momentum.
    maxPointers: 2,
    averageTouches: true,
    activeOffsetX: [-6, 6],
    failOffsetY: [-10, 10],
    cancelsJSResponder: true,
    cancelsTouchesInView: true,
    onBegin: event => {
      'worklet';
      stopMomentum();
      panPointers.set(event.numberOfPointers);
      panNeedsRebase.set(false);
    },
    onActivate: event => {
      'worklet';
      if (!gestureEnabled.get() || inspecting.get()) return;
      stopMomentum();
      panning.set(true);
      panPointers.set(event.numberOfPointers);
      crosshair.set({ ...crosshair.get(), active: false });
      syncInteracting();
    },
    onUpdate: event => {
      'worklet';
      if (!gestureEnabled.get() || !panning.get()) return;
      if (pinching.get() || inspecting.get() || event.numberOfPointers !== 1) {
        panPointers.set(event.numberOfPointers);
        panNeedsRebase.set(true);
        return;
      }
      if (panNeedsRebase.get() || panPointers.get() !== 1) {
        panPointers.set(1);
        panNeedsRebase.set(false);
        return;
      }
      // changeX belongs to this frame, so a live-history shift or the end of a
      // simultaneous pinch cannot resurrect an obsolete gesture-start viewport.
      viewport.set(panViewport(viewport.get(), event.changeX, plotWidth, candles.get().length));
    },
    onDeactivate: event => {
      'worklet';
      const wasPanning = panning.get();
      panning.set(false);
      if (wasPanning && !event.canceled && !reducedMotion && gestureEnabled.get()
        && !pinching.get() && !inspecting.get() && !panNeedsRebase.get()
        && event.numberOfPointers <= 1 && Number.isFinite(event.velocityX) && Math.abs(event.velocityX) >= 20) {
        const current = clampViewport(viewport.get(), candles.get().length);
        const limit = Math.max(0, candles.get().length - current.count);
        if (limit > 0) {
          const epoch = momentumEpoch.get() + 1;
          momentumEpoch.set(epoch);
          momentumStart.set(current.start);
          momentumCount.set(current.count);
          momentumHistory.set({ length: candles.get().length, first: candles.get()[0]?.time ?? 0 });
          momentum.set(true);
          momentumStart.set(withDecay({
            velocity: -event.velocityX * Math.max(0, current.count - 1) / plotWidth,
            deceleration: 0.995,
            clamp: [0, limit],
            rubberBandEffect: false,
            reduceMotion: ReduceMotion.System,
          }, (_finished, position) => {
            'worklet';
            if (momentumEpoch.get() !== epoch || !momentum.get()) return;
            const data = candles.get();
            const history = momentumHistory.get();
            if (data.length !== history.length || (data[0]?.time ?? 0) !== history.first) {
              stopMomentum();
              return;
            }
            viewport.set(clampViewport({ start: typeof position === 'number' ? position : momentumStart.get(), count: current.count }, data.length));
            momentum.set(false);
            syncInteracting();
          }));
        }
      }
      syncInteracting();
    },
    onFinalize: () => {
      'worklet';
      // A failed competing recognizer must not cancel the winner's momentum.
      panning.set(false);
      syncInteracting();
    },
    onTouchesCancel: () => {
      'worklet';
      if (!panning.get()) return;
      panning.set(false);
      panNeedsRebase.set(true);
      stopMomentum();
      syncInteracting();
    },
  });

  const pinch = usePinchGesture({
    enabled: gestureEnabled,
    cancelsJSResponder: true,
    cancelsTouchesInView: true,
    onBegin: () => {
      'worklet';
      stopMomentum();
    },
    onActivate: event => {
      'worklet';
      if (!gestureEnabled.get()) return;
      stopMomentum();
      pinching.set(true);
      panNeedsRebase.set(true);
      pinchPointers.set(event.numberOfPointers);
      pinchScale.set(Number.isFinite(event.scale) && event.scale > 0 ? event.scale : 1);
      pinchRatio.set(ratioAt(event.focalX, left, plotWidth));
      crosshair.set({ ...crosshair.get(), active: false });
      syncInteracting();
    },
    onUpdate: event => {
      'worklet';
      if (!gestureEnabled.get() || !pinching.get() || !Number.isFinite(event.scale) || event.scale <= 0) return;
      const ratio = ratioAt(event.focalX, left, plotWidth);
      if (event.numberOfPointers !== pinchPointers.get()) {
        pinchPointers.set(event.numberOfPointers);
        pinchScale.set(event.scale);
        pinchRatio.set(ratio);
        return;
      }
      const current = clampViewport(viewport.get(), candles.get().length);
      const anchor = current.start + pinchRatio.get() * Math.max(0, current.count - 1);
      const next = zoomViewport(current, event.scale / pinchScale.get(), pinchRatio.get(), candles.get().length);
      viewport.set(clampViewport({ start: anchor - ratio * Math.max(0, next.count - 1), count: next.count }, candles.get().length));
      pinchScale.set(event.scale);
      pinchRatio.set(ratio);
    },
    onFinalize: () => {
      'worklet';
      if (pinching.get()) panNeedsRebase.set(true);
      pinching.set(false);
      syncInteracting();
    },
    onTouchesCancel: () => {
      'worklet';
      if (!pinching.get()) return;
      pinching.set(false);
      panNeedsRebase.set(true);
      stopMomentum();
      syncInteracting();
    },
  });

  const inspection = usePanGesture({
    enabled: gestureEnabled,
    activateAfterLongPress: 350,
    // Use the native timer, never the normal pan-distance threshold. Setting
    // minDistance: 0 would activate immediately on Android. Native movement
    // before the hold still fails; after activation this pan can cross the plot.
    minDistance: 1_000_000,
    minPointers: 1,
    maxPointers: 1,
    shouldCancelWhenOutside: false,
    cancelsJSResponder: true,
    cancelsTouchesInView: true,
    onBegin: () => {
      'worklet';
      stopMomentum();
    },
    onActivate: event => {
      'worklet';
      if (!gestureEnabled.get()) return;
      stopMomentum();
      inspecting.set(true);
      crosshair.set({ active: true, x: left + ratioAt(event.x, left, plotWidth) * plotWidth, y: event.y });
      syncInteracting();
    },
    onUpdate: event => {
      'worklet';
      if (!inspecting.get() || !gestureEnabled.get() || event.numberOfPointers !== 1) return;
      crosshair.set({ active: true, x: left + ratioAt(event.x, left, plotWidth) * plotWidth, y: event.y });
    },
    onFinalize: () => {
      'worklet';
      if (!inspecting.get()) return;
      inspecting.set(false);
      crosshair.set({ ...crosshair.get(), active: false });
      syncInteracting();
    },
    onTouchesCancel: () => {
      'worklet';
      if (!inspecting.get()) return;
      inspecting.set(false);
      crosshair.set({ ...crosshair.get(), active: false });
      stopMomentum();
      syncInteracting();
    },
  });

  const doubleTap = useTapGesture({
    enabled: gestureEnabled,
    numberOfTaps: 2,
    maxDelay: 250,
    maxDuration: 250,
    maxDistance: 8,
    cancelsJSResponder: true,
    cancelsTouchesInView: true,
    onBegin: () => {
      'worklet';
      stopMomentum();
    },
    onActivate: event => {
      'worklet';
      if (!gestureEnabled.get()) return;
      cancelOnUI();
      viewport.set(zoomViewport(viewport.get(), 1.6, ratioAt(event.x, left, plotWidth), candles.get().length));
    },
  });

  const navigation = useSimultaneousGestures(pan, pinch);
  const gesture = useCompetingGestures(navigation, inspection, doubleTap);
  return { gesture, cancelInteractions };
}
