import { Platform } from 'react-native';
import { getAuthSession, getBackendCredentials, subscribeAuth, type AuthSession } from './neonAuth';
import { normalizeRegistrationDetails, type RegistrationDetails } from './registrationDetails';
import { loadSecureStore } from './secureStorage';
import { createPersistenceQueue } from './persistence';
import { withStartupTimeout } from './startupTasks';

export type AccountDetails = RegistrationDetails;
type Draft = { email: string; details: AccountDetails; expiresAt: number; id: string };
const pendingKey = 'pipwise.pending-registration.v1';
const draftLifetime = 30 * 60 * 1000;
const enqueue = createPersistenceQueue();
let pending: Draft | null = null;
let syncing: Promise<void> | null = null;

function endpoint(): string {
  if (Platform.OS === 'web') return '/api/account-details';
  const configured = process.env.EXPO_PUBLIC_APP_API_URL;
  const fallback = process.env.EXPO_PUBLIC_NATIVE_AUTH_RETURN_URL;
  try {
    const url = new URL(configured || fallback || '');
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
    return `${url.origin}/api/account-details`;
  } catch {
    throw new Error('Account profile storage is not connected. Please try again after the app service is configured.');
  }
}

async function requestDetails(method: 'GET' | 'PUT', details?: AccountDetails, expectedAccountId?: string): Promise<AccountDetails | null> {
  const url = endpoint();
  let accountId: string | undefined;
  let changed = false;
  const unsubscribe = subscribeAuth(next => { if (next?.user.id !== accountId) changed = true; });
  try {
    const session = await getAuthSession({ timeout: 10000 });
    if (!session || (expectedAccountId && session.user.id !== expectedAccountId)) throw new Error('Your account changed. Sign in again to save your details.');
    accountId = session.user.id;
    if (changed) throw new Error('Your account changed. Please try again.');
    const credentials = await withStartupTimeout(getBackendCredentials(accountId), 'Connecting your account took too long. Please try again.', 10000);
    if (changed) throw new Error('Your account changed. Please try again.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url, {
        method, signal: controller.signal,
        headers: { Accept: 'application/json', Authorization: `Bearer ${credentials.token}`, 'X-Pipwise-Session': credentials.sessionToken, ...(method === 'PUT' ? { 'Content-Type': 'application/json' } : {}) },
        ...(method === 'PUT' ? { body: JSON.stringify(details) } : {}),
      });
      if (changed) throw new Error('Your account changed. Please try again.');
      const result: unknown = await response.json();
      if (changed) throw new Error('Your account changed. Please try again.');
      if (!response.ok) {
        if (response.status === 401) throw new Error('Sign in again to load or save your account details.');
        throw new Error('Could not save or load your account details. Please try again.');
      }
      if (!result || typeof result !== 'object' || !('details' in result)) throw new Error('The account service returned an invalid response. Please try again.');
      if (result.details === null && method === 'GET') return null;
      const value = result.details;
      if (!value || typeof value !== 'object' || !('countryCode' in value) || typeof value.countryCode !== 'string'
        || !('phoneNumber' in value) || (value.phoneNumber !== null && typeof value.phoneNumber !== 'string')) throw new Error('The account service returned invalid profile details.');
      return normalizeRegistrationDetails({ countryCode: value.countryCode, phoneNumber: value.phoneNumber });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw new Error('Your account details request took too long. Check your connection and try again.');
      throw error;
    } finally { clearTimeout(timeout); }
  } finally { unsubscribe(); }
}

export const getAccountDetails = (): Promise<AccountDetails | null> => requestDetails('GET');
export async function saveAccountDetails(details: AccountDetails): Promise<AccountDetails> {
  const saved = await requestDetails('PUT', normalizeRegistrationDetails(details));
  if (!saved) throw new Error('Your account details could not be saved.');
  return saved;
}

async function readDraft(): Promise<Draft | null> {
  if (pending) return pending;
  if (Platform.OS === 'web') return null;
  const storage = await loadSecureStore();
  const raw = await storage.getItemAsync(pendingKey);
  if (!raw) return null;
  try {
    if (raw.length > 1500) return null;
    const value = JSON.parse(raw);
    if (!value || typeof value.email !== 'string' || value.email.length > 254 || typeof value.id !== 'string'
      || typeof value.expiresAt !== 'number' || value.expiresAt > Date.now() + draftLifetime || value.expiresAt <= Date.now()) return null;
    pending = { email: value.email, details: normalizeRegistrationDetails(value.details), expiresAt: value.expiresAt, id: value.id };
    return pending;
  } catch { return null; }
}

async function clearDraft(): Promise<void> {
  if (Platform.OS !== 'web') await (await loadSecureStore()).deleteItemAsync(pendingKey);
  pending = null;
}

/** Persistence has already been paused/drained after successful server deletion. */
export async function clearRegistrationAfterAccountDeletion(): Promise<void> {
  await clearDraft();
}

/** One short-lived, encrypted native draft survives the email-code step. */
export function stageRegistrationDetails(email: string, details: AccountDetails): Promise<void> {
  return enqueue(async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254) throw new Error('Enter a valid email address.');
    const draft: Draft = { email: normalizedEmail, details: normalizeRegistrationDetails(details), expiresAt: Date.now() + draftLifetime, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` };
    if (Platform.OS !== 'web') await (await loadSecureStore()).setItemAsync(pendingKey, JSON.stringify(draft));
    pending = draft;
  });
}

/** Never attach a previous user's signup fields to a different signed-in account. */
export function syncPendingRegistrationDetails(session: AuthSession): Promise<void> {
  if (syncing) return syncing;
  syncing = enqueue(async () => {
    const draft = await readDraft();
    if (!draft) { await clearDraft(); return; }
    if (draft.expiresAt <= Date.now() || draft.email !== session.user.email?.trim().toLowerCase()) { await clearDraft(); return; }
    await requestDetails('PUT', draft.details, session.user.id);
    await clearDraft();
  }).finally(() => { syncing = null; });
  return syncing;
}
