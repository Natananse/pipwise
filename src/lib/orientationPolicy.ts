import type { RotationPreference } from './uiPreferencesStore';

export type OrientationPolicyInput = {
  publicRoute: boolean; startupCovered: boolean; onboardingRoute: boolean;
  onboardingPreviewActive: boolean; setupComplete: boolean; preferencesLoaded: boolean;
  rotation: RotationPreference;
};

/** Public documents never acquire setup dependencies merely to select an orientation. */
export function desiredOrientation(input: OrientationPolicyInput): RotationPreference {
  if (input.publicRoute) return input.preferencesLoaded ? input.rotation : 'portrait';
  if (input.startupCovered || input.onboardingRoute || input.onboardingPreviewActive
    || !input.setupComplete || !input.preferencesLoaded) return 'portrait';
  return input.rotation;
}

export type OrientationStatus = { desired: RotationPreference; applied: RotationPreference | null; pending: boolean; error: string };
const nativeError = 'Rotation could not be updated on this device. You can keep using the app and try again.';

/** Only one physical native request runs at once; superseded requests never restore old policies. */
export function createOrientationController(apply: (policy: RotationPreference) => Promise<void>, publish: (status: OrientationStatus) => void = () => {}) {
  let desired: RotationPreference = 'portrait';
  let applied: RotationPreference | null = null;
  let running = false;
  let active = true;
  let disposed = false;
  let force = 0;
  let completedForce = -1;
  let blocked = false;
  let error = '';
  let deadline: ReturnType<typeof setTimeout> | null = null;
  const report = () => {
    if (!disposed) publish({ desired, applied, pending: running || applied !== desired, error });
  };
  const drain = async () => {
    if (running || disposed || !active || blocked || applied === desired && completedForce === force) return;
    running = true;
    report();
    while (!disposed && active) {
      const target = desired;
      const attempt = force;
      // A missing native response must not hold any startup or route rendering.
      // Keep the physical request serialized even after this diagnostic deadline.
      deadline = setTimeout(() => { error = nativeError; report(); }, 1500);
      try {
        await apply(target);
        if (deadline !== null) clearTimeout(deadline);
        deadline = null;
        if (disposed) break;
        applied = target;
        completedForce = attempt;
        error = '';
        blocked = false;
      } catch {
        if (deadline !== null) clearTimeout(deadline);
        deadline = null;
        if (disposed) break;
        error = nativeError;
        // A newer intent may still be applied; a failed current request waits for retry.
        blocked = target === desired && attempt === force;
      }
      if (blocked || applied === desired && completedForce === force) break;
    }
    running = false;
    report();
  };
  return {
    request(policy: RotationPreference) {
      if (disposed) return;
      if (desired !== policy) { desired = policy; blocked = false; }
      void drain();
      report();
    },
    setActive(next: boolean) {
      if (disposed) return;
      active = next;
      if (!next && deadline !== null) { clearTimeout(deadline); deadline = null; }
      if (next) {
        blocked = false; force++; void drain();
        if (running && deadline === null) deadline = setTimeout(() => { error = nativeError; report(); }, 1500);
      }
    },
    retry() { if (!disposed) { blocked = false; force++; void drain(); } },
    dispose() { disposed = true; if (deadline !== null) clearTimeout(deadline); },
  };
}
