import { NavigationBar } from 'expo-navigation-bar';
import { useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, { useEffect, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { createSystemBarOverrides } from '../lib/systemBarOverrides';

type IconStyle = 'light' | 'dark';
type Props = { style: IconStyle; navigationStyle?: IconStyle; backgroundColor: string };
const startupCovers = createSystemBarOverrides();
const noServerCover = () => false;

function Bars({ style, navigationStyle = style, backgroundColor }: Props) {
  useEffect(() => {
    // Match exposed window pixels to the existing screen, without painting an
    // opaque system bar or changing the user's appearance preference.
    if (Platform.OS !== 'web') void SystemUI.setBackgroundColorAsync(backgroundColor).catch(() => undefined);
  }, [backgroundColor]);
  return <>
    <StatusBar style={style} hidden={false} />
    {Platform.OS === 'android' && <NavigationBar style={navigationStyle} hidden={false} />}
  </>;
}

/** Kept-alive tabs must release their bar entries when another route is focused. */
export function ScreenSystemBars(props: Props) {
  const focused = useIsFocused();
  const covered = useSyncExternalStore(startupCovers.subscribe, startupCovers.getSnapshot, noServerCover);
  return focused && !covered ? <Bars {...props} /> : null;
}

/** Outside the navigator: retain the dark welcome/retry cover's bar ownership. */
export function StartupSystemBars() {
  useEffect(() => startupCovers.acquire(), []);
  return <Bars style="light" backgroundColor="#0D1011" />;
}

/** The dimmed top needs light icons; a bottom sheet paints a light bottom surface. */
export function ModalSystemBars({ centered = false }: { centered?: boolean }) {
  return <>
    <StatusBar style="light" hidden={false} />
    {Platform.OS === 'android' && <NavigationBar style={centered ? 'light' : 'dark'} hidden={false} />}
  </>;
}
