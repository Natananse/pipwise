import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fitChartHeight, responsiveLayout } from '../lib/responsiveLayout';
import { getProviderChart } from '../lib/providerCharts';
import { Icon, Label, Row } from './design';
import TradingViewWidget from './TradingViewWidget';

export function ProviderChart({ symbol, height = 420 }: { symbol: string; height?: number }) {
  const chart = getProviderChart(symbol);
  const layout = responsiveLayout({ ...useWindowDimensions(), insets: useSafeAreaInsets() });
  const preferred = Math.min(720, Number.isFinite(height) ? height : 420);
  const chartHeight = layout.compactHeight ? fitChartHeight(Math.max(140, layout.usableHeight - 120), preferred, 140) : Math.max(300, preferred);
  const [linkError, setLinkError] = useState('');
  if (!chart) return <Label size={12} color="#FF9DA5">This market has no configured provider chart.</Label>;
  const open = async () => {
    setLinkError('');
    try { await WebBrowser.openBrowserAsync(chart.url); }
    catch { setLinkError('The official chart could not be opened. Please try again.'); }
  };
  return <View style={{ gap: 8 }}>
    <View style={{ height: chartHeight, borderRadius: 16, overflow: 'hidden', backgroundColor: '#131722' }}>
      <TradingViewWidget key={chart.providerSymbol} symbol={symbol} height={chartHeight} dom={{ style: { height: chartHeight, width: '100%', backgroundColor: '#131722' }, scrollEnabled: false, unstable_useExpoModulesBridge: false }} />
    </View>
    <Row style={{ gap: 8, flexWrap: 'wrap' }}><Label size={10} color="#A0AAA2" style={{ flex: 1 }}>Chart and data by TradingView · Availability and delays vary by instrument.</Label><Pressable accessibilityRole="link" accessibilityLabel={`Open ${chart.title} on TradingView`} onPress={() => { void open(); }} style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, opacity: pressed ? 0.6 : 1 })}><Label bold size={11} color="#6EE7BE">Open chart</Label><Icon name="open-outline" size={15} color="#6EE7BE" /></Pressable></Row>
    {!!linkError && <Label size={11} color="#FF9DA5">{linkError}</Label>}
  </View>;
}

export default ProviderChart;
