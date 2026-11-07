import { Platform } from 'react-native';
import type { ReviewInput } from './chartReview';
import type { ChartUpload } from './chartUploads';
import { getAuthSession, getBackendCredentials, subscribeAuth } from './neonAuth';
import { withStartupTimeout } from './startupTasks';

function endpoint() {
  if (Platform.OS === 'web') return '/api/chart-coach';
  try {
    const url = new URL(process.env.EXPO_PUBLIC_APP_API_URL || process.env.EXPO_PUBLIC_NATIVE_AUTH_RETURN_URL || '');
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
    return `${url.origin}/api/chart-coach`;
  } catch { throw new Error('The chart coach service is not connected yet.'); }
}
export type CoachStatus = { available: boolean; provider: 'openai' | 'gemini' | null; requiresSubscription: boolean; monthlyLimit: number; message: string };
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export async function getCoachStatus(signal: AbortSignal): Promise<CoachStatus> {
  const response = await fetch(endpoint(), { signal });
  const body: unknown = await response.json();
  if (!response.ok || !record(body) || typeof body.available !== 'boolean' || !['openai', 'gemini', null].includes(body.provider as 'openai' | 'gemini' | null)
    || typeof body.requiresSubscription !== 'boolean' || body.available && (body.provider === null || body.requiresSubscription !== (body.provider === 'gemini')) || !Number.isInteger(body.monthlyLimit)
    || (body.monthlyLimit as number) < 1 || (body.monthlyLimit as number) > 50 || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 500)
    throw new Error('The chart coach connection could not be checked.');
  return { available: body.available, provider: body.provider as 'openai' | 'gemini' | null, requiresSubscription: body.requiresSubscription, monthlyLimit: body.monthlyLimit as number, message: body.message };
}
export async function reviewChartPhoto(input: ReviewInput, upload: ChartUpload, signal: AbortSignal, accountId: string, provider: 'openai' | 'gemini'): Promise<{ review: string; source: string; generatedAt: number }> {
  if (signal.aborted) throw new Error('Review canceled.');
  const url = endpoint();
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener('abort', cancel);
  let changed = false;
  const unsubscribe = subscribeAuth(next => { if (next?.user.id !== accountId) { changed = true; controller.abort(); } });
  const checkAccount = () => {
    if (changed) throw new Error('Your account changed. Start a new review from your current account.');
    if (controller.signal.aborted) throw new Error('Review canceled.');
  };
  try {
    const session = await getAuthSession({ timeout: 10000 });
    if (!session || session.user.id !== accountId) changed = true;
    checkAccount();
    const credentials = await withStartupTimeout(getBackendCredentials(accountId), 'Connecting your account took too long. Try again.', 10000);
    checkAccount();
    const response = await fetch(url, {
      method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${credentials.token}`, 'X-Pipwise-Session': credentials.sessionToken },
      body: JSON.stringify({ input, image: { mimeType: upload.mimeType, base64: upload.base64 }, consent: true, provider }),
    });
    checkAccount();
    const body: unknown = await response.json();
    checkAccount();
    if (!response.ok) throw new Error(record(body) && typeof body.error === 'string' && body.error.length <= 500 ? body.error : 'The photo review could not be completed.');
    if (!record(body) || typeof body.review !== 'string' || !body.review.trim() || body.review.length > 16000
      || typeof body.source !== 'string' || !body.source.trim() || body.source.length > 100
      || typeof body.generatedAt !== 'number' || !Number.isFinite(body.generatedAt) || body.generatedAt <= 0)
      throw new Error('The service returned an incomplete review.');
    return { review: body.review, source: body.source, generatedAt: body.generatedAt };
  } catch (error) { checkAccount(); throw error; }
  finally { signal.removeEventListener('abort', cancel); unsubscribe(); }
}
