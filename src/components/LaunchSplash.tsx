import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { onboardingText } from '../lib/onboarding';
import { fonts } from '../lib/theme';
import { useReducedMotion } from '../lib/useReducedMotion';
import type { Language } from '../lib/workspace';
import { AppLogo } from './AppLogo';
import { Label } from './design';

const lime = '#C8F169';
const backdrop = '#0D1011';
const candleHeights = [24, 39, 31, 53, 44];
const subscribeToHydration = () => () => {};
const clientHydrated = () => true;
const serverHydrated = () => false;

export function LaunchSplash({ fontsReady, resourcesReady, language, onComplete }: {
  fontsReady: boolean; resourcesReady: boolean; language: Language; onComplete: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const measured = useWindowDimensions();
  const hydrated = useSyncExternalStore(subscribeToHydration, clientHydrated, serverHydrated);
  // SSR and the first browser render need the same geometry. Native renderers
  // use the measured window immediately; browsers adopt it after hydration.
  const width = hydrated && measured.width > 0 ? measured.width : 390;
  const height = hydrated && measured.height > 0 ? measured.height : 844;
  const artworkSize = Math.min(height < 700 ? 236 : 280, width - 48);
  const artworkScale = artworkSize / 280;
  const [mark] = useState(() => new Animated.Value(0));
  const [wordmark] = useState(() => new Animated.Value(0));
  const [orbit] = useState(() => new Animated.Value(0));
  const [progress] = useState(() => new Animated.Value(0));
  const [candles] = useState(() => candleHeights.map(() => new Animated.Value(0)));
  const [opacity] = useState(() => new Animated.Value(1));
  const [introFinished, setIntroFinished] = useState(false);
  const completed = useRef(false);
  const useNativeDriver = Platform.OS !== 'web';

  useEffect(() => {
    if (!fontsReady || reducedMotion === null || introFinished) return;
    const finishIntro = () => {
      mark.setValue(1); wordmark.setValue(1); orbit.setValue(1); progress.setValue(1);
      candles.forEach(value => value.setValue(1));
      setIntroFinished(true);
    };
    // Some native animation callbacks can be interrupted during reload/resume.
    const fallback = setTimeout(finishIntro, reducedMotion ? 50 : 2200);
    const duration = (value: number) => reducedMotion ? 0 : value;
    const animation = Animated.sequence([
      Animated.parallel([
        Animated.timing(mark, { toValue: 1, duration: duration(750), easing: Easing.out(Easing.cubic), useNativeDriver, isInteraction: false }),
        Animated.timing(orbit, { toValue: 1, duration: duration(1300), easing: Easing.out(Easing.cubic), useNativeDriver, isInteraction: false }),
        Animated.timing(progress, { toValue: 1, duration: duration(1400), easing: Easing.inOut(Easing.quad), useNativeDriver, isInteraction: false }),
        Animated.sequence([
          Animated.delay(duration(280)),
          Animated.timing(wordmark, { toValue: 1, duration: duration(600), easing: Easing.out(Easing.cubic), useNativeDriver, isInteraction: false }),
        ]),
        Animated.stagger(duration(90), candles.map(value => Animated.timing(value, {
          toValue: 1, duration: duration(620), easing: Easing.out(Easing.cubic), useNativeDriver, isInteraction: false,
        }))),
      ]),
      Animated.delay(duration(100)),
    ]);
    animation.start(({ finished }) => { if (finished) { clearTimeout(fallback); setIntroFinished(true); } });
    return () => { clearTimeout(fallback); animation.stop(); };
  }, [candles, fontsReady, introFinished, mark, orbit, progress, reducedMotion, useNativeDriver, wordmark]);

  useEffect(() => {
    if (!fontsReady || !introFinished || !resourcesReady || reducedMotion === null || completed.current) return;
    const complete = () => {
      if (!completed.current) { completed.current = true; onComplete(); }
    };
    const fallback = setTimeout(complete, reducedMotion ? 50 : 400);
    const exit = Animated.timing(opacity, { toValue: 0, duration: reducedMotion ? 0 : 200, useNativeDriver, isInteraction: false });
    exit.start(({ finished }) => {
      if (finished) { clearTimeout(fallback); complete(); }
    });
    return () => { clearTimeout(fallback); exit.stop(); };
  }, [fontsReady, introFinished, onComplete, opacity, reducedMotion, resourcesReady, useNativeDriver]);

  return <Animated.View style={[styles.screen, { opacity }]}>
    <StatusBar style="light" />
    <SafeAreaView style={styles.safeArea}>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={{ width: artworkSize, height: artworkSize }}>
        <View style={{ width: 280, height: 280, position: 'absolute', left: (artworkSize - 280) / 2, top: (artworkSize - 280) / 2, transform: [{ scale: artworkScale }] }}>
          <View style={styles.halo} />
          <View style={styles.outerRing} />
          <Animated.View style={[styles.orbit, { opacity: orbit.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }), transform: [{ rotate: orbit.interpolate({ inputRange: [0, 1], outputRange: ['-36deg', '12deg'] }) }] }]}>
            <View style={styles.orbitDot} /><View style={styles.orbitDotSmall} />
          </Animated.View>
          <Svg width={280} height={280} viewBox="0 0 280 280" style={StyleSheet.absoluteFill}>
            <Circle cx={140} cy={140} r={88} stroke="#303532" fill="none" strokeDasharray="2 9" />
            <Line x1={32} x2={248} y1={218} y2={218} stroke="#2A3032" strokeDasharray="3 7" />
            <Path d="M23 218 L55 208 L86 219 L117 183 L148 193 L179 166 L211 175 L256 133" stroke={lime} strokeWidth={1.5} strokeOpacity={0.3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          {candleHeights.map((candleHeight, index) => <Animated.View key={index} style={{
            position: 'absolute', left: 45 + index * 43, top: 224 - candleHeight, width: 8, height: candleHeight,
            opacity: candles[index].interpolate({ inputRange: [0, 1], outputRange: [0, index % 2 ? 0.65 : 0.35] }),
            transform: [{ translateY: candles[index].interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }],
          }}>
            <View style={{ position: 'absolute', left: 3.5, top: -8, bottom: -8, width: 1, backgroundColor: index % 2 ? lime : '#A3AAA7' }} />
            <View style={{ flex: 1, backgroundColor: index % 2 ? lime : '#8D9490', borderRadius: 2 }} />
          </Animated.View>)}
          <Animated.View style={[styles.logo, {
            opacity: mark.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
            transform: [
              { scale: mark.interpolate({ inputRange: [0, 1], outputRange: [reducedMotion ? 1 : 0.76, 1] }) },
              { rotate: mark.interpolate({ inputRange: [0, 1], outputRange: [reducedMotion ? '0deg' : '-8deg', '0deg'] }) },
            ],
          }]}><AppLogo size={112} decorative /></Animated.View>
          <Animated.View style={[styles.cornerMark, { opacity: mark, transform: [{ scale: mark.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]}>
            <Svg width={22} height={22} viewBox="0 0 22 22"><Path d="M5 16L16 5M6 5H16V15" stroke={backdrop} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" /></Svg>
          </Animated.View>
        </View>
      </View>
      <Animated.View style={{ alignItems: 'center', gap: 11, opacity: wordmark, transform: [{ translateY: wordmark.interpolate({ inputRange: [0, 1], outputRange: [reducedMotion ? 0 : 12, 0] }) }] }}>
        <Label size={height < 700 ? 44 : 50} bold color="#F4F3EF" style={{ fontFamily: fonts.extraBold, letterSpacing: -2 }}>Pipwise<Label size={height < 700 ? 44 : 50} color={lime}>.</Label></Label>
        <Label size={12} color="#A3AAA7" style={{ textAlign: 'center', maxWidth: 272, lineHeight: 20 }}>{onboardingText(language, 'Build confidence, one practice trade at a time.')}</Label>
      </Animated.View>
      <View style={styles.loadingArea}>
        {introFinished && !resourcesReady && reducedMotion === false ? <ActivityIndicator accessibilityLabel="Preparing your workspace" color={lime} /> : <View accessibilityRole="progressbar" accessibilityLabel="Preparing your workspace" accessibilityState={{ busy: true }} style={styles.progressTrack}><Animated.View style={[styles.progressFill, { transform: [{ scaleX: progress.interpolate({ inputRange: [0, 1], outputRange: [0.06, 1] }) }] }]} /></View>}
      </View>
    </SafeAreaView>
  </Animated.View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: backdrop },
  safeArea: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  halo: { position: 'absolute', top: 37, left: 37, width: 206, height: 206, borderRadius: 103, backgroundColor: '#202624' },
  outerRing: { position: 'absolute', top: 18, left: 18, width: 244, height: 244, borderRadius: 122, borderWidth: 1, borderColor: '#2A3032' },
  orbit: { position: 'absolute', top: 18, left: 18, width: 244, height: 244, borderRadius: 122 },
  orbitDot: { position: 'absolute', left: 118, top: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: lime },
  orbitDotSmall: { position: 'absolute', left: 29, bottom: 27, width: 5, height: 5, borderRadius: 3, backgroundColor: '#A3AAA7' },
  logo: { position: 'absolute', left: 76, top: 76, width: 128, height: 128, borderRadius: 34, borderWidth: 1, borderColor: '#424A43', backgroundColor: '#161A1B', alignItems: 'center', justifyContent: 'center', shadowColor: '#000000', shadowOpacity: 0.24, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 5 },
  cornerMark: { position: 'absolute', right: 49, top: 62, width: 39, height: 39, borderRadius: 14, backgroundColor: lime, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: backdrop },
  loadingArea: { height: 32, marginTop: 16, justifyContent: 'center', alignItems: 'center' },
  progressTrack: { width: 64, height: 3, borderRadius: 2, backgroundColor: '#2A3032', overflow: 'hidden' },
  progressFill: { width: 64, height: 3, borderRadius: 2, backgroundColor: lime },
});
