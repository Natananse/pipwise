import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { databaseConnectionString, DatabaseConfigError, safeDatabaseErrorCode } from './database-config.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const migrationDirectory = resolve(projectRoot, 'neon/migrations');
class MigrationSetupError extends Error {}

/** Schema changes require the dedicated direct migrator credential. */
export function migrationConnectionString(env = process.env) {
  return databaseConnectionString(env, { variable: 'MIGRATOR_DATABASE_URL', role: 'migrator', direct: true });
}

export function migrationFailureMessage(error) {
  const code = safeDatabaseErrorCode(error);
  const detail = error instanceof MigrationSetupError || error instanceof DatabaseConfigError ? ` ${error.message}`
    : code ? ` Database error ${code}.` : '';
  return `FAIL: Neon migrations were not committed.${detail}`;
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
    const existing = await client.query("SELECT to_regclass('pipwise_migrations.schema_migrations') AS ledger");
    // The existing ledger stays owned by its administrator. The migrator only
    // needs USAGE plus SELECT/INSERT and must not issue owner-only revocations.
    if (!existing.rows[0]?.ledger) {
      throw new MigrationSetupError('The migration ledger must be provisioned by the database administrator before running migrations.');
    }
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
    console.error(migrationFailureMessage(error));
    process.exitCode = 1;
  } finally {
    await client?.end().catch(() => {});
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main(process.argv.slice(2));
}
