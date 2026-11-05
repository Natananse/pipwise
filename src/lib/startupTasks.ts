export class StartupTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StartupTimeoutError';
    Object.setPrototypeOf(this, StartupTimeoutError.prototype);
  }
}

/** Bound startup reads without treating an unread saved value as empty data. */
export function withStartupTimeout<T>(task: PromiseLike<T>, message: string, timeoutMs = 10000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new StartupTimeoutError(message)), timeoutMs);
    Promise.resolve(task).then(value => {
      clearTimeout(timeout);
      resolve(value);
    }, error => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}
