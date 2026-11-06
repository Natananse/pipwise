const activeWrites = new Set<Promise<unknown>>();
let resetInProgress = false;

/** Stop queued old saves before erasing a deleted account's local workspace. */
export async function pausePersistenceForAccountDeletion() {
  resetInProgress = true;
  await Promise.allSettled([...activeWrites]);
}

/** Called only after providers have remounted with an empty workspace. */
export function resumePersistenceAfterAccountDeletion() { resetInProgress = false; }

/** Serialize writes so a slower older save cannot replace newer preferences. */
export function createPersistenceQueue() {
  let pending: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = pending.then(() => resetInProgress ? undefined as T : operation());
    activeWrites.add(result);
    void result.then(() => activeWrites.delete(result), () => activeWrites.delete(result));
    // Keep the queue usable after a failed write, while rejecting its caller.
    pending = result.catch(() => undefined);
    return result;
  };
}
