import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { useTheme } from '../../lib/theme';

const tab = (title: string, icon: keyof typeof Ionicons.glyphMap) => ({
  title, tabBarIcon: ({ color, size }: { color: string; size: number }) => <Ionicons name={icon} color={color} size={size} />,
});

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border } }}>
      <Tabs.Screen name="news" options={tab('News', 'calendar-outline')} />
      <Tabs.Screen name="learn" options={tab('Learn', 'school-outline')} />
      <Tabs.Screen name="practice" options={tab('Practice', 'flask-outline')} />
      <Tabs.Screen name="profile" options={tab('Profile', 'person-outline')} />
    </Tabs>
  );
}
