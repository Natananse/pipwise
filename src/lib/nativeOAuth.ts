import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import type { AuthSession } from './neonAuth';
import { neonChallengeCookieHeader, neonCookieStorageKey, updateNeonChallengeCookie, type NeonSessionCookie } from './neonCookies';
import { withStartupTimeout } from './startupTasks';
import { loadSecureStore } from './secureStorage';

const lifetime = 10 * 60 * 1000;
const callback = 'pipwise://auth-callback';
const statePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const expiredMessage = 'This sign-in attempt has expired. Start sign-in again.';
type NativeAuthReturnPath = '/delete-account';
type Pending = { authUrl: string; state: string; createdAt: number; challenge: NeonSessionCookie | null; returnPath?: NativeAuthReturnPath };
type Exchange = (verifier: string) => Promise<AuthSession>;

function returnURL() {
  try {
    const url = new URL(process.env.EXPO_PUBLIC_NATIVE_AUTH_RETURN_URL?.trim() ?? '');
    if (url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/native-auth.html') return url;
  } catch { /* Report a configuration error without exposing a supplied URL. */ }
  throw new Error('Mobile account sign-in is not configured. Please use email and password.');
}

/** Neon owns OAuth state/PKCE; this state binds the HTTPS relay to this app attempt. */
export function createNativeOAuthController(authUrl: string) {
  const base = new URL(authUrl);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash) throw new Error('Invalid account service address.');
  const key = `${neonCookieStorageKey(authUrl)}.oauth`;
  let pending: Pending | null = null;
  let restorePromise: Promise<void> | null = null;
  let writes = Promise.resolve();
  let activeStart: string | null = null;
  let generation = 0;
  let requests = 0;
  let retryState: string | null = null;
  let completing: { key: string; promise: Promise<AuthSession> } | null = null;
  let completed: { key: string; session: AuthSession; at: number; returnPath?: NativeAuthReturnPath } | null = null;
  const forgetCompletion = (completionKey: string) => {
    if (completing?.key === completionKey) completing = null;
  };

  const valid = (value: Pending | null, now = Date.now()) => !!value && value.authUrl === authUrl
    && statePattern.test(value.state) && Number.isFinite(value.createdAt) && value.createdAt <= now && now - value.createdAt < lifetime
    && (value.returnPath === undefined || value.returnPath === '/delete-account');
  const persist = () => {
    const value = pending ? JSON.stringify(pending) : null;
    const write = writes.then(async () => {
      const secureStore = await loadSecureStore();
      return value === null ? secureStore.deleteItemAsync(key) : secureStore.setItemAsync(key, value, {
        keychainAccessible: secureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    });
    writes = write.catch(() => undefined);
    return write;
  };
  const clearAttempt = async (state: string) => {
    if (pending?.state !== state) return;
    pending = null;
    await persist();
  };

  function restore(): Promise<void> {
    if (!restorePromise) {
      restorePromise = (async () => {
        const secureStore = await loadSecureStore();
        const raw = await secureStore.getItemAsync(key);
        if (!raw) return;
        let saved: Pending | null = null;
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && typeof parsed.state === 'string' && typeof parsed.createdAt === 'number'
            && parsed.authUrl === authUrl && (parsed.challenge === null || (parsed.challenge && typeof parsed.challenge === 'object'
              && typeof parsed.challenge.expiresAt === 'number' && Number.isFinite(parsed.challenge.expiresAt)
              && parsed.challenge.expiresAt <= parsed.createdAt + lifetime && neonChallengeCookieHeader(parsed.challenge, Date.now())))) saved = parsed;
        } catch { /* An invalid saved attempt cannot authorize a callback. */ }
        pending = valid(saved) ? saved : null;
        if (!pending) await persist();
      })();
      void restorePromise.catch(() => { restorePromise = null; });
    }
    return restorePromise;
  }

  const attemptId = () => valid(pending) ? pending!.state : null;
  // Never use a callback query as a navigation target. The app-selected path
  // travels only in the encrypted, challenge-bound attempt and completion cache.
  const returnPath = () => completed && Date.now() - completed.at < 30000 ? completed.returnPath : undefined;
  const challengeHeader = () => valid(pending) ? neonChallengeCookieHeader(pending!.challenge, Date.now()) : '';
  async function captureCookies(headers: string[]) {
    if (!valid(pending)) return;
    pending = { ...pending!, challenge: updateNeonChallengeCookie(pending!.challenge, headers, Date.now(), pending!.createdAt + lifetime) };
    await persist();
  }

  async function clear() {
    generation++;
    pending = null;
    completed = null;
    retryState = null;
    await persist();
  }

  function complete(rawURL: string, exchange: Exchange): Promise<AuthSession> {
    return (async () => {
      await restore();
      let url: URL;
      try { url = new URL(rawURL); }
      catch { throw new Error('This account callback is invalid. Start sign-in again.'); }
      if (url.protocol !== 'pipwise:' || url.hostname !== 'auth-callback' || url.pathname !== ''
        || url.username || url.password || url.port || url.hash) throw new Error('This account callback is invalid. Start sign-in again.');
      const params = url.searchParams;
      const state = params.get('state');
      const verifier = params.get('neon_auth_session_verifier');
      if (params.getAll('state').length !== 1 || !state || !statePattern.test(state)) throw new Error('This sign-in callback does not match an active attempt.');
      if (['error', 'error_code', 'error_description'].some(name => params.has(name))) {
        await clearAttempt(state);
        throw new Error('The provider could not complete sign-in. Please try again.');
      }
      if (params.getAll('neon_auth_session_verifier').length !== 1 || !verifier || verifier.length > 2048 || /\s|[\x00-\x1f\x7f]/.test(verifier))
        throw new Error('This account callback is incomplete. Start sign-in again.');
      const completionKey = `${state}:${verifier}`;
      if (completing?.key === completionKey) return completing.promise;
      if (completed?.key === completionKey && Date.now() - completed.at < 30000) return completed.session;
      if (!valid(pending) || pending?.state !== state) throw new Error(expiredMessage);
      if (!challengeHeader()) throw new Error('The sign-in challenge is missing or expired. Start sign-in again.');
      if (completing) throw new Error('Another sign-in callback is being completed.');
      const attemptGeneration = generation;
      const destination = pending.returnPath;
      requests++;
      // Keep the physical request deduplicated even if the bounded UI wait
      // expires. A late success can then be reused by a callback retry.
      const request = Promise.resolve().then(() => exchange(verifier)).then(async session => {
        if (generation !== attemptGeneration || !valid(pending) || pending?.state !== state) throw new Error(expiredMessage);
        await clearAttempt(state);
        if (generation !== attemptGeneration) throw new Error(expiredMessage);
        completed = { key: completionKey, session, at: Date.now(), returnPath: destination };
        retryState = null;
        return session;
      });
      void request.finally(() => { requests--; forgetCompletion(completionKey); }).catch(() => undefined);
      const promise = withStartupTimeout(request, 'Completing sign-in took too long. Check your connection and try again.').catch(error => {
        if (pending?.state === state) retryState = state;
        throw error;
      });
      completing = { key: completionKey, promise };
      return promise;
    })();
  }

  async function start(provider: 'google' | 'apple', startRequest: (callbackURL: string) => Promise<string>, exchange: Exchange, destination?: NativeAuthReturnPath): Promise<AuthSession | null> {
    if (destination !== undefined && destination !== '/delete-account') throw new Error('This sign-in return path is unavailable.');
    await restore();
    const relay = returnURL();
    if (provider !== 'google' && provider !== 'apple') throw new Error('This sign-in provider is unavailable.');
    if (activeStart || requests) throw new Error('A sign-in request is still in progress. Please wait and try again.');
    const state = Crypto.randomUUID();
    generation++;
    activeStart = state;
    completed = null;
    retryState = null;
    pending = { authUrl, state, createdAt: Date.now(), challenge: null, returnPath: destination };
    relay.searchParams.set('state', state);
    try {
      await persist();
      requests++;
      const request = Promise.resolve().then(() => startRequest(relay.toString()));
      void request.finally(() => { requests--; }).catch(() => undefined);
      const rawURL = await withStartupTimeout(request, 'Starting sign-in took too long. Check your connection and try again.');
      if (!valid(pending) || pending?.state !== state) throw new Error(expiredMessage);
      if (!challengeHeader()) throw new Error('The account service did not return a sign-in challenge. Please try again.');
      const url = new URL(rawURL);
      if (url.origin !== base.origin || url.pathname !== `${base.pathname.replace(/\/$/, '')}/sign-in/social/init`
        || url.username || url.password || url.hash) throw new Error('The account service returned an unexpected sign-in address.');
      const result = await WebBrowser.openAuthSessionAsync(url.toString(), callback);
      if (result.type !== 'success') {
        await clearAttempt(state);
        return null;
      }
      return await complete(result.url, exchange);
    } catch (error) {
      if (retryState !== state) await clearAttempt(state).catch(() => undefined);
      throw error;
    } finally {
      if (activeStart === state) activeStart = null;
    }
  }

  return { restore, attemptId, returnPath, challengeHeader, captureCookies, clear, start, complete };
}
