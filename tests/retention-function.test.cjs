const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');

const secret = 'synthetic-retention-check-secret-0123456789-abcdefghijklmnop';
const connection = 'postgresql://retention_job:SYNTHETIC_PASSWORD@fixture-pooler.example.test/neondb?sslmode=require';
const triggerName = 'pipwise-feedback-retention';
const fixtureEnv = {
  RETENTION_JOB_DATABASE_URL: connection,
  PIPWISE_RETENTION_CHECK_SECRET: secret,
  PIPWISE_RETENTION_SCHEDULE_ENABLED: '0',
  // Neither injected connections nor other role credentials may be fallbacks.
  DATABASE_URL: 'postgresql://relay_owner:UNUSED@relay.example.test/relay',
  DATABASE_URL_UNPOOLED: 'postgresql://relay_owner:UNUSED@relay.example.test/relay',
  APP_RUNTIME_DATABASE_URL: 'postgresql://app_runtime:UNUSED@app.example.test/neondb',
  MIGRATOR_DATABASE_URL: 'postgresql://migrator:UNUSED@app.example.test/neondb',
};

function load(file, imports, env = {}, logs = []) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module, exports: module.exports, Request, Response, Headers, URL, Uint8Array, TextDecoder,
    process: { env },
    console: {
      info(value) { logs.push({ level: 'info', value }); },
      error(value) { logs.push({ level: 'error', value }); },
    },
    fetch() { assert.fail('Retention tests must not make network requests'); },
    require(name) {
      assert.ok(Object.hasOwn(imports, name), `Unexpected import ${name}`);
      return imports[name];
    },
  }, { filename: file });
  return module.exports;
}

async function harness({ overrides = {}, fail = false } = {}) {
  // Use the published platform parser and existing validator/cutoff code.
  // Only the database transport is mocked.
  const parser = await import('@neon/functions/triggers');
  const validator = await import('../scripts/database-config.mjs');
  const env = { ...fixtureEnv, ...overrides };
  const seen = { connections: [], queries: [], logs: [] };
  const sql = async (strings, ...values) => {
    const query = strings.join('?');
    seen.queries.push({ query, values });
    if (fail) throw new Error(`PRIVATE_DRIVER_ERROR ${connection} PRIVATE_FEEDBACK`);
    return query.includes('DELETE FROM') ? [{ removed: 3 }] : [{ eligible: 5 }];
  };
  const retention = load('src/server/feedbackRetention.ts', {});
  const handler = load('src/functions/feedbackRetention.ts', {
    'node:crypto': crypto,
    '@neondatabase/serverless': { neon(value) { seen.connections.push(value); return sql; } },
    '@neon/functions/triggers': parser,
    '../../scripts/database-config.mjs': validator,
    '../server/feedbackRetention': retention,
  }, env, seen.logs).default.fetch;
  return { handler, seen };
}

function envelope(overrides = {}) {
  return {
    version: 1,
    invocation_id: 'synthetic-occurrence-1',
    trigger: { type: 'schedule', id: 'trigger-synthetic', name: triggerName },
    data: { scheduled_at: '2026-11-10T01:17:00Z' },
    ...overrides,
  };
}

function request({ path = '/scheduled', method = 'POST', body, headers = {} } = {}) {
  const allHeaders = {
    'Content-Type': 'application/json',
    ...(path.startsWith('/scheduled') ? { 'X-Neon-Trigger-Invocation-Id': 'synthetic-occurrence-1' } : {}),
    ...headers,
  };
  for (const name of Object.keys(allHeaders)) if (allHeaders[name] === null) delete allHeaders[name];
  return new Request(`https://fixture-retention.compute.example.test${path}`, {
    method, headers: allHeaders,
    ...(['GET', 'HEAD'].includes(method) ? {} : { body: body ?? JSON.stringify(envelope()) }),
  });
}

function dryRun(options = {}) {
  return request({ path: '/dry-run', body: '{}', ...options,
    headers: { 'x-pipwise-retention-check': secret, ...options.headers } });
}

function noDatabase(seen) {
  assert.equal(seen.connections.length, 0);
  assert.equal(seen.queries.length, 0);
}

