import { normalizeProfileName } from './accountProfile';
import type { AuthSession } from './neonAuth';
import type { ProfilePreferences } from './workspace';

function readableName(value: string | undefined): string {
  try { return normalizeProfileName(value ?? ''); }
  catch { return ''; }
}

/** Account identity comes from Neon; device profile values are owner-scoped. */
export function resolveProfileIdentity(session: AuthSession | null, profile: ProfilePreferences) {
  if (session) {
    const name = readableName(session.user.name);
    return {
      displayName: name || 'PipWise member', editableName: name,
      avatarId: profile.accountId === session.user.id ? profile.avatarId : 'trader' as const,
      email: session.user.email ?? '', accountId: session.user.id,
    };
  }
  const local = profile.accountId === undefined;
  const name = local ? readableName(profile.displayName) : '';
  return {
    displayName: name || 'Practice trader', editableName: name,
    avatarId: local ? profile.avatarId : 'trader' as const,
    email: '', accountId: undefined,
  };
}
