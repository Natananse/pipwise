import { makeRedirectUri } from 'expo-auth-session';
import { authCallbackParameters } from './authCallbacks';
import { completeNativeAuthCallback, nativeAuthReturnPath, refreshAuthSession } from './neonAuth';
import { Platform } from 'react-native';
import { withStartupTimeout } from './startupTasks';

/** Email recovery and system-browser OAuth return to this app route. */
export const authRedirectUri = (recovery = false) => makeRedirectUri({
  scheme: 'pipwise',
  path: 'auth-callback',
  ...(recovery ? { queryParams: { flow: 'recovery' } } : {}),
});

export const completeAuthCallback = async (url: string): Promise<{ recovery: boolean; token?: string; destination?: '/delete-account' }> => {
  const parameters = authCallbackParameters(url);
  const token = parameters.get('token');
  if (token && parameters.get('flow') === 'recovery') return { recovery: true, token };
  if (!parameters.has('neon_auth_session_verifier'))
    throw new Error('This sign-in link could not be completed. Sign in with email and password, or request a new recovery code.');
  if (Platform.OS !== 'web') {
    await completeNativeAuthCallback(url);
    return { recovery: false, destination: nativeAuthReturnPath() };
  }
  // The Neon wrapper performs its verifier exchange using the browser URL and
  // cookies. Supabase access-token fragments and PKCE callbacks are not reused.
  if (!await withStartupTimeout(refreshAuthSession(), 'Sign-in took too long. Check your connection and try again.'))
    throw new Error('Sign-in did not create a session. Please try again.');
  return { recovery: false };
};