test('platform schedule envelope uses the real parser and unchanged expired-feedback cutoff', async () => {
  const h = await harness();
  const response = await h.handler(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { mode: 'execute', removed: 3 });
  assert.deepEqual(h.seen.connections, [connection]);
  assert.equal(h.seen.queries.length, 1);
  assert.match(h.seen.queries[0].query, /DELETE FROM public\.beta_feedback/);
  assert.match(h.seen.queries[0].query, /created_at <= now\(\) - interval '12 months'/);
  assert.equal(h.seen.queries[0].values.length, 0, 'Caller payload must not choose a cutoff or account');
  assert.deepEqual(JSON.parse(h.seen.logs[0].value), {
    event: 'feedback-retention', ok: true, mode: 'execute', removed: 3, invocationId: 'synthetic-occurrence-1',
  });
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('public calls without the native-edge header cannot reach a database', async () => {
  const h = await harness();
  for (const header of [null, '   ']) {
    const response = await h.handler(request({ headers: { 'X-Neon-Trigger-Invocation-Id': header } }));
    assert.equal(response.status, 401);
  }
  noDatabase(h.seen);
});

test('real parser rejects mismatched IDs and malformed envelopes before database creation', async () => {
  const h = await harness();
  const cases = [
    [envelope({ invocation_id: 'another-occurrence' }), 401],
    [envelope({ version: 2 }), 400],
    [envelope({ data: {} }), 400],
    [envelope({ trigger: { type: 'unknown', id: 'trigger-synthetic', name: triggerName } }), 400],
    [[], 400],
  ];
  for (const [body, expectedStatus] of cases) {
    const response = await h.handler(request({ body: JSON.stringify(body) }));
    assert.equal(response.status, expectedStatus);
    assert.deepEqual(await response.json(), { error: { code: 'INVALID_TRIGGER' } });
  }
  noDatabase(h.seen);
});

test('valid platform envelopes for another trigger or event type do not authorize cleanup', async () => {
  const h = await harness();
  for (const body of [
    envelope({ trigger: { type: 'schedule', id: 'trigger-other', name: 'other-job' } }),
    envelope({
      trigger: { type: 'storage_object_created', id: 'trigger-synthetic', name: triggerName },
      data: { bucket_name: 'fixture', object_key: 'fixture.json' },
    }),
  ]) {
    const response = await h.handler(request({ body: JSON.stringify(body) }));
    assert.equal(response.status, 401);
  }
  noDatabase(h.seen);
});

test('dry run requires its own strong private secret and never creates a database on auth failure', async () => {
  for (const overrides of [{}, { PIPWISE_RETENTION_CHECK_SECRET: '' }, { PIPWISE_RETENTION_CHECK_SECRET: 'short' }]) {
    const h = await harness({ overrides });
    for (const supplied of [null, 'short', 'different-retention-check-secret-0123456789-abcdefghijklmnop']) {
      const response = await h.handler(dryRun({ headers: { 'x-pipwise-retention-check': supplied } }));
      assert.equal(response.status, Object.keys(overrides).length ? 503 : 401);
    }
    noDatabase(h.seen);
  }
});

test('authenticated dry run only counts using the existing cutoff', async () => {
  const h = await harness();
  const response = await h.handler(dryRun());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { mode: 'dry-run', eligible: 5 });
  assert.deepEqual(h.seen.connections, [connection]);
  assert.equal(h.seen.queries.length, 1);
  assert.match(h.seen.queries[0].query, /SELECT count\(\*\)::integer AS eligible/);
  assert.match(h.seen.queries[0].query, /created_at <= now\(\) - interval '12 months'/);
  assert.doesNotMatch(h.seen.queries[0].query, /DELETE|UPDATE|INSERT/);
});

test('dry-run execution instructions and caller-controlled fields are rejected before database creation', async () => {
  const h = await harness();
  for (const body of [{ execute: true }, { execute: false }, { cutoff: '2100-01-01' }, [], null]) {
    const response = await h.handler(dryRun({ body: JSON.stringify(body) }));
    assert.equal(response.status, 400);
  }
  noDatabase(h.seen);
});

test('unknown paths, queries, methods and non-JSON requests cannot reach a database', async () => {
  const h = await harness();
  for (const [options, status] of [
    [{ path: '/' }, 404], [{ path: '/scheduled/' }, 404], [{ path: '/scheduled?execute=true' }, 404],
    [{ method: 'GET' }, 405], [{ method: 'PUT' }, 405],
    [{ headers: { 'Content-Type': 'text/plain' } }, 415],
    [{ headers: { 'Content-Type': null } }, 415],
  ]) assert.equal((await h.handler(request(options))).status, status);
  assert.equal((await h.handler(dryRun({ path: '/dry-run?execute=true' }))).status, 404);
  noDatabase(h.seen);
});

test('declared and streamed body limits, bad UTF-8 and invalid JSON fail before database creation', async () => {
  const h = await harness();
  for (const [body, headers, status] of [
    [JSON.stringify(envelope()), { 'Content-Length': String(64 * 1024 + 1) }, 413],
    [JSON.stringify(envelope()), { 'Content-Length': 'not-a-length' }, 413],
    [' '.repeat(64 * 1024 + 1), {}, 413],
    [new Uint8Array([0xff, 0xfe]), {}, 400],
    ['{', {}, 400],
  ]) assert.equal((await h.handler(request({ body, headers }))).status, status);
  noDatabase(h.seen);
});

test('large legitimate retry history fits the bounded platform envelope', async () => {
  const h = await harness();
  const response = await h.handler(request({ body: JSON.stringify(envelope({
    previous_attempts: [{ status_code: 503, response_body: 'x'.repeat(32 * 1024) }],
  })) }));
  assert.equal(response.status, 200);
});

test('missing, application, owner and migrator credentials never fall back to injected URLs', async () => {
  for (const value of [undefined, '', connection.replace('retention_job:', 'app_runtime:'),
    connection.replace('retention_job:', 'neondb_owner:'), connection.replace('retention_job:', 'migrator:')]) {
    const h = await harness({ overrides: { RETENTION_JOB_DATABASE_URL: value } });
    const response = await h.handler(request());
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: { code: 'RETENTION_UNAVAILABLE' } });
    noDatabase(h.seen);
  }
});

