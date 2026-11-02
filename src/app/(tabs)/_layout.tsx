import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/design';
import { lightHaptic } from '../../lib/haptics';
import { fonts, useTheme } from '../../lib/theme';
import { useWorkspace } from '../../lib/workspace';
export const unstable_settings = { initialRouteName: 'practice' };
const tabIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  practice: 'stats-chart', learn: 'book-outline', analyse: 'analytics-outline', top: 'podium-outline', profile: 'person-outline',
};
type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];
function FloatingTabBar({ state, descriptors, emitter, navigateToTab }: TabBarProps) {
  const { colors } = useTheme(); const insets = useSafeAreaInsets();
  return <View style={{ position: 'absolute', bottom: Math.max(insets.bottom, 14), left: 22, right: 22, height: 68, padding: 8, flexDirection: 'row', alignItems: 'center', borderRadius: 34, backgroundColor: colors.tab, borderWidth: 1, borderColor: colors.darkBorder }}>
    {state.routes.filter(route => route.name !== 'news').map(route => {
      const focused = state.routes[state.index].key === route.key;
      const options = descriptors[route.key].options;
      const title = options.title || route.name;
      return <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={options.tabBarAccessibilityLabel || title} accessibilityState={{ selected: focused }} onPress={() => {
        const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (!focused && !event.defaultPrevented) navigateToTab(route.key);
      }} onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })} style={({ pressed }) => ({ flex: focused ? 1.8 : 1, height: 52, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 26, backgroundColor: focused ? colors.activeTab : colors.transparent, opacity: pressed ? 0.6 : 1 })}>
        <Ionicons name={tabIcons[route.name]} size={21} color={focused ? colors.onActiveTab : colors.darkSub} />
        {focused && <Text numberOfLines={1} style={{ color: colors.onActiveTab, fontFamily: fonts.bold, fontSize: 11, flexShrink: 1 }}>{title}</Text>}
      </Pressable>;
    })}
  </View>;
}
export default function TabsLayout() {
  const { colors } = useTheme(); const { t } = useWorkspace(); const wide = useWindowDimensions().width > 1050;
  return <Tabs tabBar={wide ? undefined : props => <FloatingTabBar {...props} />} screenListeners={{ tabPress: () => lightHaptic() }} screenOptions={{ headerShown: false, tabBarPosition: wide ? 'left' : 'bottom', tabBarActiveTintColor: colors.onActiveTab, tabBarInactiveTintColor: colors.darkSub, tabBarLabelStyle: { fontSize: 11, fontFamily: fonts.bold }, tabBarItemStyle: { borderRadius: 24, marginVertical: 8, marginHorizontal: 8, minHeight: 52 }, tabBarActiveBackgroundColor: colors.activeTab, tabBarStyle: { width: 112, borderRightWidth: 1, borderColor: colors.darkBorder, backgroundColor: colors.tab, paddingTop: 32 } }}>
    <Tabs.Screen name="practice" options={{ title: t('Trade'), tabBarIcon: ({ color }) => <Icon name="stats-chart" color={color as string} /> }} />
    <Tabs.Screen name="learn" options={{ title: t('Learn'), tabBarIcon: ({ color }) => <Icon name="book-outline" color={color as string} /> }} />
    <Tabs.Screen name="analyse" options={{ title: t('Analyse'), tabBarIcon: ({ color }) => <Icon name="analytics-outline" color={color as string} /> }} />
    <Tabs.Screen name="top" options={{ title: t('Top'), tabBarIcon: ({ color }) => <Icon name="podium-outline" color={color as string} /> }} />
    <Tabs.Screen name="profile" options={{ title: t('Profile'), tabBarIcon: ({ color }) => <Icon name="person-outline" color={color as string} /> }} />
    <Tabs.Screen name="news" options={{ href: null }} />
  </Tabs>;
}
