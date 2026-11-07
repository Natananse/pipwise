import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import type { VanillaBetterAuthClient } from '@neon/auth';
import { neonCookieHeader, neonCookieStorageKey, restoreNeonSessionCookie, updateNeonSessionCookie, type NeonSessionCookie } from './neonCookies';
import { withStartupTimeout } from './startupTasks';
import { loadSecureStore } from './secureStorage';
import { normalizeProfileName } from './accountProfile';

export type AuthSession = { user: { id: string; email?: string; name?: string } };
type Listener = (session: AuthSession | null) => void;
const listeners = new Set<Listener>();
const authUrl = (() => {
  const value = process.env.EXPO_PUBLIC_NEON_AUTH_URL?.trim().replace(/\/$/, '');
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash ? value : null;
  } catch { return null; }
})();
export const authConfigured = authUrl !== null;
export const googleAuthEnabled = authConfigured && process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED === '1';
export const appleAuthEnabled = authConfigured && process.env.EXPO_PUBLIC_APPLE_AUTH_ENABLED === '1';
let clientPromise: Promise<VanillaBetterAuthClient> | null = null;
let clientGeneration = 0;
let accountDeletionCleanup = false;
let currentAuthAccountId: string | undefined;
let cookie: NeonSessionCookie | null = null;
let cookieWrites = Promise.resolve();
let nativeOAuth: ReturnType<typeof import('./nativeOAuth').createNativeOAuthController> | null = null;
const verifierAttempts = new Map<string, string>();
let stagedOAuthCookie: { attempt: string; previous: NeonSessionCookie | null; installed: NeonSessionCookie | null } | null = null;

function queueCookieWrite(task: () => Promise<void>) {
  const write = cookieWrites.then(task);
  cookieWrites = write.catch(() => undefined);
  return write;
}

async function discardCancelledOAuthCookie() {
  await queueCookieWrite(async () => {
    const staged = stagedOAuthCookie;
    if (!staged || nativeOAuth?.attemptId() === staged.attempt) return;
    if (cookie === staged.installed) await persistCookie(staged.previous);
    if (stagedOAuthCookie === staged) stagedOAuthCookie = null;
  });
}

