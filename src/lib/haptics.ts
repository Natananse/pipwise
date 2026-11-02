import * as Haptics from 'expo-haptics';

/** A missing native module or unsupported device must never block an action. */
export function lightHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
