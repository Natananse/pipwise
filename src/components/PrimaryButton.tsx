import { Ionicons } from '@expo/vector-icons';
import { lightHaptic } from '../lib/haptics';
import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, Text, ViewStyle } from 'react-native';
import { fonts, useTheme } from '../lib/theme';

export type ActionButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  tone?: 'dark' | 'light';
  haptic?: boolean;
  accessibilityLabel?: string;
};

/** Shared touch treatment keeps primary and secondary actions consistent. */
export function PillButton({
  label, onPress, disabled = false, loading = false, icon, style,
  tone = 'dark', haptic = false, accessibilityLabel, variant = 'primary',
  intent = 'neutral',
}: ActionButtonProps & { variant?: 'primary' | 'ghost'; intent?: 'neutral' | 'negative' }) {
  const { colors } = useTheme();
  const primary = variant === 'primary';
  const foreground = primary ? colors.onPrimary : intent === 'negative'
    ? tone === 'light' ? colors.sheetDown : colors.darkDown
    : tone === 'light' ? colors.sheetText : colors.darkText;
  const background = primary ? colors.primary : tone === 'light' ? colors.sheetRaised : colors.darkRaised;
  const blocked = disabled || loading;
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel || label}
    accessibilityState={{ disabled: blocked, busy: loading }}
    disabled={blocked}
    onPress={() => {
      if (haptic) lightHaptic();
      onPress();
    }}
    style={({ pressed }) => [{
      minHeight: 56, borderRadius: 999, paddingHorizontal: 24, paddingVertical: 16,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: background, opacity: disabled ? 0.4 : pressed ? 0.72 : 1,
      borderWidth: primary ? 0 : 1,
      borderColor: tone === 'light' ? colors.sheetBorder : colors.darkBorder,
    }, style]}
  >
    {loading ? <ActivityIndicator color={foreground} /> : <>
      {icon && <Ionicons name={icon} size={20} color={foreground} />}
      <Text style={{ fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, color: foreground, textAlign: 'center' }}>{label}</Text>
    </>}
  </Pressable>;
}

export function PrimaryButton(props: ActionButtonProps) {
  return <PillButton {...props} variant="primary" />;
}
