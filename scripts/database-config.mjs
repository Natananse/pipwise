/** Validate dedicated database credentials without returning them in errors. */
export class DatabaseConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DatabaseConfigError';
  }
}

export function databaseConnectionString(env, { variable, role, direct = false }) {
  const value = typeof env[variable] === 'string' ? env[variable].trim() : '';
  if (!value) throw new DatabaseConfigError(`Set ${variable} with the ${role} database credential.`);
  let url;
  let username;
  let database;
  try {
    url = new URL(value);
    username = decodeURIComponent(url.username);
    database = decodeURIComponent(url.pathname.slice(1));
    decodeURIComponent(url.password);
  } catch {
    throw new DatabaseConfigError(`${variable} must be a valid Postgres connection URL.`);
  }
  const hostname = url.hostname.toLowerCase();
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || !database || database.includes('/') || /\s/u.test(database)
    || !/^[a-z0-9.-]+$/i.test(hostname) || !hostname.includes('.')
    || /^[\d.]+$/.test(hostname) || hostname === 'localhost'
    || hostname.endsWith('.localhost') || hostname.endsWith('.local')
    || (url.port && url.port !== '5432') || !url.password || url.hash
    || Array.from(value + database).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
    throw new DatabaseConfigError(`${variable} must be a valid Postgres connection URL with database credentials.`);
  }
  if (username !== role) throw new DatabaseConfigError(`${variable} must connect as ${role}.`);
  if (direct && hostname.includes('-pooler')) {
    throw new DatabaseConfigError(`${variable} must use a direct host without -pooler.`);
  }
  // Connection-string query options can override the URL's role or destination.
  // Only bounded timeout/TLS options are accepted; duplicates are rejected.
  const allowed = new Set(['sslmode', 'channel_binding', 'connect_timeout']);
  for (const key of url.searchParams.keys()) {
    if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1) {
      throw new DatabaseConfigError(`${variable} contains unsupported connection parameters.`);
    }
  }
  const sslmode = url.searchParams.get('sslmode');
  if (sslmode !== null && !['require', 'verify-full'].includes(sslmode)) {
    throw new DatabaseConfigError(`${variable} must not disable required transport encryption.`);
  }
  const binding = url.searchParams.get('channel_binding');
  if (binding !== null && !['require', 'prefer'].includes(binding)) {
    throw new DatabaseConfigError(`${variable} contains an invalid channel-binding option.`);
  }
  const timeout = url.searchParams.get('connect_timeout');
  if (timeout !== null && (!/^\d{1,3}$/.test(timeout) || Number(timeout) < 1 || Number(timeout) > 300)) {
    throw new DatabaseConfigError(`${variable} contains an invalid connection-timeout option.`);
  }
  return value;
}

export function safeDatabaseErrorCode(error) {
  return typeof error?.code === 'string' && /^[0-9A-Z]{5}$/.test(error.code) ? error.code : null;
}
