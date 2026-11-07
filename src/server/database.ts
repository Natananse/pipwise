// Server-only. Never import this module from a screen, component, or client lib.
import { neon } from '@neondatabase/serverless';

type Environment = Record<string, string | undefined>;

export class DatabaseConfigurationError extends Error {
  constructor() {
    super('Configure APP_RUNTIME_DATABASE_URL for the app_runtime database role.');
    this.name = 'DatabaseConfigurationError';
  }
}

/** Reject owner credentials and connection overrides before constructing a client. */
export function runtimeConnectionString(env: Environment = process.env): string {
  try {
    const value = env.APP_RUNTIME_DATABASE_URL?.trim();
    if (!value) throw new Error();
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const database = decodeURIComponent(url.pathname.slice(1));
    decodeURIComponent(url.password);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)
      || decodeURIComponent(url.username) !== 'app_runtime' || !url.password
      || !database || database.includes('/') || /[\s\u0000-\u001f\u007f]/u.test(database)
      || /[\u0000-\u001f\u007f]/u.test(value)
      || !/^[a-z0-9.-]+$/i.test(hostname) || !hostname.includes('.')
      || /^[\d.]+$/.test(hostname) || hostname === 'localhost'
      || hostname.endsWith('.localhost') || hostname.endsWith('.local')
      || (url.port && url.port !== '5432') || url.hash) throw new Error();
    const seen = new Set<string>();
    for (const [name, parameter] of url.searchParams) {
      if (seen.has(name)) throw new Error();
      seen.add(name);
      if (name === 'sslmode' && ['require', 'verify-full'].includes(parameter)) continue;
      if (name === 'channel_binding' && ['require', 'prefer'].includes(parameter)) continue;
      if (name === 'connect_timeout' && /^\d{1,3}$/.test(parameter)
        && Number(parameter) >= 1 && Number(parameter) <= 300) continue;
      throw new Error();
    }
    return value;
  } catch {
    // URL/driver exceptions can expose credentials. Only this fixed error escapes.
    throw new DatabaseConfigurationError();
  }
}

export function runtimeDatabase(env: Environment = process.env) {
  return neon(runtimeConnectionString(env));
}
