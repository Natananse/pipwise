import { requireOptionalNativeModule } from 'expo';

export class SecureStorageUnavailableError extends Error {
  readonly code = 'NATIVE_SECURE_STORAGE_UNAVAILABLE';

  constructor() {
    super('This installed app is missing secure sign-in storage. Rebuild and install the latest native app, then reopen it. Reloading JavaScript alone cannot add this native module.');
    this.name = 'SecureStorageUnavailableError';
    Object.setPrototypeOf(this, SecureStorageUnavailableError.prototype);
  }
}

/** Probe before evaluating SecureStore: Metro treats a missing native import as fatal. */
export async function loadSecureStore(): Promise<typeof import('expo-secure-store')> {
  if (!requireOptionalNativeModule('ExpoSecureStore')) throw new SecureStorageUnavailableError();
  return import('expo-secure-store');
}
