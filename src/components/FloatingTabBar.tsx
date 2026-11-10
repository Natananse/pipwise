import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Animated, Keyboard, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navigationLayout } from '../lib/navigation';
import { fonts } from '../lib/theme';
import { useReducedMotion } from '../lib/useReducedMotion';
import { referenceColors as c } from './reference';
import { tradeChrome } from '../lib/tradeChrome';

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];
type IconName = keyof typeof Ionicons.glyphMap;
const icons: Record<string, { outline: IconName; filled: IconName }> = {
  practice: { outline: 'stats-chart-outline', filled: 'stats-chart' },
  learn: { outline: 'school-outline', filled: 'school' },
  analyse: { outline: 'analytics-outline', filled: 'analytics' },
  top: { outline: 'trophy-outline', filled: 'trophy' },
  profile: { outline: 'person-outline', filled: 'person' },
};
const padding = 8;
const railItemHeight = 62;
const railGap = 8;

export function FloatingTabBar({ state, descriptors, emitter, navigateToTab }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const chrome = useSyncExternalStore(tradeChrome.subscribe, tradeChrome.getSnapshot, tradeChrome.getServerSnapshot);
  const compact = width > height;
  const wide = width > navigationLayout.wideBreakpoint;
  const currentRailHeight = compact ? 44 : railItemHeight;
  const currentRailGap = compact ? 4 : railGap;
  const currentPadding = compact && !wide ? 4 : padding;
  const concealed = chrome.active && (chrome.fullScreen || chrome.enabled && chrome.hidden);
  const reducedMotion = useReducedMotion();
  const routes = state.routes.filter(route => route.name !== 'news');
  const selectedIndex = routes.findIndex(route => route.key === state.routes[state.index].key);
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const slotWidth = Math.max(0, measuredWidth - currentPadding * 2) / routes.length;
  const offset = wide ? selectedIndex * (currentRailHeight + currentRailGap) : selectedIndex * slotWidth;
  const [position] = useState(() => new Animated.Value(0));
  const [visibility] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reducedMotion !== false) { visibility.setValue(concealed ? 0 : 1); return; }
    const animation = Animated.timing(visibility, { toValue: concealed ? 0 : 1, duration: 180, useNativeDriver: Platform.OS !== 'web', isInteraction: false });
    animation.start(); return () => animation.stop();
  }, [concealed, reducedMotion, visibility]);
  const previousLayout = useRef('');
  const [keyboardVisible, setKeyboardVisible] = useState(() => Platform.OS !== 'web' && Keyboard.isVisible());

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    const layout = `${wide}:${measuredWidth}`;
    // Snap on first layout/rotation and when motion is reduced or still unknown.
    if (reducedMotion !== false || previousLayout.current !== layout) {
      position.setValue(offset);
    } else {
      const animation = Animated.spring(position, {
        toValue: offset, stiffness: 340, damping: 30, mass: 0.85,
        useNativeDriver: Platform.OS !== 'web', isInteraction: false,
      });
      animation.start();
      previousLayout.current = layout;
      return () => animation.stop();
    }
    previousLayout.current = layout;
  }, [measuredWidth, offset, position, reducedMotion, wide]);

  if (keyboardVisible) return null;
  return <View pointerEvents="box-none" style={wide ? [styles.rail, { left: insets.left, paddingTop: insets.top + (compact ? 4 : 20), paddingBottom: insets.bottom + (compact ? 4 : 20) }] : [styles.mobile, { bottom: insets.bottom + navigationLayout.dockBottomGap, left: insets.left + navigationLayout.dockSideGap, right: insets.right + navigationLayout.dockSideGap }]}>
    {concealed && !chrome.fullScreen && <Pressable accessibilityRole="button" accessibilityLabel="Show navigation" onPress={() => tradeChrome.reveal()} style={{ minWidth: 100, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F5EF', borderRadius: 22, borderWidth: 1, borderColor: '#DDE2D7' }}><View style={{ width: 36, height: 4, backgroundColor: '#62695F', borderRadius: 2 }} /></Pressable>}
    <Animated.View pointerEvents={concealed ? 'none' : 'auto'} accessibilityElementsHidden={concealed} importantForAccessibility={concealed ? 'no-hide-descendants' : 'auto'} style={{ opacity: visibility, transform: [{ translateY: visibility.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }], position: concealed ? 'absolute' : 'relative', display: chrome.fullScreen ? 'none' : 'flex', width: '100%', alignItems: 'center' }}>
    <View onLayout={event => setMeasuredWidth(event.nativeEvent.layout.width)} style={[styles.dock, wide ? styles.railDock : styles.mobileDock, compact && (wide ? { gap: currentRailGap } : { height: navigationLayout.compactDockHeight, maxWidth: 320, padding: currentPadding })]}>
      {measuredWidth > 0 && selectedIndex >= 0 && <Animated.View pointerEvents="none" style={[styles.indicator, {
        left: currentPadding, top: currentPadding,
        width: wide ? measuredWidth - padding * 2 : slotWidth, height: wide ? currentRailHeight : compact ? 44 : navigationLayout.dockHeight - padding * 2,
        transform: wide ? [{ translateY: position }] : [{ translateX: position }],
      }]} />}
      {routes.map(route => {
        const focused = state.routes[state.index].key === route.key;
        const options = descriptors[route.key].options;
        const title = options.title || route.name;
        const icon = icons[route.name] ?? { outline: 'ellipse-outline', filled: 'ellipse' };
        return <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={options.tabBarAccessibilityLabel || title} accessibilityState={{ selected: focused }} aria-selected={focused} onPress={() => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        }} onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })} style={({ pressed }) => [styles.tab, wide ? styles.railTab : styles.mobileTab, compact && { minHeight: 44, height: currentRailHeight }, { opacity: pressed ? 0.6 : 1, transform: [{ scale: pressed && reducedMotion === false ? 0.94 : 1 }] }]}>
          <Ionicons name={focused ? icon.filled : icon.outline} size={22} color={focused ? c.charcoal : '#ABB3AC'} />
          {!compact && <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[styles.label, { color: focused ? c.charcoal : '#ABB3AC', fontFamily: focused ? fonts.extraBold : fonts.medium }]}>{title}</Text>}
        </Pressable>;
      })}
    </View>
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  mobile: { position: 'absolute', alignItems: 'center', zIndex: 20 },
  rail: { position: 'absolute', top: 0, bottom: 0, left: 0, width: navigationLayout.railWidth, alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  dock: { padding, backgroundColor: c.charcoal, borderRadius: 38, shadowColor: '#101A13', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 10 },
  mobileDock: { width: '100%', maxWidth: 390, height: navigationLayout.dockHeight, flexDirection: 'row' },
  railDock: { width: 88, gap: railGap },
  indicator: { position: 'absolute', left: padding, top: padding, backgroundColor: '#F5F7F2', borderRadius: 29 },
  tab: { alignItems: 'center', justifyContent: 'center', gap: 3, minWidth: 44 },
  mobileTab: { flex: 1, minHeight: 54 },
  railTab: { height: railItemHeight },
  label: { fontSize: 9, lineHeight: 13, textAlign: 'center' },
});
