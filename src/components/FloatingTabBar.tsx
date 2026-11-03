import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navigationLayout } from '../lib/navigation';
import { fonts } from '../lib/theme';
import { useReducedMotion } from '../lib/useReducedMotion';
import { referenceColors as c } from './reference';

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
  const { width } = useWindowDimensions();
  const wide = width > navigationLayout.wideBreakpoint;
  const reducedMotion = useReducedMotion();
  const routes = state.routes.filter(route => route.name !== 'news');
  const selectedIndex = routes.findIndex(route => route.key === state.routes[state.index].key);
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const slotWidth = Math.max(0, measuredWidth - padding * 2) / routes.length;
  const offset = wide ? selectedIndex * (railItemHeight + railGap) : selectedIndex * slotWidth;
  const [position] = useState(() => new Animated.Value(0));
  const previousLayout = useRef('');

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

  return <View pointerEvents="box-none" style={wide ? [styles.rail, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }] : [styles.mobile, { bottom: insets.bottom + navigationLayout.dockBottomGap, left: insets.left + navigationLayout.dockSideGap, right: insets.right + navigationLayout.dockSideGap }]}>
    <View onLayout={event => setMeasuredWidth(event.nativeEvent.layout.width)} style={[styles.dock, wide ? styles.railDock : styles.mobileDock]}>
      {measuredWidth > 0 && selectedIndex >= 0 && <Animated.View pointerEvents="none" style={[styles.indicator, {
        width: wide ? measuredWidth - padding * 2 : slotWidth, height: wide ? railItemHeight : navigationLayout.dockHeight - padding * 2,
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
        }} onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })} style={({ pressed }) => [styles.tab, wide ? styles.railTab : styles.mobileTab, { opacity: pressed ? 0.6 : 1, transform: [{ scale: pressed && reducedMotion === false ? 0.94 : 1 }] }]}>
          <Ionicons name={focused ? icon.filled : icon.outline} size={22} color={focused ? c.charcoal : '#ABB3AC'} />
          <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[styles.label, { color: focused ? c.charcoal : '#ABB3AC', fontFamily: focused ? fonts.extraBold : fonts.medium }]}>{title}</Text>
        </Pressable>;
      })}
    </View>
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
