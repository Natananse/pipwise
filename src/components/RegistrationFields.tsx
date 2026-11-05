import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { registrationCountry, searchRegistrationCountries } from '../lib/registrationDetails';
import { AppInput, Icon, Label, Sheet } from './design';

type Props = {
  countryCode: string;
  phoneNumber: string;
  onCountryChange: (countryCode: string) => void;
  onPhoneChange: (phoneNumber: string) => void;
  disabled?: boolean;
  required?: boolean;
};

export function RegistrationFields({ countryCode, phoneNumber, onCountryChange, onPhoneChange, disabled = false, required = true }: Props) {
  const [choosing, setChoosing] = useState(false);
  const [query, setQuery] = useState('');
  const country = registrationCountry(countryCode);
  const matches = searchRegistrationCountries(query);
  // Keep the sheet light on mobile. Every country remains available through search.
  const visibleCountries = matches.slice(0, 30);
  return <View style={{ gap: 15 }}>
    <View style={{ gap: 8 }}>
      <Label bold size={12}>Country or region{required ? '' : ' (optional)'}</Label>
      <Pressable accessibilityRole="button" accessibilityLabel="Country or region" accessibilityHint="Opens a searchable list of countries and calling codes" accessibilityState={{ disabled, expanded: choosing }} disabled={disabled} onPress={() => { setQuery(''); setChoosing(true); }} style={({ pressed }) => ({ minHeight: 54, borderRadius: 16, borderWidth: 1, borderColor: '#DDE1D6', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, backgroundColor: '#F7F8F4', opacity: disabled ? 0.5 : pressed ? 0.7 : 1 })}>
        <View style={{ flex: 1 }}><Label color={country ? '#243126' : '#747D70'} size={14}>{country ? `${country.name} (${country.dialCode})` : 'Choose your country'}</Label></View>
        <Icon name="chevron-down" size={18} color="#747D70" />
      </Pressable>
    </View>
    <AppInput label="Phone number (optional)" value={phoneNumber} onChangeText={onPhoneChange} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" autoCapitalize="none" autoCorrect={false} maxLength={40} editable={!disabled} placeholder={country ? `${country.dialCode} …` : '+251 912 345 678'} />
    <Label size={11} muted>Use + and your country calling code. This contact number is not verified by SMS and is not used to sign in.</Label>
    <Sheet visible={choosing} title="Choose your country" onClose={() => setChoosing(false)}>
      <AppInput label="Search countries" value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} placeholder="Country, region or calling code" />
      <Label size={11} muted>{matches.length > visibleCountries.length ? `Showing ${visibleCountries.length} of ${matches.length}. Type to narrow the list.` : `${matches.length} ${matches.length === 1 ? 'country or region' : 'countries and regions'}`}</Label>
      <View>{visibleCountries.map(item => <Pressable key={item.code} accessibilityRole="button" accessibilityLabel={`${item.name} ${item.dialCode}`} accessibilityState={{ selected: item.code === countryCode }} onPress={() => { onCountryChange(item.code); setChoosing(false); }} style={({ pressed }) => ({ minHeight: 50, flexDirection: 'row', gap: 12, alignItems: 'center', borderBottomWidth: 1, borderColor: '#ECEFE8', paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}>
        <View style={{ flex: 1 }}><Label size={13} bold={item.code === countryCode}>{item.name}</Label></View><Label size={12} muted>{item.dialCode}</Label>{item.code === countryCode && <Icon name="checkmark" size={18} color="#527B2B" />}
      </Pressable>)}</View>
      {!matches.length && <Label size={12} muted>No country matches. Try its name, two-letter code or calling code.</Label>}
    </Sheet>
  </View>;
}
