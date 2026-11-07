import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { money } from '../lib/market';
import { useTheme } from '../lib/theme';
import { Label, Row } from './design';

export function EquityCurve({ values, height = 190 }: { values: number[]; height?: number }) {
  const { colors } = useTheme();
  const low = Math.min(...values);
  const high = Math.max(...values);
  const padding = Math.max((high - low) * 0.15, 1);
  const min = low - padding;
  const max = high + padding;
  const y = (v: number) => 164 - (v - min) / (max - min) * 144;
  const points = values.length === 1 ? [values[0], values[0]] : values;
  const path = points.map((v, i) => `${i ? 'L' : 'M'}${8 + i / (points.length - 1) * 584},${y(v)}`).join(' ');
  const color = values[values.length - 1] >= values[0] ? colors.up : colors.down;
  return <View style={{ gap: 8 }}>
    <Row><Label muted size={10}>{money(high)}</Label><Label muted size={10}>Closed-trade balance · USD</Label></Row>
    <Svg width="100%" height={height} viewBox="0 0 600 190" preserveAspectRatio="none" accessible accessibilityLabel={`Closed-trade balance curve. Starting ${money(values[0])}, ending ${money(values[values.length - 1])}. ${values.length - 1} closed trades.`}>
      {[20, 92, 164].map(v => <Line key={v} x1={8} x2={592} y1={v} y2={v} stroke={colors.border} strokeDasharray="4 6" />)}
      <Path d={`${path} L592,180 L8,180 Z`} fill={color} fillOpacity={0.08} />
      <Path d={path} stroke={color} strokeWidth={2.5} fill="none" />
      <Circle cx={592} cy={y(points[points.length - 1])} r={4} fill={color} />
    </Svg>
    <Row><Label muted size={10}>Start · {money(values[0])}</Label><Label muted size={10}>{values.length - 1} closed trades</Label></Row>
  </View>;
}
