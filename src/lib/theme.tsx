import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

export type Mode = 'system' | 'light' | 'dark';
const light = { bg: '#F7F9FC', card: '#FFFFFF', text: '#15202B', sub: '#5B6B7C', primary: '#1F5FA8', onPrimary: '#FFFFFF', border: '#D9E1EA', danger: '#B3261E' };
const dark = { bg: '#0F1620', card: '#18222E', text: '#E8EEF4', sub: '#9AA9B8', primary: '#5E9BE0', onPrimary: '#0B1420', border: '#2A3745', danger: '#F2B8B5' };
export type Colors = typeof light;

const Ctx = createContext<{ colors: Colors; mode: Mode; setMode: (m: Mode) => void }>({ colors: light, mode: 'system', setMode: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<Mode>('system');
  useEffect(() => { AsyncStorage.getItem('theme').then((v) => v && setModeState(v as Mode)); }, []);
  const setMode = (m: Mode) => { setModeState(m); AsyncStorage.setItem('theme', m); };
  const isDark = mode === 'system' ? system === 'dark' : mode === 'dark';
  return <Ctx.Provider value={{ colors: isDark ? dark : light, mode, setMode }}>{children}</Ctx.Provider>;
}
export const useTheme = () => useContext(Ctx);
