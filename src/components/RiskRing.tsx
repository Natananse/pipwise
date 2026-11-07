import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { money } from '../lib/market';
import { type OrderRisk } from '../lib/orderRisk';
import { Label } from './design';

export function RiskRing({ risk }: { risk: OrderRisk }) {
  const ready = 'percent' in risk;
  const color = ready ? ({ green: '#18754D', amber: '#8A641B', red: '#B33F48' } as const)[risk.band] : '#62695F';
  const circumference = 2 * Math.PI * 23;
  return <View accessibilityLabel={ready ? `Estimated loss at manual stop target ${risk.percent.toFixed(2)} percent of available balance` : risk.reason} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
    <View style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={56} height={56} viewBox="0 0 56 56" style={{ position: 'absolute' }} accessible={false}><Circle cx={28} cy={28} r={23} stroke="#DDE2D7" strokeWidth={4} fill="none" /><Circle cx={28} cy={28} r={23} stroke={color} strokeWidth={4} fill="none" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - (ready ? Math.min(1, risk.percent / 3) : 0))} rotation={-90} origin="28,28" strokeLinecap="round" /></Svg>
      <Label bold size={11} color={color}>{ready ? `${risk.percent.toFixed(1)}%` : '—'}</Label>
    </View>
    <View style={{ flex: 1, gap: 3 }}><Label bold size={13}>Risk at stop target</Label><Label muted size={11}>{ready ? `${money(risk.amount)} · ${risk.percent.toFixed(2)}% of available balance, including fees` : risk.reason}</Label><Label muted size={10}>Manual target · no automatic exit or guaranteed loss limit</Label></View>
  </View>;
}
