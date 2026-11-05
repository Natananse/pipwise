import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

// neon deploy writes private service variables. Expo needs explicit public URL
// aliases; database passwords must never receive the EXPO_PUBLIC_ prefix.
const file = process.argv[2] ?? (existsSync('.env') ? '.env' : '.env.local');
try {
  let source = readFileSync(file, 'utf8');
  const env = parseEnv(source);
  for (const [from, to] of Object.entries({
    NEON_AUTH_BASE_URL: 'EXPO_PUBLIC_NEON_AUTH_URL',
  })) {
    const value = env[from];
    if (!value) throw new Error(`Missing ${from}. Run neon deploy first.`);
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
      throw new Error(`Invalid public URL in ${from}.`);
    const line = `${to}=${JSON.stringify(value.replace(/\/$/, ''))}`;
    source = new RegExp(`^${to}=.*$`, 'm').test(source)
      ? source.replace(new RegExp(`^${to}=.*$`, 'm'), line)
      : `${source.trimEnd()}\n${line}\n`;
  }
  writeFileSync(file, source, { mode: 0o600 });
  console.log(`PASS: Public Neon URL aliases updated in ${file}. Database credentials remain private.`);
} catch (error) {
  console.error(error instanceof Error && /^(Missing|Invalid public URL)/.test(error.message)
    ? error.message : 'Could not sync Neon URL aliases. Check the environment file.');
  process.exitCode = 1;
}
