import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';
import { countExpiredFeedback, purgeExpiredFeedback } from '../src/server/feedbackRetention.ts';

/** Run with the pinned Node 24 runtime and a private DATABASE_URL. */
export async function runFeedbackRetention(env = process.env, { execute = false } = {}) {
  if (!env.DATABASE_URL) throw new Error('DATABASE_NOT_CONFIGURED');
  const sql = neon(env.DATABASE_URL);
  return execute ? { mode: 'execute', removed: await purgeExpiredFeedback(sql) }
    : { mode: 'dry-run', eligible: await countExpiredFeedback(sql) };
}

async function main(args) {
  try {
    let execute = false;
    let envFile;
    for (let index = 0; index < args.length; index++) {
      if (args[index] === '--execute') execute = true;
      else if (args[index] === '--env' && args[index + 1]) envFile = resolve(args[++index]);
      else throw new Error('INVALID_OPTIONS');
    }
    if (envFile && !existsSync(envFile)) throw new Error('ENV_FILE_NOT_FOUND');
    const files = envFile ? [envFile] : ['.env.local', '.env'];
    for (const file of files) if (existsSync(file)) process.loadEnvFile(file);
    const result = await runFeedbackRetention(process.env, { execute });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    // Driver messages may include credentials or row values. Never print them.
    const reason = error instanceof Error && ['DATABASE_NOT_CONFIGURED', 'INVALID_OPTIONS', 'ENV_FILE_NOT_FOUND'].includes(error.message)
      ? error.message : 'CLEANUP_FAILED';
    process.stderr.write(`Feedback retention cleanup failed (${reason}).\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
