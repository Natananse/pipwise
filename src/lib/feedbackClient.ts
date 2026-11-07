import { Platform } from 'react-native';
import type { FeedbackPayload } from './feedback';
import { getAuthSession, getBackendCredentials, subscribeAuth } from './neonAuth';
import { withStartupTimeout } from './startupTasks';

function endpoint(): string {
  if (Platform.OS === 'web') return '/api/feedback';
  try {
    const url = new URL(process.env.EXPO_PUBLIC_APP_API_URL || process.env.EXPO_PUBLIC_NATIVE_AUTH_RETURN_URL || '');
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error();
    return `${url.origin}/api/feedback`;
  } catch { throw new Error('Review delivery is currently unavailable. You can still share a report.'); }
}

export const feedbackConfigured = (() => { try { endpoint(); return true; } catch { return false; } })();

/** The server verifies the account and owns the database connection. */
export async function submitFeedback(payload: FeedbackPayload, signal?: AbortSignal) {
  const url = endpoint();
  if (signal?.aborted) throw new Error('Review delivery canceled.');
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel);
  const timeout = setTimeout(cancel, 12000);
  let changed = false;
  const unsubscribe = subscribeAuth(next => {
    if (next?.user.id !== payload.user_id) { changed = true; cancel(); }
  });
  const checkAccount = () => {
    if (changed) throw new Error('Your account changed. Start a new review from your current account.');
    if (controller.signal.aborted) throw new Error('Review delivery canceled or timed out. Your review is still here.');
  };
  try {
    const session = await getAuthSession({ timeout: 10000 });
    if (session?.user.id !== payload.user_id) changed = true;
    checkAccount();
    const credentials = await withStartupTimeout(getBackendCredentials(payload.user_id), 'Connecting your account took too long. Please try again.', 10000);
    checkAccount();
    const response = await fetch(url, {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${credentials.token}`, 'X-Pipwise-Session': credentials.sessionToken, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    const body: unknown = await response.json().catch(() => null);
    checkAccount();
    const result = body && typeof body === 'object' ? body as { delivered?: unknown; error?: { code?: unknown; message?: unknown } } : {};
    if (response.ok) {
      if (result.delivered !== true) throw new Error('The service did not confirm delivery. Your review is still here.');
      return { error: null };
    }
    return { error: {
      code: typeof result.error?.code === 'string' ? result.error.code : undefined,
      message: typeof result.error?.message === 'string' && result.error.message.length <= 500 ? result.error.message : 'Review delivery failed.',
    } };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
    unsubscribe();
  }
}
