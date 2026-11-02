import { Tabs } from "expo-router";
import React from "react";
import { Platform, View, useWindowDimensions } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../../components/design";
import { useTheme } from "../../lib/theme";
import { useWorkspace } from "../../lib/workspace";
export const unstable_settings = { initialRouteName: "practice" };
export default function TabsLayout() {
  const { colors } = useTheme();
  const { t } = useWorkspace();
  const insets = useSafeAreaInsets();
  const wide = useWindowDimensions().width > 1050;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarPosition: wide ? "left" : "bottom",
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.sub,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
        tabBarItemStyle: { borderRadius: 14, margin: 5 },
        tabBarActiveBackgroundColor: "#00E67625",
        tabBarStyle: wide
          ? {
              width: 100,
              borderRightWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              paddingTop: 32,
            }
          : {
              position: "absolute",
              bottom: Math.max(insets.bottom, 14),
              left: 14,
              right: 14,
              height: 70,
              borderRadius: 24,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: colors.border,
              paddingBottom: 5,
              paddingTop: 5,
              backgroundColor:
                Platform.OS === "android" ? colors.card : "transparent",
              elevation: 8,
            },
        tabBarBackground: () =>
          Platform.OS === "android" ? (
            <View />
          ) : (
            <BlurView
              intensity={85}
              tint={colors.bg === "#FFFFFF" ? "light" : "dark"}
              style={{ flex: 1 }}
            />
          ),
      }}
    >
      <Tabs.Screen
        name="practice"
        options={{
          title: t("Trade"),
          tabBarIcon: ({ color }) => (
            <Icon
              name="stats-chart"
              color={typeof color === "string" ? color : colors.text}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: t("Learn"),
          tabBarIcon: ({ color }) => (
            <Icon
              name="book-outline"
              color={typeof color === "string" ? color : colors.text}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="analyse"
        options={{
          title: t("Analyse"),
          tabBarIcon: ({ color }) => (
            <Icon
              name="analytics-outline"
              color={typeof color === "string" ? color : colors.text}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="top"
        options={{
          title: t("Top"),
          tabBarIcon: ({ color }) => (
            <Icon
              name="podium-outline"
              color={typeof color === "string" ? color : colors.text}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("Profile"),
          tabBarIcon: ({ color }) => (
            <Icon
              name="person-outline"
              color={typeof color === "string" ? color : colors.text}
            />
          ),
        }}
      />
      <Tabs.Screen name="news" options={{ href: null }} />
    </Tabs>
  );
}
