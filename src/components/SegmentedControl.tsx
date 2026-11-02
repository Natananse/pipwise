import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { fonts, useTheme } from '../lib/theme';

export function SegmentedControl({ options, value, onChange, disabled = false, loading = false, tone = 'dark' }: {
  options: string[]; value: string; onChange: (value: string) => void;
  disabled?: boolean; loading?: boolean; tone?: 'dark' | 'light';
}) {
  const { colors } = useTheme();
  const foreground = tone === 'light' ? colors.sheetText : colors.darkText;
  const muted = tone === 'light' ? colors.sheetSub : colors.darkSub;
  const surface = tone === 'light' ? colors.sheetRaised : colors.darkSurface;
  return <View accessibilityRole="tablist" accessibilityState={{ busy: loading }} style={{ flexDirection: 'row', backgroundColor: surface, borderRadius: 999, padding: 4, opacity: disabled ? 0.4 : 1 }}>
    {options.map(option => <Pressable key={option}
      accessibilityRole="tab" accessibilityLabel={option}
      accessibilityState={{ selected: option === value, disabled: disabled || loading }}
      disabled={disabled || loading} onPress={() => onChange(option)}
      style={({ pressed }) => ({ flex: 1, minHeight: 44, paddingHorizontal: 4, borderRadius: 999, justifyContent: 'center', alignItems: 'center', backgroundColor: option === value ? colors.activeTab : surface, opacity: pressed ? 0.65 : 1 })}
    ><Text style={{ fontFamily: fonts.bold, fontSize: 12, color: option === value ? colors.onActiveTab : muted }}>{option}</Text></Pressable>)}
    {loading && <View pointerEvents="none" style={{ position: 'absolute', inset: 0, justifyContent: 'center', alignItems: 'center', borderRadius: 999, backgroundColor: surface }}><ActivityIndicator color={foreground} /></View>}
  </View>;
}
