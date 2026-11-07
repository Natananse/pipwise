import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../lib/theme";
import { ScreenSystemBars } from './ScreenSystemBars';

export function Screen({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  return (
    <SafeAreaView
      style={[{ flex: 1, backgroundColor: colors.bg, padding: 24 }, style]}
    >
      <ScreenSystemBars style={colors.bg === '#0D1011' ? 'light' : 'dark'} backgroundColor={colors.bg} />
      {children}
    </SafeAreaView>
  );
}
export function Title({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: TextStyle;
}) {
  const { colors } = useTheme();
  return (
    <Text
      style={[{ fontSize: 28, fontWeight: "700", color: colors.text }, style]}
    >
      {children}
    </Text>
  );
}
export function Body({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: TextStyle;
}) {
  const { colors } = useTheme();
  return (
    <Text style={[{ fontSize: 16, lineHeight: 22, color: colors.sub }, style]}>
      {children}
    </Text>
  );
}
export function Button({
  label,
  onPress,
  variant = "solid",
  busy,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: "solid" | "outline";
  busy?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const solid = variant === "solid";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      style={[
        s.btn,
        {
          backgroundColor: solid ? colors.primary : "transparent",
          borderColor: colors.primary,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={solid ? colors.onPrimary : colors.primary} />
      ) : (
        <Text
          style={{
            fontWeight: "600",
            fontSize: 16,
            color: solid ? colors.onPrimary : colors.primary,
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
export function Card({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: 16,
        gap: 8,
      }}
    >
      {children}
    </View>
  );
}
const s = StyleSheet.create({
  btn: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
