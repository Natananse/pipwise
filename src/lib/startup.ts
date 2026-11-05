export type StartupRoute = '/onboarding' | '/auth' | '/practice' | '/reset-password';

/** Preserve valid deep links once the saved setup and session have been restored. */
export function startupRedirect({ onboarded, answersComplete, authenticated, top, passwordRecovery = false }: {
  onboarded: boolean; answersComplete: boolean; authenticated: boolean; top: string | undefined;
  passwordRecovery?: boolean;
}): StartupRoute | null {
  // Email links must finish restoring their session before ordinary navigation.
  if (top === 'auth-callback' || top === 'reset-password') return null;
  if (passwordRecovery && authenticated) return '/reset-password';
  if (!onboarded || !answersComplete) return top === 'onboarding' ? null : '/onboarding';
  if (!authenticated) return top === 'auth' ? null : '/auth';
  return top === undefined || top === 'onboarding' || top === 'auth' ? '/practice' : null;
}
