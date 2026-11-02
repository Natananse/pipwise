import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { fonts, useTheme } from '../lib/theme';

export function PairChip({ label, subtitle, mark, selected = false, onPress, disabled = false, loading = false }: {
  label: string; subtitle?: string; mark?: string; selected?: boolean; onPress: () => void;
  disabled?: boolean; loading?: boolean;
}) {
  const { colors } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={subtitle ? `${label}, ${subtitle}` : label}
    accessibilityState={{ selected, disabled: disabled || loading, busy: loading }}
    disabled={disabled || loading} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: selected ? colors.activeTab : colors.darkSurface, borderWidth: 1, borderColor: selected ? colors.activeTab : colors.darkBorder, opacity: disabled ? 0.4 : pressed ? 0.65 : 1 })}
  >
    {loading ? <ActivityIndicator size="small" color={selected ? colors.onActiveTab : colors.darkText} /> : <>
      {mark && <View style={{ height: 28, minWidth: 28, paddingHorizontal: 4, borderRadius: 14, backgroundColor: selected ? colors.sheetRaised : colors.darkRaised, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: selected ? colors.sheetText : colors.darkText, fontSize: 12, fontFamily: fonts.bold }}>{mark}</Text></View>}
      <View><Text style={{ color: selected ? colors.onActiveTab : colors.darkText, fontSize: 13, fontFamily: fonts.bold }}>{label}</Text>{subtitle && <Text style={{ color: selected ? colors.sheetSub : colors.darkSub, fontSize: 10, fontFamily: fonts.medium }}>{subtitle}</Text>}</View>
      {selected && <Ionicons name="checkmark" size={16} color={colors.onActiveTab} />}
    </>}
  </Pressable>;
}
