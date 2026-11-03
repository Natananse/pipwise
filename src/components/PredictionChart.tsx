import React from 'react';
import { View } from 'react-native';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { Candle } from '../lib/market';
import { fonts } from '../lib/theme';

/** A contained SVG chart keeps the prediction exercise identical across platforms. */
export function PredictionChart({ candles, precision, indicators, revealed, split, height = 320 }: {
  candles: Candle[]; precision: number; indicators: boolean; revealed: boolean; split: number; height?: number;
}) {
  const width = 360; const right = 314; const bottom = height - 28;
  const low = Math.min(...candles.map(item => item.low)); const high = Math.max(...candles.map(item => item.high));
  const range = Math.max(high - low, 0.0001); const min = low - range * 0.16; const max = high + range * 0.16;
  const x = (index: number) => 8 + index / Math.max(1, candles.length - 1) * (right - (revealed ? 10 : 54));
  const y = (value: number) => 40 + (max - value) / (max - min) * (bottom - 40);
  const candleWidth = Math.max(2, (right - 30) / candles.length * 0.65);
  const last = candles[candles.length - 1];
  const averagePath = candles.slice(6).map((_, i) => { const n = i + 6; const value = candles.slice(n - 6, n + 1).reduce((sum, item) => sum + item.close, 0) / 7; return `${i ? 'L' : 'M'}${x(n)},${y(value)}`; }).join(' ');
  const arrowY = y(last.close);
  return <View accessible accessibilityRole="image" accessibilityLabel={`Simulated candlestick chart, ${candles.length} candles. ${revealed ? 'The next five candles are now revealed.' : 'Future candles are hidden.'}`} style={{ borderRadius: 22, overflow: 'hidden', backgroundColor: '#315657' }}><Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
    {[0, 1, 2, 3, 4, 5].map(index => { const value = min + (max - min) * index / 5; return <React.Fragment key={index}><Line x1={0} x2={right} y1={y(value)} y2={y(value)} stroke="#FFFFFF0C" /><SvgText x={right + 7} y={y(value) + 3} fontSize={7} fill="#D5E0DE" fontFamily={fonts.medium}>{value.toFixed(precision)}</SvgText></React.Fragment>; })}
    {candles.map((item, index) => <React.Fragment key={item.time}><Line x1={x(index)} x2={x(index)} y1={y(item.high)} y2={y(item.low)} stroke={item.close >= item.open ? '#60C484' : '#F18483'} strokeWidth={0.9} /><Rect x={x(index) - candleWidth / 2} y={Math.min(y(item.open), y(item.close))} height={Math.max(1.3, Math.abs(y(item.close) - y(item.open)))} width={candleWidth} fill={item.close >= item.open ? '#60C484' : '#F18483'} /></React.Fragment>)}
    {indicators && averagePath && <Path d={averagePath} stroke="#F7D97A" strokeWidth={1.7} fill="none" />}
    {revealed ? <Line x1={x(split - 1)} x2={x(split - 1)} y1={28} y2={bottom} stroke="white" strokeDasharray="4 4" /> : <>
      <Path d={`M${right - 48},${arrowY - 6} L${right - 4},${Math.max(40, arrowY - 44)} M${right - 19},${Math.max(39, arrowY - 42)} L${right - 4},${Math.max(40, arrowY - 44)} L${right - 8},${Math.max(56, arrowY - 28)}`} stroke="#62BF7F" fill="none" strokeWidth={2.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path d={`M${right - 48},${arrowY + 6} L${right - 4},${Math.min(bottom, arrowY + 44)} M${right - 19},${Math.min(bottom - 2, arrowY + 42)} L${right - 4},${Math.min(bottom, arrowY + 44)} L${right - 8},${Math.min(bottom - 16, arrowY + 28)}`} stroke="#EE8683" fill="none" strokeWidth={2.7} strokeLinecap="round" strokeLinejoin="round" />
    </>}
    {[0, 0.5, 1].map((fraction, index) => { const candle = candles[Math.floor((candles.length - 1) * fraction)]; return <SvgText key={index} x={10 + fraction * (right - 20)} y={height - 10} textAnchor={index === 0 ? 'start' : index === 2 ? 'end' : 'middle'} fill="#D5E0DE" fontSize={8} fontFamily={fonts.medium}>{new Date(candle.time).toISOString().slice(5, 10)}</SvgText>; })}
  </Svg></View>;
}