function notify(session: AuthSession | null) {
  if (accountDeletionCleanup) return;
  currentAuthAccountId = session?.user.id;
  listeners.forEach(listener => listener(session));
}
export function subscribeAuth(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export class AccountAccessError extends Error {
  readonly code?: string;

  constructor(error: { message?: string; code?: string }) {
    super(error.message || 'Account access failed. Please try again.');
    this.name = 'AccountAccessError';
    this.code = error.code;
  }
}

function assertAuthGeneration(generation: number) {
  if (generation !== clientGeneration || accountDeletionCleanup)
    throw new AccountAccessError({ code: 'AUTH_SESSION_CHANGED', message: 'Your account changed. Please try again.' });
}

/** Keep new sign-ins and obsolete Auth responses outside physical local erasure. */
export function lockAuthForAccountDeletion(expectedAccountId?: string): () => void {
  if (expectedAccountId && currentAuthAccountId && currentAuthAccountId !== expectedAccountId)
    throw new AccountAccessError({ code: 'DELETED_ACCOUNT_CHANGED', message: 'Your previous account was deleted. Your current account and local data have been preserved.' });
  if (accountDeletionCleanup) throw new AccountAccessError({ code: 'ACCOUNT_DELETION_IN_PROGRESS', message: 'Account cleanup is still in progress. Please wait and retry.' });
  accountDeletionCleanup = true;
  clientGeneration++;
  return () => { accountDeletionCleanup = false; };
}

/** Account creation succeeded; retry delivery rather than creating another account. */
export class AccountVerificationError extends AccountAccessError {
  readonly accountCreated = true;

  constructor() {
    super({ code: 'VERIFICATION_DELIVERY_FAILED', message: 'Your account was created, but the confirmation code could not be sent. Use Resend confirmation email to try again.' });
    this.name = 'AccountVerificationError';
  }
}

function check(error: { message?: string; code?: string } | null | undefined) {
  if (error) throw new AccountAccessError(error);
}

async function persistCookie(next: NeonSessionCookie | null) {
  if (Platform.OS === 'web' || !authUrl) return;
  const secureStore = await loadSecureStore();
  const key = neonCookieStorageKey(authUrl);
  if (next) await secureStore.setItemAsync(key, JSON.stringify({ url: authUrl, cookie: next }), {
    keychainAccessible: secureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  else await secureStore.deleteItemAsync(key);
  cookie = next;
}

async function getClient(): Promise<VanillaBetterAuthClient> {
  if (accountDeletionCleanup) throw new AccountAccessError({ code: 'ACCOUNT_DELETION_IN_PROGRESS', message: 'Account cleanup is still in progress. Please wait and retry.' });
  if (!authUrl) throw new Error('Account access is currently unavailable. You can still explore in demo mode.');
  if (!clientPromise) {
    const generation = clientGeneration;
    clientPromise = (async () => {
      if (Platform.OS !== 'web') {
        const secureStore = await loadSecureStore();
        // The SDK evaluates crypto.randomUUID when imported. Expo supplies the
        // native cryptographic implementation before that module is loaded.
        const crypto = await import('expo-crypto');
        if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true });
        if (!globalThis.crypto.randomUUID) Object.defineProperty(globalThis.crypto, 'randomUUID', { value: crypto.randomUUID, configurable: true });
        if (!globalThis.crypto.getRandomValues) Object.defineProperty(globalThis.crypto, 'getRandomValues', { value: crypto.getRandomValues, configurable: true });
        const savedCookie = await secureStore.getItemAsync(neonCookieStorageKey(authUrl));
        assertAuthGeneration(generation);
        cookie = restoreNeonSessionCookie(savedCookie, authUrl);
        nativeOAuth ??= (await import('./nativeOAuth')).createNativeOAuthController(authUrl);
        await nativeOAuth.restore();
      }
      const [{ createAuthClient }, { BetterAuthVanillaAdapter }] = await Promise.all([
        import('@neon/auth'), import('@neon/auth/vanilla/adapters'),
      ]);
      assertAuthGeneration(generation);
      return createAuthClient(authUrl, {
        adapter: BetterAuthVanillaAdapter(Platform.OS === 'web' ? undefined : {
          fetchOptions: {
            onRequest(context) {
              const destination = new URL(context.url);
              const base = new URL(authUrl);
              if (destination.origin !== base.origin || !destination.pathname.startsWith(`${base.pathname}/`))
                throw new Error('An account request used an unexpected address.');
              // Native fetch has no browser origin. Neon still requires one for
              // cookie-authenticated writes, including sign-out.
              context.headers.set('Origin', base.origin);
              const exchangingVerifier = destination.searchParams.has('neon_auth_session_verifier');
              const header = exchangingVerifier ? nativeOAuth?.challengeHeader() : neonCookieHeader(cookie);
              if (exchangingVerifier && !header) throw new Error('This sign-in attempt has expired. Please start again.');
              if (header) context.headers.set('Cookie', header);
              else context.headers.delete('Cookie');
            },
            async onSuccess(context) {
              if (generation !== clientGeneration) return;
              const responseURL = context.request?.url.toString();
              const verifier = responseURL ? new URL(responseURL).searchParams.get('neon_auth_session_verifier') : null;
              const attempt = verifier ? verifierAttempts.get(verifier) : null;
              const headers = context.response.headers;
              const setCookies = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [headers.get('set-cookie') || ''];
              await queueCookieWrite(async () => {
                if (generation !== clientGeneration) return;
                // Check inside the queue: cancellation may happen while an
                // earlier secure-storage operation is still running.
                if (verifier && (!attempt || nativeOAuth?.attemptId() !== attempt)) return;
                const previous = cookie;
                await persistCookie(updateNeonSessionCookie(cookie, setCookies));
                if (verifier) stagedOAuthCookie = { attempt: attempt!, previous, installed: cookie };
                await nativeOAuth?.captureCookies(setCookies);
                if (verifier && nativeOAuth?.attemptId() !== attempt) {
                  await persistCookie(previous);
                  stagedOAuthCookie = null;
                }
              });
            },
          },
        }),
      });
    })();
    // Failed secure storage/module reads remain retryable from the startup UI.
    const initializing = clientPromise;
    void initializing.catch(() => { if (clientPromise === initializing) clientPromise = null; });
  }
  return clientPromise;
}

export async function getAuthSession(options?: { timeout?: number }): Promise<AuthSession | null> {
  if (!authConfigured) return null;
  const generation = clientGeneration;
  const client = await getClient();
  const requestedCookie = cookie;
  const result = await client.getSession({ fetchOptions: { headers: { 'X-Force-Fetch': 'true' }, ...(options?.timeout ? { timeout: options.timeout } : {}) } });
  assertAuthGeneration(generation);
  check(result.error);
  const session = result.data?.user && result.data.user.emailVerified !== false
    ? { user: { id: result.data.user.id, email: result.data.user.email, name: result.data.user.name } } : null;
  if (!session && Platform.OS !== 'web') await queueCookieWrite(async () => {
    assertAuthGeneration(generation);
    if (cookie && cookie === requestedCookie) await persistCookie(null);
  });
  assertAuthGeneration(generation);
  currentAuthAccountId = session?.user.id;
  return session;
}

/** Publish externally completed sign-in to providers that are already mounted. */
export async function refreshAuthSession(options?: { timeout?: number }): Promise<AuthSession | null> {
  const generation = clientGeneration;
  const session = await getAuthSession(options);
  assertAuthGeneration(generation);
  notify(session);
  return session;
}

export async function getAuthToken(): Promise<string> {
  const generation = clientGeneration;
  // The installed adapter shares its session cache with /token. Force the token
  // endpoint so this call cannot receive a cached { user, session } response.
  const result = await (await getClient()).token({ fetchOptions: { headers: { 'X-Force-Fetch': 'true' }, timeout: 10000 } });
  assertAuthGeneration(generation);
  check(result.error);
  if (typeof result.data?.token !== 'string' || !result.data.token) throw new Error('Sign in again to continue.');
  return result.data.token;
}

function backendSessionProof(value: unknown): { accountId: string; sessionToken: string } | null {
  const record = (item: unknown): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item);
  if (!record(value) || !record(value.user) || !record(value.session)) return null;
  const sessionToken = value.session.token;
  if (typeof value.user.id !== 'string' || !value.user.id || value.user.emailVerified !== true
    || typeof sessionToken !== 'string' || !sessionToken || sessionToken.length > 2048
    || /\s|[\u0000-\u001f\u007f]/u.test(sessionToken)
    || /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(sessionToken)) return null;
  return { accountId: value.user.id, sessionToken };
}

