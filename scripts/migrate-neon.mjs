import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const migrationDirectory = resolve(projectRoot, 'neon/migrations');
class MigrationSetupError extends Error {}

/** Never fall back to the pooled application URL for schema changes. */
export function migrationConnectionString(env = process.env) {
  const value = env.DATABASE_URL_UNPOOLED?.trim();
  if (!value) throw new MigrationSetupError('Set DATABASE_URL_UNPOOLED with neon env pull before running migrations.');
  let url;
  try { url = new URL(value); }
  catch { throw new MigrationSetupError('DATABASE_URL_UNPOOLED must be a valid Postgres connection URL.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.pathname.slice(1)) {
    throw new MigrationSetupError('DATABASE_URL_UNPOOLED must be a valid Postgres connection URL.');
  }
  if (url.hostname.includes('-pooler')) {
    throw new MigrationSetupError('DATABASE_URL_UNPOOLED must use a direct host without -pooler.');
  }
  return value;
}

export function readMigrations(directory = migrationDirectory) {
  return readdirSync(directory).filter(name => name.endsWith('.sql')).sort().map(name => {
    if (!/^\d+_[a-z0-9_]+\.sql$/.test(name)) throw new MigrationSetupError('SQL migration names must start with a numeric version and an underscore.');
    const sql = readFileSync(resolve(directory, name), 'utf8');
    if (!sql.trim()) throw new MigrationSetupError(`Migration ${name} is empty.`);
    return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
  });
}

/** Keep the ledger and every pending migration in the same locked transaction. */
export async function runMigrations(client, { directory = migrationDirectory } = {}) {
  const migrations = readMigrations(directory);
  const applied = [];
  const skipped = [];
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query('SELECT pg_advisory_xact_lock(769680, 1)');
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS pipwise_migrations;
      REVOKE ALL ON SCHEMA pipwise_migrations FROM PUBLIC;
      CREATE TABLE IF NOT EXISTS pipwise_migrations.schema_migrations (
        name text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
      REVOKE ALL ON TABLE pipwise_migrations.schema_migrations FROM PUBLIC;
      DO $private_ledger$
      DECLARE client_role text;
      BEGIN
        FOR client_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anonymous', 'authenticated') LOOP
          EXECUTE format('REVOKE ALL ON SCHEMA pipwise_migrations FROM %I', client_role);
          EXECUTE format('REVOKE ALL ON TABLE pipwise_migrations.schema_migrations FROM %I', client_role);
        END LOOP;
      END;
      $private_ledger$;
    `);
    const { rows } = await client.query('SELECT name, checksum FROM pipwise_migrations.schema_migrations ORDER BY name');
    const previous = new Map(rows.map(row => [row.name, row.checksum]));
    if (rows.some(row => !migrations.some(migration => migration.name === row.name))) {
      throw new MigrationSetupError('The database has migrations missing from this checkout. Restore those files before continuing.');
    }
    for (const migration of migrations) {
      if (previous.has(migration.name)) {
        if (previous.get(migration.name) !== migration.checksum) {
          throw new MigrationSetupError(`Applied migration ${migration.name} changed. Restore it and add a new migration instead.`);
        }
        skipped.push(migration.name);
        continue;
      }
      await client.query(migration.sql);
      await client.query('INSERT INTO pipwise_migrations.schema_migrations (name, checksum) VALUES ($1, $2)', [migration.name, migration.checksum]);
      applied.push(migration.name);
    }
    await client.query('COMMIT');
    return { applied, skipped };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

function loadEnvironment(args) {
  if (args.length && (args.length !== 2 || args[0] !== '--env')) {
    throw new MigrationSetupError('Usage: node scripts/migrate-neon.mjs [--env path/to/env-file]');
  }
  if (args.length) {
    const path = resolve(args[1]);
    if (!existsSync(path)) throw new MigrationSetupError('The requested environment file does not exist.');
    process.loadEnvFile(path);
  } else {
    // Match local Expo precedence. Existing shell values always take precedence.
    for (const name of ['.env.local', '.env']) {
      const path = resolve(projectRoot, name);
      if (existsSync(path)) process.loadEnvFile(path);
    }
  }
}

async function main(args) {
  let client;
  try {
    loadEnvironment(args);
    const connectionString = migrationConnectionString();
    const { Client, neonConfig } = await import('@neondatabase/serverless');
    // Node 24 supplies WebSocket; interactive transactions keep the lock and
    // migration ledger on one connection without an extra native dependency.
    neonConfig.webSocketConstructor = globalThis.WebSocket;
    client = new Client({ connectionString, connectionTimeoutMillis: 15000, query_timeout: 30000 });
    await client.connect();
    const result = await runMigrations(client);
    for (const name of result.applied) console.log(`APPLIED ${name}`);
    for (const name of result.skipped) console.log(`SKIPPED ${name} (already applied)`);
    console.log(`PASS: Neon migrations committed (${result.applied.length} applied, ${result.skipped.length} unchanged).`);
  } catch (error) {
    // Driver errors can include SQL, row values, and connection details. Do not
    // print arbitrary error messages, URLs, environment values, or query text.
    const detail = error instanceof MigrationSetupError ? ` ${error.message}`
      : typeof error?.code === 'string' && /^[0-9A-Z]{5}$/.test(error.code) ? ` Database error ${error.code}.` : '';
    console.error(`FAIL: Neon migrations were not committed.${detail}`);
    process.exitCode = 1;
  } finally {
    await client?.end().catch(() => {});
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main(process.argv.slice(2));
}
