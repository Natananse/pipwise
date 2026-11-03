import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { onboardingText } from '../lib/onboarding';
import { fonts, useTheme } from '../lib/theme';
import { useReducedMotion } from '../lib/useReducedMotion';
import type { Language } from '../lib/workspace';
import { AppLogo } from './AppLogo';
import { Label } from './design';

export function LaunchSplash({ fontsReady, resourcesReady, language, onComplete }: {
  fontsReady: boolean; resourcesReady: boolean; language: Language; onComplete: () => void;
}) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const [entrance] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(1));
  const [introFinished, setIntroFinished] = useState(false);

  useEffect(() => {
    if (!fontsReady || reducedMotion === null) return;
    const animation = Animated.sequence([
      Animated.timing(entrance, { toValue: 1, duration: reducedMotion ? 0 : 550, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.delay(reducedMotion ? 0 : 1150),
    ]);
    animation.start(({ finished }) => { if (finished) setIntroFinished(true); });
    return () => animation.stop();
  }, [entrance, fontsReady, reducedMotion]);

  useEffect(() => {
    if (!introFinished || !resourcesReady) return;
    const exit = Animated.timing(opacity, { toValue: 0, duration: reducedMotion ? 0 : 220, useNativeDriver: true });
    exit.start(({ finished }) => { if (finished) onComplete(); });
    return () => exit.stop();
  }, [introFinished, onComplete, opacity, reducedMotion, resourcesReady]);

  return <Animated.View style={{ flex: 1, opacity, backgroundColor: colors.bg }}>
    <StatusBar style="light" />
    <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
      <Animated.View style={{ opacity: entrance, transform: [{ scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [reducedMotion ? 1 : 0.85, 1] }) }] }}>
        <AppLogo size={112} />
      </Animated.View>
      <Animated.View style={{ alignItems: 'center', gap: 10, opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
        <Label size={40} bold style={{ fontFamily: fonts.extraBold, letterSpacing: -1.6 }}>Pipwise<Label size={40} color={colors.primary}>.</Label></Label>
        <Label muted size={12} style={{ textAlign: 'center', maxWidth: 280 }}>{onboardingText(language, 'Build confidence, one practice trade at a time.')}</Label>
      </Animated.View>
      {introFinished && !resourcesReady && <ActivityIndicator accessibilityLabel="Preparing your workspace" color={colors.primary} style={{ marginTop: 16 }} />}
    </SafeAreaView>
  </Animated.View>;
}
