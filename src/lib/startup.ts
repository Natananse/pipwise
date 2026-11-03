export type StartupRoute = '/onboarding' | '/auth' | '/practice';

/** Preserve valid deep links once the saved setup and session have been restored. */
export function startupRedirect({ onboarded, answersComplete, authenticated, top }: {
  onboarded: boolean; answersComplete: boolean; authenticated: boolean; top: string | undefined;
}): StartupRoute | null {
  if (!onboarded || !answersComplete) return top === 'onboarding' ? null : '/onboarding';
  if (!authenticated) return top === 'auth' ? null : '/auth';
  return top === undefined || top === 'onboarding' || top === 'auth' ? '/practice' : null;
}
