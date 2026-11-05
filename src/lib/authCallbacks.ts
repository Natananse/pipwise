import type { SupabaseClient } from '@supabase/supabase-js';
import { withStartupTimeout } from './startupTasks';

type AuthClient = Pick<SupabaseClient['auth'], 'setSession' | 'exchangeCodeForSession' | 'verifyOtp'>;
type CallbackResult = { recovery: boolean };
const invalidLink = 'This sign-in link is incomplete or expired. Request a new link and try again.';
const emailTypes = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'] as const;

/** Parse query and fragment callbacks without logging or persisting credentials. */
export function authCallbackParameters(url: string) {
  let parsed: URL;
  try { parsed = new URL(url); }
  catch { throw new Error(invalidLink); }
  const parameters = new URLSearchParams(parsed.search);
  new URLSearchParams(parsed.hash.slice(1)).forEach((value, key) => parameters.set(key, value));
  if (parameters.has('error') || parameters.has('error_code')) throw new Error(invalidLink);
  return parameters;
}

/** Both the browser result and the deep-link screen can receive the same URL. */
export function createAuthCallbackHandler(auth: AuthClient) {
  let currentUrl = '';
  let currentResult: Promise<CallbackResult> | null = null;
  return (url: string): Promise<CallbackResult> => {
    if (url === currentUrl && currentResult) return currentResult;
    currentUrl = url;
    const result = (async () => {
      const parameters = authCallbackParameters(url);
      const type = parameters.get('type');
      const recovery = type === 'recovery' || parameters.get('flow') === 'recovery';
      const code = parameters.get('code');
      const access_token = parameters.get('access_token');
      const refresh_token = parameters.get('refresh_token');
      const token_hash = parameters.get('token_hash');
      let response;
      if (code) response = await auth.exchangeCodeForSession(code);
      else if (access_token && refresh_token) response = await auth.setSession({ access_token, refresh_token });
      else if (token_hash && emailTypes.includes(type as typeof emailTypes[number])) {
        response = await auth.verifyOtp({ token_hash, type: type as typeof emailTypes[number] });
      } else throw new Error(invalidLink);
      if (response.error) throw response.error;
      if (!response.data.session) throw new Error(invalidLink);
      return { recovery };
    })();
    currentResult = withStartupTimeout(result, 'Sign-in took too long. Check your connection and try again.');
    const pending = currentResult;
    void pending.catch(() => {
      // Failed callbacks can be retried. Successful one-use codes stay deduplicated.
      if (currentResult === pending) { currentUrl = ''; currentResult = null; }
    });
    return pending;
  };
}
