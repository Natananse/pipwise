import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useTheme } from "../lib/theme";
import { useWorkspace } from "../lib/workspace";
export const tokens = {
  space: 20,
  radius: 22,
  lime: "#00E676",
  navy: "#0A2540",
  red: "#C43549",
  green: "#087D51",
};
export function Icon({
  name,
  size = 20,
  color,
}: {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  color?: string;
}) {
  const { colors } = useTheme();
  return <Ionicons name={name} size={size} color={color || colors.text} />;
}
export function Label({
  children,
  size = 14,
  muted = false,
  bold = false,
  color,
  style,
}: {
  children: React.ReactNode;
  size?: number;
  muted?: boolean;
  bold?: boolean;
  color?: string;
  style?: object;
}) {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        {
          color: color || (muted ? colors.sub : colors.text),
          fontSize: size,
          fontWeight: bold ? "700" : "400",
          lineHeight: size * 1.45,
          fontVariant: ["tabular-nums"],
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Brand({ large = false }: { large?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
      <Image
        accessibilityLabel="Original Pipswise owl logo"
        source={require("../../assets/android-icon-backgrounds.png")}
        style={{
          width: large ? 100 : 40,
          height: large ? 100 : 40,
          resizeMode: "contain",
        }}
      />
      {!large && (
        <Label size={23} bold>
          Pipswise<Label color={tokens.green}>.</Label>
        </Label>
      )}
    </View>
  );
}
export function AppButton({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled,
  busy,
  compact = false,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  busy?: boolean;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const [scale] = useState(() => new Animated.Value(1));
  const reduced = useRef(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(
      (v) => (reduced.current = v),
    );
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (v) => (reduced.current = v),
    );
    return () => sub.remove();
  }, []);
  const animate = (value: number) => {
    if (!reduced.current)
      Animated.spring(scale, {
        toValue: value,
        useNativeDriver: true,
        speed: 40,
        bounciness: 0,
      }).start();
  };
  const bg =
    variant === "primary"
      ? tokens.lime
      : variant === "danger"
        ? tokens.red
        : variant === "secondary"
          ? colors.card
          : "transparent";
  const fg =
    variant === "primary"
      ? tokens.navy
      : variant === "danger"
        ? "#FFF"
        : colors.text;
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || busy, busy }}
        disabled={disabled || busy}
        onPress={onPress}
        onPressIn={() => animate(0.97)}
        onPressOut={() => animate(1)}
        style={{
          minHeight: compact ? 44 : 52,
          paddingHorizontal: compact ? 14 : 22,
          borderRadius: 14,
          backgroundColor: bg,
          borderWidth: variant === "secondary" ? 1 : 0,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
          opacity: disabled ? 0.4 : 1,
        }}
      >
        {busy ? (
          <ActivityIndicator color={fg} />
        ) : (
          <>
            {icon && <Icon name={icon} color={fg} size={18} />}
            <Label bold color={fg}>
              {label}
            </Label>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}
export function IconButton({
  name,
  label,
  onPress,
}: {
  name: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon name={name} />
    </Pressable>
  );
}
export function GlassCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: tokens.radius,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 22,
          gap: 18,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Row({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 44,
        paddingHorizontal: 15,
        justifyContent: "center",
        borderRadius: 12,
        backgroundColor: selected ? colors.text : colors.card,
        borderWidth: 1,
        borderColor: selected ? colors.text : colors.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Label size={12} bold color={selected ? colors.bg : colors.sub}>
        {label}
      </Label>
    </Pressable>
  );
}
export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: "#E4FBEE",
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
      }}
    >
      <Label size={10} bold color="#087D51">
        {children}
      </Label>
    </View>
  );
}
export function AppInput({
  label,
  ...props
}: TextInputProps & { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Label size={12} bold>
        {label}
      </Label>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.sub}
        {...props}
        style={[
          {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            padding: 15,
            minHeight: 50,
            backgroundColor: colors.card,
            color: colors.text,
            fontSize: 16,
          },
          props.style,
        ]}
      />
    </View>
  );
}
export function EmptyState({
  title,
  detail,
  icon = "layers-outline",
}: {
  title: string;
  detail: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={{ alignItems: "center", padding: 28, gap: 10 }}>
      <Icon name={icon} size={30} color="#92A3B2" />
      <Label bold>{title}</Label>
      <Label muted size={13} style={{ textAlign: "center", maxWidth: 320 }}>
        {detail}
      </Label>
    </View>
  );
}
export function LoadingState() {
  return (
    <View style={{ padding: 60, alignItems: "center" }}>
      <ActivityIndicator color={tokens.green} />
      <Label muted>Preparing your workspace…</Label>
    </View>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <View accessibilityRole="alert" style={{ padding: 16, gap: 10 }}>
      <Label color={tokens.red}>{message}</Label>
      {retry && (
        <AppButton label="Try again" onPress={retry} variant="secondary" />
      )}
    </View>
  );
}
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "#031B3866",
          justifyContent: width > 700 ? "center" : "flex-end",
          alignItems: "center",
        }}
      >
        <Pressable
          accessibilityLabel="Close dialog"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView
          style={{
            width: "100%",
            maxWidth: 520,
            maxHeight: "92%",
            backgroundColor: colors.card,
            borderRadius: 28,
            padding: 24,
          }}
        >
          <Row>
            <Label size={22} bold>
              {title}
            </Label>
            <IconButton name="close" label="Close" onPress={onClose} />
          </Row>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              gap: 18,
              paddingTop: 22,
              paddingBottom: 16,
            }}
          >
            {children}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
export function ConfirmationDialog({
  visible,
  title,
  detail,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  detail: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <Label muted>{detail}</Label>
      <AppButton label="Confirm" onPress={onConfirm} />
      <AppButton label="Cancel" variant="secondary" onPress={onClose} />
    </Sheet>
  );
}
export function Page({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { storageError } = useWorkspace();
  const [notice, setNotice] = useState(false);
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top", "left", "right"]}
    >
      <ScrollView
        contentContainerStyle={{
          padding: width > 1000 ? 34 : 20,
          paddingBottom: 120,
          gap: 26,
          maxWidth: 1600,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <Row>
          <Brand />
          <Row>
            <Badge>DEMO ACCOUNT</Badge>
            <IconButton
              name="notifications-outline"
              label="Notifications"
              onPress={() => setNotice(true)}
            />
            <IconButton
              name="person-outline"
              label="Profile"
              onPress={() => router.push("/profile")}
            />
          </Row>
        </Row>
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <Row style={{ flexWrap: "wrap" }}>
          <View style={{ gap: 4 }}>
            <Label muted size={12}>
              {subtitle}
            </Label>
            <Label size={width > 700 ? 32 : 26} bold>
              {title}
            </Label>
          </View>
          <Row>
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: tokens.lime,
              }}
            />
            <Label muted size={11}>
              SIMULATED MARKET DATA
            </Label>
          </Row>
        </Row>
        {storageError ? <ErrorState message={storageError} /> : null}
        {children}
        <Label muted size={11}>
          Pipswise simulator · Virtual money. Real learning. No brokerage
          execution.
        </Label>
      </ScrollView>
      <Sheet
        visible={notice}
        title="Notifications"
        onClose={() => setNotice(false)}
      >
        <EmptyState
          title="You're all caught up"
          detail="Order confirmations appear in your trading history. No live market alerts are connected."
          icon="notifications-outline"
        />
      </Sheet>
    </SafeAreaView>
  );
}
