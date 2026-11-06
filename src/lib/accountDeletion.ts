import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { clearRegistrationAfterAccountDeletion } from './accountDetails';
import { clearAuthAfterAccountDeletion, getAccountDeletionCredentials, lockAuthForAccountDeletion, subscribeAuth } from './neonAuth';
import { pausePersistenceForAccountDeletion } from './persistence';
import { createDemoMarket, demoMarket } from './demoMarket';

export class AccountDeletionError extends Error {
  constructor(message: string, readonly code?: string, readonly deletedAccountId?: string) { super(message); this.name = 'AccountDeletionError'; }
}

export function accountDeletionEndpoint() {
  if (Platform.OS === 'web') return '/api/delete-account';
  try {
    const url = new URL(process.env.EXPO_PUBLIC_APP_API_URL || process.env.EXPO_PUBLIC_NATIVE_AUTH_RETURN_URL || '');
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
      || /^(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(url.hostname)) throw new Error();
    return `${url.origin}/api/delete-account`;
  } catch { throw new AccountDeletionError('Account deletion is unavailable until the app service is configured.'); }
}

/** No account identifier or privileged key is accepted by the server from the body. */
export async function requestAccountDeletion(expectedAccountId?: string): Promise<void> {
  const endpoint = accountDeletionEndpoint();
  let changed = false;
  let accountId = expectedAccountId;
  const unsubscribe = subscribeAuth(next => { if (accountId && next && next.user.id !== accountId) changed = true; });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const credentials = await getAccountDeletionCredentials(expectedAccountId);
    accountId = credentials.accountId;
    if (changed) throw new AccountDeletionError('Your account changed. Reopen account deletion.');
    const response = await fetch(endpoint, {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${credentials.token}`, 'X-Pipwise-Session': credentials.sessionToken, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ confirmation: 'DELETE' }),
    });
    const body: unknown = await response.json().catch(() => null);
    const result = body && typeof body === 'object' ? body as { deleted?: unknown; error?: { code?: unknown; message?: unknown } } : {};
    if (!response.ok) throw new AccountDeletionError(
      typeof result.error?.message === 'string' && result.error.message.length <= 400 ? result.error.message : 'Your account could not be deleted. Please try again.',
      typeof result.error?.code === 'string' ? result.error.code : undefined,
    );
    if (result.deleted !== true) throw new AccountDeletionError('The service did not confirm deletion. Please try again.');
    if (changed) throw new AccountDeletionError('Your previous account was deleted. Your current account and local data have been preserved.', 'DELETED_ACCOUNT_CHANGED', accountId);
  } catch (error) {
    if (controller.signal.aborted) throw new AccountDeletionError('The deletion request timed out. Sign in again to check your account before retrying.');
    throw error;
  } finally { clearTimeout(timeout); unsubscribe(); }
}

/** Wait for old writes before erasing only this app's keys, never unrelated storage. */
let physicalCleanup: { accountId?: string; promise: Promise<void> } | null = null;
export function clearDeletedAccountLocalData(expectedAccountId?: string): Promise<void> {
  if (physicalCleanup) {
    if (expectedAccountId && physicalCleanup.accountId && expectedAccountId !== physicalCleanup.accountId)
      return Promise.reject(new AccountDeletionError('Your previous account was deleted. Your current account and local data have been preserved.', 'DELETED_ACCOUNT_CHANGED', expectedAccountId));
    return physicalCleanup.promise;
  }
  // Acquire before the first await; no login may replace the identity while
  // storage is physically clearing, even if a caller's bounded UI wait expires.
  let unlock: () => void;
  try { unlock = lockAuthForAccountDeletion(expectedAccountId); }
  catch (error) { return Promise.reject(error); }
  const promise = (async () => {
    try {
      await pausePersistenceForAccountDeletion();
      await clearAuthAfterAccountDeletion();
      await clearRegistrationAfterAccountDeletion();
      const keys = await AsyncStorage.getAllKeys();
      const owned = keys.filter(key => /^(?:pips?wise[.\-])/.test(key) || ['demo', 'disclaimer', 'onboarded', 'theme'].includes(key));
      await AsyncStorage.multiRemove(owned);
      demoMarket.restore(createDemoMarket().serialize());
    } finally { unlock(); }
  })();
  const current = physicalCleanup = { accountId: expectedAccountId, promise };
  void promise.then(() => { if (physicalCleanup === current) physicalCleanup = null; }, () => { if (physicalCleanup === current) physicalCleanup = null; });
  return promise;
}
