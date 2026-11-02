import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';
import { fonts, useTheme } from '../lib/theme';
import { GhostButton } from './GhostButton';

export function ContentState({ kind, title, detail, onRetry, tone = 'dark' }: {
  kind: 'skeleton' | 'empty' | 'error'; title?: string; detail?: string; onRetry?: () => void;
  tone?: 'dark' | 'light';
}) {
  const { colors } = useTheme();
  const text = tone === 'light' ? colors.sheetText : colors.darkText;
  const muted = tone === 'light' ? colors.sheetSub : colors.darkSub;
  const fill = tone === 'light' ? colors.sheetBorder : colors.darkRaised;
  if (kind === 'skeleton') return <View accessibilityLabel={title || 'Loading content'} accessibilityState={{ busy: true }} style={{ gap: 24, paddingVertical: 16 }}>{[0, 1, 2].map(index => <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}><View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: fill }} /><View style={{ flex: 1, gap: 8 }}><View style={{ height: 12, width: '60%', borderRadius: 6, backgroundColor: fill }} /><View style={{ height: 8, width: '40%', borderRadius: 4, backgroundColor: fill }} /></View><View style={{ width: 56, height: 12, borderRadius: 6, backgroundColor: fill }} /></View>)}</View>;
  return <View accessibilityRole={kind === 'error' ? 'alert' : undefined} style={{ alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16, gap: 16 }}>
    <Ionicons name={kind === 'error' ? 'alert-circle-outline' : 'layers-outline'} size={32} color={muted} />
    <Text style={{ color: text, fontFamily: fonts.bold, fontSize: 17, textAlign: 'center' }}>{title || (kind === 'error' ? 'Something went wrong' : 'Nothing here yet')}</Text>
    {detail && <Text style={{ color: muted, fontFamily: fonts.medium, fontSize: 13, lineHeight: 21, textAlign: 'center', maxWidth: 320 }}>{detail}</Text>}
    {kind === 'error' && onRetry && <GhostButton label="Try again" onPress={onRetry} tone={tone} icon="refresh-outline" />}
  </View>;
}
