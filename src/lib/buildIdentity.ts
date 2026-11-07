export const TRADE_UI_MARKER = 'Trade UI: Rotate 1';

type BuildIdentityInput = {
  platform: string;
  executionEnvironment: string;
  nativeVersion: string | null;
  nativeBuild: string | null;
};

function displayValue(value: string | null) {
  return value?.trim() || 'Unknown';
}

/** Config/OTA metadata cannot establish which native binary is installed. */
export function formatBuildIdentity({ platform, executionEnvironment, nativeVersion, nativeBuild }: BuildIdentityInput) {
  if (platform === 'web') return { marker: TRADE_UI_MARKER, details: 'Preview · Browser', preview: true };
  if (executionEnvironment === 'storeClient') return { marker: TRADE_UI_MARKER, details: 'Preview · Expo Go / development client', preview: true };
  if (platform !== 'android' && platform !== 'ios') return { marker: TRADE_UI_MARKER, details: 'Preview · Native build identity unavailable', preview: true };
  return {
    marker: TRADE_UI_MARKER,
    details: `App version: ${displayValue(nativeVersion)} · Build: ${displayValue(nativeBuild)}`,
    preview: false,
  };
}
