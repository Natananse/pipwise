type Snapshot = { active: boolean; enabled: boolean; hidden: boolean; fullScreen: boolean; blocked: boolean };
const initial: Snapshot = { active: false, enabled: false, hidden: false, fullScreen: false, blocked: false };

/** One owner for timers; touching the screen only observes input, never consumes it. */
export function createTradeChrome(timer: typeof setTimeout = setTimeout, clear: typeof clearTimeout = clearTimeout) {
  let snapshot = initial;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const emit = (next: Snapshot) => {
    if (Object.keys(next).every(key => next[key as keyof Snapshot] === snapshot[key as keyof Snapshot])) return;
    snapshot = next; listeners.forEach(listener => listener());
  };
  const stop = () => { if (timeout !== undefined) clear(timeout); timeout = undefined; };
  const arm = () => {
    stop();
    if (snapshot.active && snapshot.enabled && !snapshot.blocked) timeout = timer(() => {
      timeout = undefined; emit({ ...snapshot, hidden: true });
    }, 3000);
  };
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initial,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    configure(active: boolean, enabled: boolean, fullScreen = false, blocked = false) {
      emit({ active, enabled, fullScreen, blocked, hidden: active && enabled && !blocked ? snapshot.hidden : false }); arm();
    },
    reveal() { emit({ ...snapshot, hidden: false }); arm(); },
    hide() { if (snapshot.active && snapshot.enabled && !snapshot.blocked) { stop(); emit({ ...snapshot, hidden: true }); } },
    release() { stop(); emit(initial); },
  };
}

export const tradeChrome = createTradeChrome();
