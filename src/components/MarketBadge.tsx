import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Asset } from '../lib/market';
import { marketVisual } from '../lib/marketVisuals';
import { fonts } from '../lib/theme';

/** Decorative pair identity; the enclosing market control supplies its label. */
export function MarketBadge({ asset, size = 40, paired = false }: {
  asset: Asset;
  size?: number;
  paired?: boolean;
}) {
  const visual = marketVisual(asset);
  const quoteSize = Math.max(16, Math.round(size * 0.4));
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={{ width: size, height: size }}>
    <View style={[styles.coin, { width: size, height: size, borderRadius: size / 2, backgroundColor: visual.color }]}>
      {asset.symbol === 'BTC/USD'
        ? <Ionicons name="logo-bitcoin" color={visual.ink} size={size * 0.67} />
        : <Text allowFontScaling={false} style={{ color: visual.ink, fontFamily: fonts.extraBold, fontSize: size * (visual.mark.length > 2 ? 0.26 : visual.mark.length > 1 ? 0.34 : 0.56), lineHeight: size * 0.8, letterSpacing: visual.mark.length > 1 ? -0.7 : 0 }}>{visual.mark}</Text>}
    </View>
    {paired && <View style={[styles.quote, { width: quoteSize, height: quoteSize, borderRadius: quoteSize / 2 }]}>
      <Text allowFontScaling={false} style={{ color: visual.ink, fontFamily: fonts.extraBold, fontSize: quoteSize * 0.56, lineHeight: quoteSize * 0.8 }}>{asset.symbol === 'USD/JPY' ? '¥' : '$'}</Text>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  coin: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FFFFFF26' },
  quote: { position: 'absolute', bottom: -2, right: -3, backgroundColor: '#F2F4EB', borderWidth: 2, borderColor: '#111614', alignItems: 'center', justifyContent: 'center' },
});
