import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** null keeps entrance animations paused until the device preference is known. */
export function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    // A missing native callback must not hold the launch screen indefinitely.
    const fallback = setTimeout(() => { if (active) setReducedMotion(true); }, 1000);
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(value => { clearTimeout(fallback); if (active) setReducedMotion(value); })
      .catch(() => { clearTimeout(fallback); if (active) setReducedMotion(true); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { active = false; clearTimeout(fallback); subscription.remove(); };
  }, []);
  return reducedMotion;
}
