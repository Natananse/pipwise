import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { AppLogo } from './AppLogo';

export type AvatarId = 'owl' | 'bull' | 'trader';

/** Small local illustrations keep profile avatars available offline. */
export function AvatarPortrait({ avatar = 'trader', size = 96 }: { avatar?: AvatarId; size?: number }) {
  if (avatar === 'bull') return <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#080C0D' }}><AppLogo size={size * 0.85} decorative /></View>;
  if (avatar === 'owl') return <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityLabel="Owl avatar">
    <Circle cx={60} cy={60} r={60} fill="#E7E5FE" />
    <Path d="M30 43L25 23L49 34H71L95 23L90 43V70C90 89 77 101 60 105C43 101 30 89 30 70Z" fill="#7B70BE" />
    <Ellipse cx={45} cy={58} rx={20} ry={23} fill="#F9F4E9" /><Ellipse cx={75} cy={58} rx={20} ry={23} fill="#F9F4E9" />
    <Circle cx={47} cy={57} r={10} fill="#243D54" /><Circle cx={73} cy={57} r={10} fill="#243D54" />
    <Circle cx={50} cy={54} r={3.5} fill="#FFFFFF" /><Circle cx={76} cy={54} r={3.5} fill="#FFFFFF" />
    <Path d="M51 75L60 87L69 75Z" fill="#F3C259" /><Path d="M39 87L49 96M81 87L71 96" stroke="#AFA4DE" strokeWidth={5} strokeLinecap="round" />
  </Svg>;
  return <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityLabel="Trader avatar">
    <Circle cx={60} cy={60} r={60} fill="#FFF1E7" />
    <Path d="M10 120C16 96 33 90 49 87H71C89 90 105 101 112 120Z" fill="#EAAB77" />
    <Path d="M47 81V96L60 107L74 96V80" fill="#F2B58B" />
    <Path d="M43 90L60 101L77 90L73 111L60 104L47 111Z" fill="#238A9B" />
    <Ellipse cx={34} cy={56} rx={6} ry={10} fill="#EEAE84" /><Ellipse cx={87} cy={56} rx={6} ry={10} fill="#EEAE84" />
    <Path d="M34 40C34 21 86 20 86 41V65C86 83 74 94 60 94C46 94 34 83 34 65Z" fill="#F7C298" />
    <Path d="M34 52C25 36 31 18 47 16C51 5 76 8 86 23C98 31 92 46 86 53L80 37C67 40 53 35 43 30L40 52Z" fill="#AAA295" />
    <Path d="M38 26C49 14 65 13 82 24" stroke="#DAD0BD" strokeWidth={5} strokeLinecap="round" fill="none" />
    <Path d="M44 43L52 42M68 42L77 43" stroke="#8E8072" strokeWidth={3} strokeLinecap="round" />
    <Circle cx={47} cy={54} r={10} fill="none" stroke="#354F61" strokeWidth={2.5} /><Circle cx={74} cy={54} r={10} fill="none" stroke="#354F61" strokeWidth={2.5} />
    <Path d="M57 53H64M36 52L31 50M85 52L90 50" stroke="#354F61" strokeWidth={2.5} />
    <Circle cx={48} cy={54} r={2.5} fill="#354F61" /><Circle cx={73} cy={54} r={2.5} fill="#354F61" />
    <Path d="M60 57L57 67H64" fill="none" stroke="#D99572" strokeWidth={2} strokeLinecap="round" />
    <Path d="M44 71C51 62 56 67 60 68C64 67 69 62 77 71C70 79 65 76 60 74C55 76 50 79 44 71Z" fill="#A09283" />
    <Path d="M53 81C57 85 65 85 69 80" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" fill="none" />
    <Rect x={88} y={106} width={5} height={14} rx={2} fill="#D78F5F" />
  </Svg>;
}
