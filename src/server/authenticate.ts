// Server entry point only. Never import database/auth verification code in screens.
import { createRemoteJWKSet, jwtVerify } from 'jose';

export class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

let keySet: { url: string; resolve: ReturnType<typeof createRemoteJWKSet> } | null = null;
const unauthorized = () => new HttpError(401, 'UNAUTHORIZED', 'Sign in with a confirmed email to continue.');

function authConfiguration() {
  try {
    const base = new URL(process.env.NEON_AUTH_BASE_URL || '');
    const keys = new URL(process.env.NEON_AUTH_JWKS_URL || `${base.href.replace(/\/$/, '')}/.well-known/jwks.json`);
    if (base.protocol !== 'https:' || keys.protocol !== 'https:' || base.username || base.password
      || base.search || base.hash || keys.username || keys.password || keys.search || keys.hash
      || keys.origin !== base.origin) throw new Error('Invalid auth configuration');
    return { issuer: base.origin, jwksUrl: keys.href };
  } catch {
    throw new HttpError(503, 'AUTH_NOT_CONFIGURED', 'Account services are temporarily unavailable.');
  }
}

/** Verify the Managed Better Auth JWT, then scope every query to its subject. */
export async function authenticate(request: Request): Promise<{ id: string }> {
  const header = request.headers.get('authorization');
  const token = header && /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(header)?.[1];
  if (!token || token.length > 16384) throw unauthorized();
  const config = authConfiguration();
  if (!keySet || keySet.url !== config.jwksUrl) {
    keySet = { url: config.jwksUrl, resolve: createRemoteJWKSet(new URL(config.jwksUrl), { timeoutDuration: 10000 }) };
  }
  try {
    // Managed session JWTs use the auth URL's origin for both iss and aud.
    // This is separate from OAuth authorization-server/resource access tokens.
    const { payload } = await jwtVerify(token, keySet.resolve, {
      algorithms: ['EdDSA'], issuer: config.issuer, audience: config.issuer,
      requiredClaims: ['sub', 'iat', 'exp'], clockTolerance: 5,
    });
    if (typeof payload.sub !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(payload.sub)
      || payload.emailVerified !== true || payload.banned === true) throw unauthorized();
    return { id: payload.sub };
  } catch {
    // Signature, expiry, key lookup, and account errors must never expose tokens.
    throw unauthorized();
  }
}
