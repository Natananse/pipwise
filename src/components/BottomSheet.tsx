import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { ThemeSurface, useTheme } from '../lib/theme';
import { ContentState } from './ContentState';

/** In-flow surface: scrolling and modal behaviour remain with the caller. */
export function BottomSheet({ children, style, loading = false, disabled = false }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; loading?: boolean; disabled?: boolean;
}) {
  const { colors } = useTheme();
  return <ThemeSurface tone="light"><View accessibilityState={{ busy: loading, disabled }} style={[{ backgroundColor: colors.sheet, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 24, gap: 24, opacity: disabled ? 0.5 : 1 }, style]}>
    <View accessible={false} style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.sheetBorder, alignSelf: 'center' }} />
    {loading ? <ContentState kind="skeleton" tone="light" /> : <View pointerEvents={disabled ? 'none' : 'auto'} style={{ gap: 24 }}>{children}</View>}
  </View></ThemeSurface>;
}
