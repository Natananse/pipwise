export type NeonSessionCookie = { name: string; value: string; expiresAt: number | null };
const sessionCookieNames = ['__Secure-neon-auth.session_token', 'neon-auth.session_token'];
const challengeCookieNames = ['__Secure-neon-auth.session_challenge', '__Secure-neon-auth.session_challange', 'neon-auth.session_challenge', 'neon-auth.session_challange'];
const safeValue = (value: unknown): value is string => typeof value === 'string' && /^[^\s;,\r\n]+$/.test(value);

function updateCookie(current: NeonSessionCookie | null, headers: string[], names: string[], now: number, maxExpiry?: number): NeonSessionCookie | null {
  let next = current;
  for (const header of headers.flatMap(value => value.split(/,(?=\s*[^\s;,=]+\s*=)/))) {
    const [pair, ...attributes] = header.split(';').map(value => value.trim());
    const separator = pair.indexOf('=');
    if (separator < 1) continue;
    const name = pair.slice(0, separator);
    if (!names.includes(name)) continue;
    const value = pair.slice(separator + 1);
    const options = new Map(attributes.map(attribute => {
      const equal = attribute.indexOf('=');
      return equal < 0 ? [attribute.toLowerCase(), ''] : [attribute.slice(0, equal).toLowerCase(), attribute.slice(equal + 1)];
    }));
    let expiresAt: number | null = null;
    const maxAge = options.get('max-age');
    if (maxAge !== undefined && /^-?\d+$/.test(maxAge)) expiresAt = now + Number(maxAge) * 1000;
    else if (options.has('expires')) {
      const expires = Date.parse(options.get('expires')!);
      if (Number.isFinite(expires)) expiresAt = expires;
    }
    if (maxExpiry !== undefined) expiresAt = Math.min(expiresAt ?? maxExpiry, maxExpiry);
    next = !safeValue(value) || (expiresAt !== null && expiresAt <= now) ? null : { name, value, expiresAt };
  }
  return next;
}

/** Store only the credential needed to renew a native session, never profile cookies. */
export function updateNeonSessionCookie(current: NeonSessionCookie | null, headers: string[], now = Date.now()): NeonSessionCookie | null {
  return updateCookie(current, headers, sessionCookieNames, now);
}

/** The OAuth challenge is temporary and must never replace the session credential. */
export function updateNeonChallengeCookie(current: NeonSessionCookie | null, headers: string[], now = Date.now(), maxExpiry = now + 600000): NeonSessionCookie | null {
  return updateCookie(current, headers, challengeCookieNames, now, maxExpiry);
}

function cookieHeader(cookie: NeonSessionCookie | null, names: string[], now: number): string {
  return cookie && names.includes(cookie.name) && safeValue(cookie.value)
    && (cookie.expiresAt === null || cookie.expiresAt > now) ? `${cookie.name}=${cookie.value}` : '';
}

export function neonCookieHeader(cookie: NeonSessionCookie | null, now = Date.now()): string {
  return cookieHeader(cookie, sessionCookieNames, now);
}

export function neonChallengeCookieHeader(cookie: NeonSessionCookie | null, now = Date.now()): string {
  return cookieHeader(cookie, challengeCookieNames, now);
}

/** A saved credential belongs to one exact branch URL, even if a storage key collides. */
export function restoreNeonSessionCookie(raw: string | null, authUrl: string, now = Date.now()): NeonSessionCookie | null {
  if (!raw) return null;
  let stored: unknown;
  try { stored = JSON.parse(raw); }
  catch { return null; }
  if (!stored || typeof stored !== 'object' || !('url' in stored) || stored.url !== authUrl || !('cookie' in stored)) return null;
  const cookie = stored.cookie;
  if (!cookie || typeof cookie !== 'object' || !('name' in cookie) || typeof cookie.name !== 'string'
    || !('value' in cookie) || !safeValue(cookie.value) || !('expiresAt' in cookie)
    || (cookie.expiresAt !== null && (typeof cookie.expiresAt !== 'number' || !Number.isFinite(cookie.expiresAt)))) return null;
  const candidate = cookie as NeonSessionCookie;
  return neonCookieHeader(candidate, now) ? candidate : null;
}

export function neonCookieStorageKey(authUrl: string): string {
  let hash = 2166136261;
  for (let i = 0; i < authUrl.length; i++) hash = Math.imul(hash ^ authUrl.charCodeAt(i), 16777619);
  return `pipwise.neon.auth.${(hash >>> 0).toString(16)}`;
}
