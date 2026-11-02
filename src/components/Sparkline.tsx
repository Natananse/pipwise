import React, { memo } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../lib/theme';

export const Sparkline = memo(function Sparkline({ values, color, width = 64, height = 32, loading = false }: {
  values: number[]; color?: string; width?: number; height?: number; loading?: boolean;
}) {
  const { colors } = useTheme();
  const series = values.filter(Number.isFinite);
  if (loading) return <View accessibilityLabel="Loading chart" accessibilityState={{ busy: true }} style={{ width, height, borderRadius: 8, backgroundColor: colors.sheetBorder, opacity: 0.6 }} />;
  if (!series.length) return <View accessibilityLabel="No chart data" style={{ width, height, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: width / 2, height: 1, backgroundColor: colors.sheetSub }} /></View>;
  const min = Math.min(...series);
  const span = Math.max(...series) - min;
  const path = series.map((point, index) => `${index ? 'L' : 'M'}${3 + index / Math.max(1, series.length - 1) * (width - 6)},${span ? height - 3 - (point - min) / span * (height - 6) : height / 2}`).join(' ');
  return <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} accessibilityElementsHidden importantForAccessibility="no"><Path d={path} fill="none" stroke={color || colors.sheetUp} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
});
