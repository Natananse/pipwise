import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** null keeps entrance animations paused until the device preference is known. */
export function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(value => { if (active) setReducedMotion(value); })
      .catch(() => { if (active) setReducedMotion(true); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  return reducedMotion;
}