test('database failures expose only fixed errors and aggregate log metadata', async () => {
  const h = await harness({ fail: true });
  const response = await h.handler(request());
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('retry-after'), '60');
  const payload = await response.json();
  assert.deepEqual(payload, { error: { code: 'RETENTION_UNAVAILABLE' } });
  const serialized = JSON.stringify({ payload, logs: h.seen.logs });
  for (const sensitive of [connection, secret, 'PRIVATE_DRIVER_ERROR', 'PRIVATE_FEEDBACK', 'SYNTHETIC_PASSWORD']) {
    assert.ok(!serialized.includes(sensitive));
  }
  assert.deepEqual(JSON.parse(h.seen.logs[0].value), { event: 'feedback-retention', ok: false, mode: 'execute' });
});

async function configuration(overrides = {}) {
  return load('neon.retention.ts', {
    '@neon/config/v1': await import('@neon/config/v1'),
    './scripts/database-config.mjs': await import('../scripts/database-config.mjs'),
  }, { ...fixtureEnv, ...overrides }).default;
}

test('deployment explicitly gates its exact schedule and replaces both injected owner connections', async () => {
  for (const flag of ['0', '1']) {
    const config = await configuration({ PIPWISE_RETENTION_SCHEDULE_ENABLED: flag });
    const job = config.functions.retention;
    assert.equal(job.source, 'src/functions/feedbackRetention.ts');
    assert.deepEqual(JSON.parse(JSON.stringify(config.triggers[triggerName])), {
      type: 'schedule', function: 'retention', cron: '17 1 * * *', functionPath: '/scheduled', enabled: flag === '1',
    });
    assert.deepEqual(Object.keys(job.env).sort(), [
      'DATABASE_URL', 'DATABASE_URL_UNPOOLED', 'PIPWISE_RETENTION_CHECK_SECRET', 'RETENTION_JOB_DATABASE_URL',
    ]);
    assert.equal(job.env.RETENTION_JOB_DATABASE_URL, connection);
    assert.equal(job.env.DATABASE_URL, connection);
    const direct = new URL(job.env.DATABASE_URL_UNPOOLED);
    assert.equal(direct.username, 'retention_job');
    assert.equal(direct.hostname, 'fixture.example.test');
    assert.equal(direct.pathname, '/neondb');
  }
});

test('deployment refuses implicit schedule activation, weak check secrets and wrong roles', async () => {
  for (const flag of [undefined, '', 'true', ' 1', '2']) {
    await assert.rejects(configuration({ PIPWISE_RETENTION_SCHEDULE_ENABLED: flag }), /explicitly to 0 or 1/);
  }
  for (const value of [undefined, '', 'short', 'x'.repeat(513), 'x'.repeat(43) + '\n']) {
    await assert.rejects(configuration({ PIPWISE_RETENTION_CHECK_SECRET: value }), /43 printable characters/);
  }
  await assert.rejects(configuration({ RETENTION_JOB_DATABASE_URL: connection.replace('retention_job:', 'app_runtime:') }),
    error => error.name === 'DatabaseConfigError');
});
