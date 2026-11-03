/** Serialize writes so a slower older save cannot replace newer preferences. */
export function createPersistenceQueue() {
  let pending: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = pending.then(operation);
    // Keep the queue usable after a failed write, while rejecting its caller.
    pending = result.catch(() => undefined);
    return result;
  };
}