/** Session proof stays in request headers, never in persisted profile/UI state. */
export async function getBackendCredentials(expectedAccountId?: string) {
  const generation = clientGeneration;
  let accountId = expectedAccountId ?? currentAuthAccountId;
  let changed = false;
  const unsubscribe = subscribeAuth(next => {
    if (accountId && next?.user.id !== accountId) changed = true;
  });
  const unchanged = () => {
    assertAuthGeneration(generation);
    if (changed) throw new AccountAccessError({ code: 'AUTH_SESSION_CHANGED', message: 'Your account changed. Please try again.' });
  };
  try {
    const client = await getClient();
    const raw: { proof?: ReturnType<typeof backendSessionProof>; token?: string } = {};
    const result = await client.getSession({ fetchOptions: {
      headers: { 'X-Force-Fetch': 'true' }, timeout: 10000,
      async onResponse(context) {
        // Neon replaces data.session.token with set-auth-jwt before onSuccess.
        // Capture only the opaque proof from this response's original JSON while
        // preserving the SDK's normal JWT and native cookie renewal hooks.
        raw.proof = null;
        raw.token = undefined;
        if (!context.response.ok) return;
        try { raw.proof = backendSessionProof(await context.response.clone().json()); }
        catch { /* Missing or unreadable raw proof must fail closed below. */ }
        const token = context.response.headers.get('set-auth-jwt');
        if (token && token.length <= 16384 && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) raw.token = token;
      },
    } });
    unchanged();
    check(result.error);
    const user = result.data?.user;
    const sessionToken = raw.proof?.sessionToken;
    if (!user?.id || user.emailVerified !== true || !sessionToken || raw.proof?.accountId !== user.id
      || (accountId && user.id !== accountId)
      || (currentAuthAccountId && user.id !== currentAuthAccountId))
      throw new Error('Sign in again to the same account, then try again.');
    accountId = user.id;
    const token = raw.token ?? await withStartupTimeout(getAuthToken(), 'Connecting your account took too long. Please try again.');
    unchanged();
    currentAuthAccountId = user.id;
    return { accountId: user.id, sessionToken, token };
  } finally { unsubscribe(); }
}

