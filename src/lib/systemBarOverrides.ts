/** Startup covers must win even when a route finishes mounting underneath them. */
export function createSystemBarOverrides() {
  const owners = new Set<symbol>();
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(listener => listener());
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getSnapshot: () => owners.size > 0,
    acquire() {
      const owner = Symbol('system-bar-cover');
      owners.add(owner);
      emit();
      return () => {
        if (owners.delete(owner)) emit();
      };
    },
  };
}
