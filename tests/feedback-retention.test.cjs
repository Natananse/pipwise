const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const loaded = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/server/feedbackRetention.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { module: loaded, exports: loaded.exports });
const { countExpiredFeedback, purgeExpiredFeedback } = loaded.exports;

test('dry-run retention returns only eligible count and rejects malformed results', async () => {
  assert.equal(await countExpiredFeedback(async () => [{ eligible: 3 }]), 3);
  for (const result of [[], [{ eligible: -1 }], [{ eligible: '3' }]]) {
    await assert.rejects(countExpiredFeedback(async () => result));
  }
});

test('retention returns only a removal count and propagates database failures', async () => {
  assert.equal(await purgeExpiredFeedback(async () => [{ removed: 3 }]), 3);
  assert.equal(await purgeExpiredFeedback(async () => [{ removed: 0 }]), 0);
  for (const result of [[], [{ removed: -1 }], [{ removed: 1.5 }], [{ removed: '3' }]]) {
    await assert.rejects(purgeExpiredFeedback(async () => result));
  }
  const failure = new Error('database unavailable');
  await assert.rejects(purgeExpiredFeedback(async () => { throw failure; }), error => error === failure);
});

test('maintenance requires its dedicated exact retention role before constructing a database client', async () => {
  const { runFeedbackRetention } = await import('../scripts/purge-retained-data.mjs');
  for (const env of [
    {},
    { DATABASE_URL: 'postgresql://owner:synthetic-secret@fixture.test/database' },
    { DATABASE_URL_UNPOOLED: 'postgresql://retention_job:synthetic-secret@fixture.test/database' },
    { APP_RUNTIME_DATABASE_URL: 'postgresql://app_runtime:synthetic-secret@fixture.test/database' },
    { RETENTION_JOB_DATABASE_URL: 'postgresql://owner:synthetic-secret@fixture.test/database' },
    { RETENTION_JOB_DATABASE_URL: 'postgresql://migrator:synthetic-secret@fixture.test/database' },
    { RETENTION_JOB_DATABASE_URL: 'postgresql://retention_job@fixture.test/database' },
    { RETENTION_JOB_DATABASE_URL: 'postgresql://retention_job:synthetic-secret@fixture.test/database?user=owner' },
    { RETENTION_JOB_DATABASE_URL: 'postgresql://retention_job:synthetic-secret@fixture.test/database?options=-c%20role%3Downer' },
  ]) {
    await assert.rejects(runFeedbackRetention(env, {
      createSql() { assert.fail('Invalid credentials must fail before a database client is constructed'); },
    }), error => !error.message.includes('synthetic-secret'));
  }
});

test('maintenance dry-run and execution use only the supplied retention credential with mocked SQL', async () => {
  const { runFeedbackRetention } = await import('../scripts/purge-retained-data.mjs');
  const dedicated = 'postgresql://retention_job:synthetic-secret@fixture-pooler.test/database?sslmode=require';
  for (const execute of [false, true]) {
    const connections = [];
    const statements = [];
    const result = await runFeedbackRetention({
      RETENTION_JOB_DATABASE_URL: dedicated,
      DATABASE_URL: 'postgresql://owner:must-not-be-used@fixture.test/database',
    }, {
      execute,
      createSql(connection) {
        connections.push(connection);
        return async parts => {
          statements.push(parts.join('?'));
          return [execute ? { removed: 2 } : { eligible: 2 }];
        };
      },
    });
    assert.deepEqual(connections, [dedicated]);
    assert.deepEqual(result, execute ? { mode: 'execute', removed: 2 } : { mode: 'dry-run', eligible: 2 });
    assert.equal(statements.length, 1);
    assert.equal(/DELETE FROM/.test(statements[0]), execute);
  }
});

test('maintenance diagnostics expose safe SQLSTATEs without driver messages or credentials', async () => {
  const { retentionFailureMessage, retentionConnectionString } = await import('../scripts/purge-retained-data.mjs');
  const privateText = 'postgresql://owner:synthetic-secret@private.test/database';
  assert.equal(retentionFailureMessage(Object.assign(new Error(privateText), { code: '42501' })), 'Feedback retention cleanup failed (CLEANUP_FAILED; SQLSTATE 42501).');
  assert.equal(retentionFailureMessage(Object.assign(new Error(privateText), { code: privateText })), 'Feedback retention cleanup failed (CLEANUP_FAILED).');
  assert.throws(() => retentionConnectionString({ RETENTION_JOB_DATABASE_URL: privateText }), error => {
    assert.match(retentionFailureMessage(error), /must connect as retention_job/);
    assert(!retentionFailureMessage(error).includes('synthetic-secret'));
    return true;
  });
});

test('scheduler uses only its dedicated secret and the env template contains no configured values', () => {
  const workflow = fs.readFileSync('.github/workflows/data-retention.yml', 'utf8');
  assert.equal((workflow.match(/RETENTION_JOB_DATABASE_URL: \$\{\{ secrets\.RETENTION_JOB_DATABASE_URL \}\}/g) || []).length, 2);
  assert.doesNotMatch(workflow, /secrets\.DATABASE_URL\b|APP_RUNTIME_DATABASE_URL|MIGRATOR_DATABASE_URL/);
  const assignments = fs.readFileSync('.env.example', 'utf8').split('\n').filter(line => /^[A-Z][A-Z0-9_]*=/.test(line));
  assert(assignments.every(line => /^[A-Z][A-Z0-9_]*=$/.test(line)));
  for (const name of ['APP_RUNTIME_DATABASE_URL', 'MIGRATOR_DATABASE_URL', 'RETENTION_JOB_DATABASE_URL']) assert(assignments.includes(`${name}=`));
});