/** Deletion's ten-minute freshness requirement is enforced by the server. */
export async function getAccountDeletionCredentials(expectedAccountId?: string) {
  return getBackendCredentials(expectedAccountId);
}

/** Server deletion already invalidated every session; local cleanup cannot depend on sign-out succeeding. */
export async function clearAuthAfterAccountDeletion() {
  clientGeneration++;
  clientPromise = null;
  cookie = null;
  lastNativeSession = null;
  stagedOAuthCookie = null;
  verifierAttempts.clear();
  verificationSentAt.clear();
  verificationRequests.clear();
  currentAuthAccountId = undefined;
  // The server removed A's sessions. An invalid HttpOnly browser cookie cannot
  // authorize requests; issuing signOut here could instead target a new B cookie.
  await queueCookieWrite(() => persistCookie(null));
  await nativeOAuth?.clear();
  nativeOAuth = null;
}

export function publishAccountDeletion() { notify(null); }

export async function signIn(email: string, password: string) {
  const generation = clientGeneration;
  const result = await (await getClient()).signIn.email({ email, password });
  assertAuthGeneration(generation);
  check(result.error);
  const session = await getAuthSession();
  assertAuthGeneration(generation);
  if (!session) throw new Error('Sign-in did not create a session. Please try again.');
  notify(session);
  return session;
}

export async function signUp(email: string, password: string, displayName: string) {
  const generation = clientGeneration;
  const name = normalizeProfileName(displayName);
  const result = await (await getClient()).signUp.email({ email, password, name });
  assertAuthGeneration(generation);
  check(result.error);
  if (result.data?.user.emailVerified !== true) {
    // Verification is sent explicitly by this app. Managed Auth's automatic
    // signup/sign-in email flags stay off to avoid replacing this code twice.
    try { await resendVerification(email); }
    catch { throw new AccountVerificationError(); }
    return null;
  }
  const session = await getAuthSession();
  assertAuthGeneration(generation);
  if (session) notify(session);
  return session;
}

export async function updateDisplayName(displayName: string): Promise<AuthSession> {
  const name = normalizeProfileName(displayName);
  const client = await getClient();
  try {
    const result = await client.updateUser({ name }, { timeout: 10000 });
    if (result.error) throw new Error('Name update rejected');
  } catch {
    throw new Error('Your name could not be saved. Check your connection and try again.');
  }
  let session: AuthSession | null;
  try { session = await refreshAuthSession({ timeout: 10000 }); }
  catch { throw new Error('Your name was saved, but your profile could not refresh. Please try again.'); }
  if (!session) throw new Error('Sign in again to finish updating your profile.');
  return session;
}

export async function signOut() {
  if (!authConfigured) return;
  const generation = clientGeneration;
  check((await (await getClient()).signOut()).error);
  assertAuthGeneration(generation);
  if (Platform.OS !== 'web') await queueCookieWrite(() => persistCookie(null));
  await nativeOAuth?.clear();
  stagedOAuthCookie = null;
  lastNativeSession = null;
  assertAuthGeneration(generation);
  notify(null);
}

export async function verifyEmail(email: string, otp: string) {
  check((await (await getClient()).emailOtp.verifyEmail({ email, otp })).error);
  verificationSentAt.delete(email.trim().toLowerCase());
}

export const verificationResendCooldownMs = 60000;
const verificationSentAt = new Map<string, number>();
const verificationRequests = new Map<string, Promise<void>>();

