import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { useTheme } from '../../lib/theme';

const tab = (title: string, icon: keyof typeof Ionicons.glyphMap) => ({
  title,
  tabBarIcon: ({ color, size }: { color: string; size: number }) => (
    <Ionicons name={icon} color={color} size={size} />
  ),
});

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,   // selected tab (the blue you have now)
        tabBarInactiveTintColor: '#C7CEDB',      // unselected tabs: light grey, easy to see
        tabBarStyle: {
          backgroundColor: '#1E2A44',            // bar color: lighter navy than the screen
          borderTopColor: '#34425F',             // thin line above the bar
          height: 68,
          paddingTop: 6,
          paddingBottom: 10,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="news" options={tab('News', 'calendar-outline')} />
      <Tabs.Screen name="learn" options={tab('Learn', 'school-outline')} />
      <Tabs.Screen name="practice" options={tab('Practice', 'flask-outline')} />
      <Tabs.Screen name="profile" options={tab('Profile', 'person-outline')} />
    </Tabs>
  );
}