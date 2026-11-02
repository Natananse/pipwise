import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Asset, generateCandles, price } from '../lib/market';
import { fonts, useTheme } from '../lib/theme';
import { Sparkline } from './Sparkline';

export function MarketRow({ asset, onPress, onFavorite, favorite = false, selected = false, disabled = false, loading = false, tone = 'light' }: {
  asset: Asset; onPress: () => void; onFavorite?: () => void; favorite?: boolean;
  selected?: boolean; disabled?: boolean; loading?: boolean; tone?: 'dark' | 'light';
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const series = useMemo(() => generateCandles(asset).slice(-24).map(candle => candle.close), [asset]);
  const text = tone === 'light' ? colors.sheetText : colors.darkText;
  const sub = tone === 'light' ? colors.sheetSub : colors.darkSub;
  const border = tone === 'light' ? colors.sheetBorder : colors.darkBorder;
  const raised = tone === 'light' ? colors.sheetRaised : colors.darkRaised;
  const changeColor = asset.change < 0 ? tone === 'light' ? colors.sheetDown : colors.darkDown : tone === 'light' ? colors.sheetUp : colors.darkUp;
  return <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: border, opacity: disabled ? 0.4 : 1 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${asset.symbol}, ${price(asset)}, ${asset.change < 0 ? 'down' : 'up'} ${Math.abs(asset.change)} percent`}
      accessibilityState={{ selected, disabled: disabled || loading, busy: loading }} disabled={disabled || loading} onPress={onPress}
      style={({ pressed }) => ({ flex: 1, minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 16, opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: raised }}><Text style={{ fontFamily: fonts.extraBold, fontSize: asset.mark.length > 2 ? 11 : 17, color: text }}>{asset.mark}</Text></View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}><Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 14, color: text }}>{asset.symbol}</Text><Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 11, color: sub }}>{asset.name}</Text></View>
      {width >= 390 && <Sparkline values={series} width={48} height={28} color={changeColor} loading={loading} />}
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        {loading ? <ActivityIndicator color={sub} /> : <><Text style={{ color: text, fontFamily: fonts.bold, fontSize: 13, fontVariant: ['tabular-nums'] }}>{price(asset)}</Text><View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}><Ionicons name={asset.change < 0 ? 'arrow-down' : 'arrow-up'} size={11} color={changeColor} /><Text style={{ color: changeColor, fontSize: 11, fontFamily: fonts.semibold, fontVariant: ['tabular-nums'] }}>{Math.abs(asset.change).toFixed(2)}%</Text></View>{width < 390 && <Sparkline values={series} width={40} height={18} color={changeColor} />}</>}
      </View>
    </Pressable>
    {onFavorite && <Pressable accessibilityRole="button" accessibilityLabel={`${favorite ? 'Remove' : 'Add'} ${asset.symbol} ${favorite ? 'from' : 'to'} favorites`} accessibilityState={{ selected: favorite, disabled: disabled || loading }} disabled={disabled || loading} onPress={onFavorite} style={({ pressed }) => ({ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}><Ionicons name={favorite ? 'star' : 'star-outline'} size={17} color={sub} /></Pressable>}
  </View>;
}
