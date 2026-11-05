const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, rmSync, readFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const migrationsModule = require('../scripts/migrate-neon.mjs');

function fixture(t, files = { '001_first.sql': 'CREATE TABLE first_example (id integer);' }) {
  const directory = mkdtempSync(join(tmpdir(), 'pipwise-neon-migrations-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const [name, contents] of Object.entries(files)) writeFileSync(join(directory, name), contents);
  return directory;
}

function databaseClient(rows = [], failure = null) {
  const calls = [];
  return {
    calls,
    query: async (text, values) => {
      calls.push({ text, values });
      if (text.startsWith('SELECT name, checksum')) return { rows };
      if (failure && text === failure.sql) throw failure.error;
      return { rows: [] };
    },
  };
}

test('migrations require a direct URL and never fall back to the pooled application credential', async () => {
  const { migrationConnectionString } = await migrationsModule;
  for (const env of [
    {},
    { DATABASE_URL: 'postgresql://owner:private@sample-pooler.neon.tech/database' },
    { DATABASE_URL_UNPOOLED: 'not a URL' },
    { DATABASE_URL_UNPOOLED: 'https://sample.neon.tech/database' },
    { DATABASE_URL_UNPOOLED: 'postgresql://sample.neon.tech/' },
    { DATABASE_URL_UNPOOLED: 'postgresql://owner:private@sample-pooler.neon.tech/database' },
  ]) assert.throws(() => migrationConnectionString(env), error => !error.message.includes('private'));
  const direct = 'postgresql://owner:private@sample.neon.tech/database';
  assert.equal(migrationConnectionString({ DATABASE_URL_UNPOOLED: ` ${direct} ` }), direct);
});

test('migration files have deterministic order and SHA-256 content checksums', async t => {
  const { readMigrations } = await migrationsModule;
  const directory = fixture(t, {
    '002_second.sql': 'SELECT 2;',
    '001_first.sql': 'SELECT 1;',
    'notes.md': 'Not a migration.',
  });
  const files = readMigrations(directory);
  assert.deepEqual(files.map(file => file.name), ['001_first.sql', '002_second.sql']);
  assert(files.every(file => /^[a-f0-9]{64}$/.test(file.checksum)));
  writeFileSync(join(directory, '001_first.sql'), 'SELECT 3;');
  assert.notEqual(readMigrations(directory)[0].checksum, files[0].checksum);
});

test('pending migrations and ledger entries commit in one advisory-locked transaction', async t => {
  const { readMigrations, runMigrations } = await migrationsModule;
  const directory = fixture(t);
  const client = databaseClient();
  assert.deepEqual(await runMigrations(client, { directory }), { applied: ['001_first.sql'], skipped: [] });
  const commands = client.calls.map(call => call.text);
  assert.equal(commands[0], 'BEGIN');
  assert.equal(commands.at(-1), 'COMMIT');
  const lock = commands.findIndex(command => command.startsWith('SELECT pg_advisory_xact_lock'));
  const ledgerRead = commands.findIndex(command => command.startsWith('SELECT name, checksum'));
  const migration = commands.indexOf('CREATE TABLE first_example (id integer);');
  const ledgerWrite = commands.findIndex(command => command.startsWith('INSERT INTO pipwise_migrations'));
  assert(lock > 0 && ledgerRead > lock && migration > ledgerRead && ledgerWrite > migration);
  assert.deepEqual(client.calls[ledgerWrite].values, ['001_first.sql', readMigrations(directory)[0].checksum]);
  assert(!commands.includes('ROLLBACK'));
});

test('rerunning a successful migration skips its SQL and does not insert a second ledger entry', async t => {
  const { readMigrations, runMigrations } = await migrationsModule;
  const directory = fixture(t);
  const file = readMigrations(directory)[0];
  const client = databaseClient([{ name: file.name, checksum: file.checksum }]);
  assert.deepEqual(await runMigrations(client, { directory }), { applied: [], skipped: [file.name] });
  assert(!client.calls.some(call => call.text === file.sql || call.text.startsWith('INSERT INTO pipwise_migrations')));
  assert.equal(client.calls.at(-1).text, 'COMMIT');
});

test('changed or missing applied migrations cause rollback before any application SQL executes', async t => {
  const { runMigrations } = await migrationsModule;
  const directory = fixture(t);
  for (const previous of [
    { name: '001_first.sql', checksum: 'modified-after-application' },
    { name: '000_missing.sql', checksum: 'no-longer-in-checkout' },
  ]) {
    const client = databaseClient([previous]);
    await assert.rejects(runMigrations(client, { directory }), /changed|missing/);
    assert.equal(client.calls.at(-1).text, 'ROLLBACK');
    assert(!client.calls.some(call => call.text === 'COMMIT' || call.text.startsWith('CREATE TABLE first_example')));
  }
});

test('a database error rolls back without acknowledging an applied migration', async t => {
  const { runMigrations } = await migrationsModule;
  const directory = fixture(t);
  const original = Object.assign(new Error('database rejected the migration'), { code: '42501' });
  const client = databaseClient([], { sql: 'CREATE TABLE first_example (id integer);', error: original });
  await assert.rejects(runMigrations(client, { directory }), error => error === original);
  assert.equal(client.calls.at(-1).text, 'ROLLBACK');
  assert(!client.calls.some(call => call.text === 'COMMIT' || call.text.startsWith('INSERT INTO pipwise_migrations')));
});

test('feedback schema uses the observed UUID identity and grants no client read or mutation access', () => {
  const sql = readFileSync('neon/migrations/001_beta_feedback.sql', 'utf8');
  assert.match(sql, /user_id uuid not null references neon_auth\."user" \(id\)/);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on table public\.beta_feedback from public/i);
  assert.match(sql, /rolname in \('anonymous', 'authenticated'\)/i);
  assert.match(sql, /to_regprocedure\('auth\.user_id\(\)'\) is not null/i);
  assert.match(sql, /grant insert on table public\.beta_feedback to authenticated/i);
  assert.match(sql, /with check \(\(select auth\.user_id\(\)\) = user_id::text\)/);
  assert(!/grant\s+(select|update|delete|all)\b/i.test(sql));
});

test('private account and usage tables need no Data API roles and grant no client access', () => {
  for (const filename of ['002_account_details.sql', '003_chart_review_usage.sql', '004_auth_email_deliveries.sql']) {
    const sql = readFileSync(`neon/migrations/${filename}`, 'utf8');
    assert.match(sql, /enable row level security/i);
    assert.match(sql, /revoke all on table public\.\w+ from public;/i);
    assert.match(sql, /select rolname from pg_roles where rolname in \('anonymous', 'authenticated'\)/i);
    assert.doesNotMatch(sql, /\bgrant\s+(select|insert|update|delete|all)\b/i);
    assert.doesNotMatch(sql, /\bcreate\s+(role|function|policy)\b/i);
  }
});
