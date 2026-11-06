import { Tabs } from 'expo-router';
import React from 'react';
import { useWindowDimensions } from 'react-native';
import { FloatingTabBar } from '../../components/FloatingTabBar';
import { referenceColors as c } from '../../components/reference';
import { lightHaptic } from '../../lib/haptics';
import { navigationLayout } from '../../lib/navigation';
import { ThemeSurface } from '../../lib/theme';
import { useWorkspace } from '../../lib/workspace';

export const unstable_settings = { anchor: 'practice' };
export default function TabsLayout() {
  const { t } = useWorkspace(); const wide = useWindowDimensions().width > navigationLayout.wideBreakpoint;
  return <ThemeSurface tone="light"><Tabs backBehavior="initialRoute" tabBar={props => <FloatingTabBar {...props} />} screenListeners={{ tabPress: () => lightHaptic() }} screenOptions={{ headerShown: false, tabBarPosition: wide ? 'left' : 'bottom', sceneStyle: { backgroundColor: c.bg, marginLeft: wide ? navigationLayout.railWidth : 0 }, tabBarStyle: { width: wide ? navigationLayout.railWidth : undefined } }}>
    <Tabs.Screen name="practice" options={{ title: t('Trade') }} />
    <Tabs.Screen name="learn" options={{ title: t('Learn') }} />
    <Tabs.Screen name="analyse" options={{ title: t('Analyse') }} />
    <Tabs.Screen name="top" options={{ title: t('Progress') }} />
    <Tabs.Screen name="profile" options={{ title: t('Profile') }} />
    <Tabs.Screen name="news" options={{ href: null }} />
  </Tabs></ThemeSurface>;
}
