import React from 'react';
import { Image } from 'react-native';

/** Shared with the app icon and native splash paths in app.json. */
export function AppLogo({ size = 40, decorative = false }: { size?: number; decorative?: boolean }) {
  return <Image
    source={require('../../assets/android-icon-backgrounds.png')}
    accessible={!decorative}
    accessibilityLabel={decorative ? undefined : 'Pipwise logo'}
    resizeMode="contain"
    style={{ width: size, height: size, borderRadius: size * 0.2 }}
  />;
}
