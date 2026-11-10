/// <reference types="node" />
import { defineConfig } from '@neon/config/v1';
import { databaseConnectionString } from './scripts/database-config.mjs';

const scheduleEnabled = process.env.PIPWISE_RETENTION_SCHEDULE_ENABLED;
if (scheduleEnabled !== '0' && scheduleEnabled !== '1') {
  throw new Error('Set PIPWISE_RETENTION_SCHEDULE_ENABLED explicitly to 0 or 1.');
}
const checkSecret = process.env.PIPWISE_RETENTION_CHECK_SECRET;
if (!checkSecret || !/^[\x21-\x7e]{43,512}$/.test(checkSecret)) {
  throw new Error('Set PIPWISE_RETENTION_CHECK_SECRET to at least 43 printable characters.');
}
const retentionDatabaseUrl = databaseConnectionString(process.env, {
  variable: 'RETENTION_JOB_DATABASE_URL', role: 'retention_job',
});
const directRetentionDatabaseUrl = new URL(retentionDatabaseUrl);
directRetentionDatabaseUrl.hostname = directRetentionDatabaseUrl.hostname.replace('-pooler.', '.');

// Deploy only to the existing supported-region relay project with explicit IDs.
// This independent policy does not redeploy the application's email function.
export default defineConfig({
  functions: {
    retention: {
      name: 'PipWise feedback retention',
      source: 'src/functions/feedbackRetention.ts',
      env: {
        RETENTION_JOB_DATABASE_URL: retentionDatabaseUrl,
        // Replace the relay project's automatically injected owner credentials.
        // The handler still selects only RETENTION_JOB_DATABASE_URL.
        DATABASE_URL: retentionDatabaseUrl,
        DATABASE_URL_UNPOOLED: directRetentionDatabaseUrl.href,
        PIPWISE_RETENTION_CHECK_SECRET: checkSecret,
      },
    },
  },
  triggers: {
    'pipwise-feedback-retention': {
      type: 'schedule',
      function: 'retention',
      cron: '17 1 * * *',
      functionPath: '/scheduled',
      enabled: scheduleEnabled === '1',
    },
  },
});
