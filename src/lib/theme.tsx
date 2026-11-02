import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

export type Mode = 'system' | 'light' | 'dark';
export const fonts = {
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extraBold: 'Manrope_800ExtraBold',
};
const palette = {
  primary: '#C8F169', onPrimary: '#0D1011',
  darkBg: '#0D1011', darkSurface: '#161A1B', darkRaised: '#1D2224',
  darkText: '#F4F3EF', darkSub: '#A3AAA7', darkBorder: '#2A3032',
  darkUp: '#C8F169', darkDown: '#F08A82',
  sheet: '#F4F3EF', sheetText: '#0D1011', sheetSub: '#5C615F',
  sheetBorder: '#DDDFD8', sheetRaised: '#E8E9E2', sheetUp: '#117A4B', sheetDown: '#B83A33',
  tab: '#161A1B', activeTab: '#FFFFFF', onActiveTab: '#0D1011',
  overlay: '#00000099', transparent: 'transparent',
};
const light = {
  ...palette, bg: palette.sheet, card: palette.sheet, raised: palette.sheetRaised,
  text: palette.sheetText, sub: palette.sheetSub, border: palette.sheetBorder,
  danger: palette.sheetDown, up: palette.sheetUp, down: palette.sheetDown,
};
const dark: typeof light = {
  ...palette, bg: palette.darkBg, card: palette.darkSurface, raised: palette.darkRaised,
  text: palette.darkText, sub: palette.darkSub, border: palette.darkBorder,
  danger: palette.darkDown, up: palette.darkUp, down: palette.darkDown,
};
export type Colors = typeof light;
const Ctx = createContext<{ colors: Colors; mode: Mode; setMode: (m: Mode) => void }>({ colors: dark, mode: 'dark', setMode: () => {} });
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<Mode>('dark');
  useEffect(() => { AsyncStorage.getItem('theme').then((v) => v && setModeState(v as Mode)); }, []);
  const setMode = (m: Mode) => { setModeState(m); AsyncStorage.setItem('theme', m); };
  const isDark = mode === 'system' ? system === 'dark' : mode === 'dark';
  return <Ctx.Provider value={{ colors: isDark ? dark : light, mode, setMode }}>{children}</Ctx.Provider>;
}
/** A visual surface override; the user's saved appearance preference is untouched. */
export function ThemeSurface({ tone, children }: { tone: 'light' | 'dark'; children: React.ReactNode }) {
  const theme = useContext(Ctx);
  return <Ctx.Provider value={{ ...theme, colors: tone === 'light' ? light : dark }}>{children}</Ctx.Provider>;
}
export const useTheme = () => useContext(Ctx);
