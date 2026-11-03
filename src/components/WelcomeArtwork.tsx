import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { AppLogo } from './AppLogo';

const lime = '#C8F169';
const candles = [
  { x: 39, y: 124, body: 31, wick: 57, up: true },
  { x: 74, y: 103, body: 29, wick: 53, up: true },
  { x: 109, y: 110, body: 24, wick: 43, up: false },
  { x: 144, y: 81, body: 35, wick: 58, up: true },
  { x: 179, y: 64, body: 31, wick: 53, up: true },
  { x: 214, y: 72, body: 20, wick: 42, up: false },
];
const sweepRange = [0, 0.16, 0.32, 0.5, 0.68, 0.83, 1];
const sweepX = [24, 62, 100, 144, 186, 224, 258];
const sweepY = [162, 143, 150, 114, 123, 89, 67];

/** Decorative, native-driven artwork; every animated property is opacity or transform. */
export function WelcomeArtwork({ compact = false, reducedMotion = false }: {
  compact?: boolean;
  reducedMotion?: boolean;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const width = Math.min(compact ? 240 : 320, Math.max(120, screenWidth - 48));
  const scale = width / 320;
  const [reveal] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));
  const [candleValues] = useState(() => candles.map(() => new Animated.Value(reducedMotion ? 1 : 0)));
  const [sweep] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));
  const [float] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reducedMotion) {
      reveal.setValue(1);
      candleValues.forEach(value => value.setValue(1));
      sweep.setValue(1);
      float.setValue(0);
      pulse.setValue(0);
      return;
    }

    reveal.setValue(0);
    candleValues.forEach(value => value.setValue(0));
    sweep.setValue(0);
    float.setValue(0);
    pulse.setValue(0);
    const entry = Animated.parallel([
      Animated.timing(reveal, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false }),
      Animated.stagger(80, candleValues.map(value => Animated.timing(value, {
        toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false,
      }))),
      Animated.sequence([
        Animated.delay(380),
        Animated.timing(sweep, { toValue: 1, duration: 1250, easing: Easing.inOut(Easing.quad), useNativeDriver: true, isInteraction: false }),
      ]),
    ]);
    const floating = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(float, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    const glow = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: true, isInteraction: false }),
      Animated.timing(pulse, { toValue: 0, duration: 1600, useNativeDriver: true, isInteraction: false }),
    ]));
    entry.start();
    floating.start();
    glow.start();
    return () => { entry.stop(); floating.stop(); glow.stop(); };
  }, [candleValues, float, pulse, reducedMotion, reveal, sweep]);

  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width, height: 240 * scale, alignSelf: 'center' }}>
    <View style={{ width: 320, height: 240, position: 'absolute', left: (width - 320) / 2, top: (240 * scale - 240) / 2, transform: [{ scale }] }}>
      <View style={styles.halo} />
      <Animated.View style={{ position: 'absolute', inset: 0, opacity: reveal, transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }] }}>
        <View style={styles.backCard} />
        <View style={styles.chart}>
          <Svg width={282} height={198} viewBox="0 0 282 198">
            {[62, 103, 144, 185].map(y => <Line key={y} x1={18} x2={264} y1={y} y2={y} stroke="#2A3032" strokeDasharray="3 6" />)}
            {[45, 93, 141, 189, 237].map(x => <Line key={x} x1={x} x2={x} y1={50} y2={186} stroke="#232A29" />)}
            <Circle cx={21} cy={22} r={3} fill={lime} />
            <Rect x={32} y={19} width={48} height={5} rx={2.5} fill="#626D65" />
            <Rect x={225} y={16} width={37} height={12} rx={6} fill="#283322" />
            <Rect x={234} y={20} width={19} height={4} rx={2} fill={lime} opacity={0.8} />
          </Svg>
          {candles.map((candle, index) => <Animated.View key={candle.x} style={{
            position: 'absolute', left: candle.x, top: candle.y, width: 14, height: candle.wick,
            opacity: candleValues[index],
            transform: [{ translateY: candleValues[index].interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
          }}>
            <View style={{ position: 'absolute', left: 6, width: 1.5, top: 0, height: candle.wick, backgroundColor: candle.up ? lime : '#6C7770', opacity: 0.6 }} />
            <View style={{ position: 'absolute', left: 0, top: (candle.wick - candle.body) / 2, width: 14, height: candle.body, borderRadius: 3, backgroundColor: candle.up ? '#92B74C' : '#3C4940' }} />
          </Animated.View>)}
          <Animated.View style={{ position: 'absolute', inset: 0, opacity: sweep.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.5, 1] }) }}>
            <Svg width={282} height={198} viewBox="0 0 282 198">
              <Path d="M24 162 L62 143 L100 150 L144 114 L186 123 L224 89 L258 67" fill="none" stroke={lime} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Animated.View>
          <Animated.View style={{ position: 'absolute', left: -4, top: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: '#F3FFD9', transform: [
            { translateX: sweep.interpolate({ inputRange: sweepRange, outputRange: sweepX }) },
            { translateY: sweep.interpolate({ inputRange: sweepRange, outputRange: sweepY }) },
          ] }} />
          <Animated.View style={{ position: 'absolute', left: 244, top: 53, width: 28, height: 28, borderRadius: 14, backgroundColor: lime,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.2] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] }) }],
          }} />
        </View>
        <View style={styles.arrowBadge}>
          <Svg width={24} height={24} viewBox="0 0 24 24"><Path d="M5 18L18 5M6 5H18V17" stroke="#172015" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" /></Svg>
        </View>
        <View style={styles.logoBadge}>
          <AppLogo size={44} decorative />
        </View>
      </Animated.View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  halo: { position: 'absolute', left: 57, top: 17, width: 206, height: 206, borderRadius: 103, backgroundColor: '#C8F169', opacity: 0.035 },
  backCard: { position: 'absolute', left: 31, top: 28, width: 264, height: 181, borderRadius: 24, borderWidth: 1, borderColor: '#35402C', backgroundColor: '#141A12', transform: [{ rotate: '7deg' }] },
  chart: { position: 'absolute', left: 19, top: 23, width: 282, height: 198, borderRadius: 22, borderWidth: 1, borderColor: '#34402F', backgroundColor: '#161C18', overflow: 'hidden', transform: [{ rotate: '-5deg' }] },
  arrowBadge: { position: 'absolute', right: 0, top: 6, width: 47, height: 47, borderRadius: 16, backgroundColor: lime, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '8deg' }] },
  logoBadge: { position: 'absolute', left: 1, bottom: 3, width: 56, height: 56, borderRadius: 19, borderWidth: 1, borderColor: '#3A492D', backgroundColor: '#192116', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
});