export async function resendVerification(email: string) {
  const address = email.trim();
  const key = address.toLowerCase();
  const pending = verificationRequests.get(key);
  if (pending) return pending;
  const now = Date.now();
  for (const [address, sentAt] of verificationSentAt) {
    if (now - sentAt >= verificationResendCooldownMs) verificationSentAt.delete(address);
  }
  const sentAt = verificationSentAt.get(key);
  if (sentAt !== undefined) {
    const seconds = Math.ceil((verificationResendCooldownMs - (now - sentAt)) / 1000);
    throw new AccountAccessError({ code: 'VERIFICATION_RATE_LIMITED', message: `Please wait ${seconds} ${seconds === 1 ? 'second' : 'seconds'} before requesting another confirmation code. Check your inbox and spam folder for the last code.` });
  }
  const request = (async () => {
    const client = await getClient();
    check((await client.emailOtp.sendVerificationOtp({ email: address, type: 'email-verification' }, { timeout: 10000 })).error);
    // A failed send remains immediately retryable; success alone starts cooldown.
    verificationSentAt.set(key, Date.now());
  })();
  verificationRequests.set(key, request);
  try { await request; }
  finally { if (verificationRequests.get(key) === request) verificationRequests.delete(key); }
}
export async function requestPasswordReset(email: string) {
  check((await (await getClient()).forgetPassword.emailOtp({ email })).error);
}
export async function resetPassword(token: string, newPassword: string, email?: string) {
  const client = await getClient();
  const result = email ? await client.emailOtp.resetPassword({ email, otp: token, password: newPassword })
    : await client.resetPassword({ token, newPassword });
  check(result.error);
}
async function exchangeNativeVerifier(verifier: string): Promise<AuthSession> {
  const client = await getClient();
  const attempt = nativeOAuth?.attemptId();
  if (!attempt) throw new Error('This sign-in attempt has expired. Please start again.');
  verifierAttempts.set(verifier, attempt);
  const result = await client.getSession({
    fetchOptions: {
      headers: { 'X-Force-Fetch': 'true' },
      query: { neon_auth_session_verifier: verifier },
    },
  });
  check(result.error);
  if (!result.data?.user || !result.data.session) throw new Error('Sign-in did not create a session. Please try again.');
  return { user: { id: result.data.user.id, email: result.data.user.email, name: result.data.user.name } };
}

function publishNativeSession(session: AuthSession) {
  // The browser result and a mounted callback route may finish the same flow.
  if (session === lastNativeSession) return;
  lastNativeSession = session;
  stagedOAuthCookie = null;
  verifierAttempts.clear();
  notify(session);
}
let lastNativeSession: AuthSession | null = null;

export async function completeNativeAuthCallback(url: string): Promise<AuthSession> {
  const generation = clientGeneration;
  await getClient();
  if (!nativeOAuth) throw new Error('Please finish signing in from this device.');
  try {
    const session = await nativeOAuth.complete(url, exchangeNativeVerifier);
    assertAuthGeneration(generation);
    publishNativeSession(session);
    return session;
  } catch (error) {
    await discardCancelledOAuthCookie();
    throw error;
  }
}

export async function cancelNativeAuth() {
  await nativeOAuth?.clear();
  await discardCancelledOAuthCookie();
  verifierAttempts.clear();
}

export function nativeAuthReturnPath() { return nativeOAuth?.returnPath(); }

async function signInWithProvider(provider: 'google' | 'apple', callbackURL: string) {
  const generation = clientGeneration;
  if (!(provider === 'google' ? googleAuthEnabled : appleAuthEnabled))
    throw new Error('This sign-in option is currently unavailable. Use email and password to continue.');
  const client = await getClient();
  if (Platform.OS === 'web') {
    check((await withStartupTimeout(client.signIn.social({ provider, callbackURL }), 'Sign-in took too long. Check your connection and try again.')).error);
    assertAuthGeneration(generation);
    return;
  }
  try {
    const session = await nativeOAuth!.start(provider, async nativeCallbackURL => {
      await discardCancelledOAuthCookie();
      verifierAttempts.clear();
      const result = await client.signIn.social({ provider, callbackURL: nativeCallbackURL, disableRedirect: true });
      check(result.error);
      if (!result.data?.url) throw new Error('Sign-in could not be opened. Please try again.');
      return result.data.url;
    }, exchangeNativeVerifier, callbackURL === '/delete-account' ? '/delete-account' : undefined);
    assertAuthGeneration(generation);
    if (session) publishNativeSession(session);
    else await discardCancelledOAuthCookie();
  } catch (error) {
    await discardCancelledOAuthCookie();
    throw error;
  }
}

export function signInWithGoogle(callbackURL: string) {
  return signInWithProvider('google', callbackURL);
}

export function signInWithApple(callbackURL: string) {
  return signInWithProvider('apple', callbackURL);
}
