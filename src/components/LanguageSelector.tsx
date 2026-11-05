import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Language, languages } from '../lib/languages';
import { fonts } from '../lib/theme';
import { Icon } from './design';

export function LanguageSelector({ value, onSelect, disabled = false, light = false }: {
  value: Language; onSelect: (language: Language) => void; disabled?: boolean; light?: boolean;
}) {
  const rtl = languages.find(language => language.code === value)?.rtl ?? false;
  return <View accessibilityRole="radiogroup" accessibilityLabel="Language" style={[styles.grid, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
    {languages.map(language => {
      const selected = language.code === value;
      const foreground = selected || light ? '#0D1011' : '#F4F3EF';
      return <Pressable key={language.code} accessibilityRole="radio" accessibilityLabel={`${language.nativeName} (${language.name})`} accessibilityState={{ checked: selected, disabled }} aria-checked={selected} disabled={disabled} onPress={() => onSelect(language.code)} style={({ pressed }) => [styles.card, { flexDirection: rtl ? 'row-reverse' : 'row', backgroundColor: selected ? '#C8F169' : light ? '#FFFFFF' : '#161A1B', borderColor: selected ? '#A5CE4E' : light ? '#E0E3DC' : '#2A3032', opacity: disabled ? 0.55 : pressed ? 0.7 : 1 }]}>
        <View style={[styles.mark, { backgroundColor: selected ? '#0D1011' : light ? '#F0F1EB' : '#242B2A' }]}><Text allowFontScaling={false} style={{ fontFamily: fonts.bold, fontSize: 12, color: selected ? '#C8F169' : foreground }}>{language.mark}</Text></View>
        <View style={styles.names}><Text style={{ fontFamily: fonts.bold, fontSize: 13, lineHeight: 19, color: foreground, writingDirection: language.rtl ? 'rtl' : 'ltr', textAlign: rtl ? 'right' : 'left' }}>{language.nativeName}</Text><Text style={{ fontFamily: fonts.medium, fontSize: 9, lineHeight: 13, color: selected ? '#465822' : light ? '#6C756B' : '#A3AAA7', textAlign: rtl ? 'right' : 'left' }}>{language.name}</Text></View>
        {selected && <View style={[styles.selectedMark, rtl ? { left: 6 } : { right: 6 }]}><Icon name="checkmark" size={9} color="#0D1011" /></View>}
      </Pressable>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  grid: { flexWrap: 'wrap', gap: 9 },
  card: { flexBasis: '46%', flexGrow: 1, minWidth: 0, minHeight: 73, paddingHorizontal: 10, paddingVertical: 11, borderRadius: 17, borderWidth: 1, alignItems: 'center', gap: 9 },
  mark: { width: 29, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  names: { flex: 1, minWidth: 0, gap: 2 },
  selectedMark: { position: 'absolute', top: 5, width: 13, height: 13, borderRadius: 7, backgroundColor: '#B8DF5C', alignItems: 'center', justifyContent: 'center' },
});
