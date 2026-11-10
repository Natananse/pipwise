# Feedback retention operation

The operator's policy is feedback retention for up to 12 months. `src/server/feedbackRetention.ts` deletes feedback whose `created_at` is at least 12 calendar months old. It returns a count only; messages and account details are not logged. Account deletion removes that account's feedback immediately through the database foreign key.

The authenticated feedback API runs this purge before each valid feedback insert. This is an additional safeguard, not a scheduler: an idle application has no requests to trigger cleanup. A regular, monitored maintenance job is necessary to enforce time-based retention independently of usage. Run it daily, monitor failures, and verify the oldest retained feedback timestamp. Add a safety margin before the maximum retention age if the operator requires a strict maximum despite scheduler delays.

After the owner manually applies and verifies the reviewed [least-privilege SQL](DATA_LAYER_LEAST_PRIVILEGE.md), use Node 24 with `RETENTION_JOB_DATABASE_URL` containing only the `retention_job` connection. The script rejects owner credentials and never falls back to `DATABASE_URL`:

```bash
pnpm exec node scripts/purge-retained-data.mjs
```

The default is a dry run: it returns only the number of eligible records. To execute the purge, including from the scheduled workflow:

```bash
pnpm exec node scripts/purge-retained-data.mjs --execute
```

For a deliberately selected private env file:

```bash
pnpm exec node scripts/purge-retained-data.mjs --execute --env /path/to/private.env
```

Do not expose this command through an unauthenticated public endpoint or put a database credential in a workflow file, URL, or `EXPO_PUBLIC_*` variable. The command is idempotent and can be retried. A successful exit code is required; a failed job must alert the operator through the chosen scheduler's normal failure notifications.

Existing-platform scheduler options, researched 6 November 2026:

- **Expo Workflows:** supports scheduled custom jobs with `environment: production` and private Expo environment variables. Scheduled workflows require a paid plan and run from the repository's default branch; delays or skipped executions are possible. A workflow must actually be enabled and monitored before relying on it. [Workflow schedule syntax](https://docs.expo.dev/eas/workflows/syntax/#onschedulecron), [workflow environment variables](https://docs.expo.dev/eas/workflows/environment/).
- **Neon `pg_cron`:** available for in-database cleanup, but requires compute configuration and a restart to enable it. It only runs while compute is active, so it does not enforce retention on a compute that remains scaled to zero. Do not disable scale to zero or restart production merely to enable it without reviewing the operational cost/impact. [Neon pg_cron documentation](https://neon.com/docs/extensions/pg_cron).
- **Neon Function Triggers:** can wake at scale to zero. The app's existing `aws-eu-west-2` project remains outside the Functions availability list checked by the Neon skill. The prepared [`neon.retention.ts`](../neon.retention.ts) instead targets an explicitly verified, already-existing supported-region relay project and queries the maintained app database with only its scoped `retention_job` connection. It does not create or migrate a database. Its native `/scheduled` handler accepts only a validated platform trigger; its separately authenticated `/dry-run` handler only counts. Neither this source nor mocked tests establish a deployed or successful schedule. Use the [disabled-first deployment, native verification and scheduler handoff](RETENTION_SCHEDULER_SETUP.md#native-neon-alternative-deploy-disabled-first). [Neon Function Triggers](https://neon.com/docs/compute/functions/triggers/overview).

Choose one active scheduler. For GitHub Actions, the workflow must be on the default branch with the private `RETENTION_JOB_DATABASE_URL` repository secret configured; its last recorded runs failed. For native Neon, deploy the independent policy with `PIPWISE_RETENTION_SCHEDULE_ENABLED=0`, verify the scoped role and authenticated count-only request, then complete the documented handoff before setting the gate to `1`. The application/email runtime and migrator credentials do not belong in this function. Record a successful dry run and the first actual scheduled execution, and assign failure monitoring. This source work does not claim deployment or successful cleanup. Neither scheduler purges provider SMTP/hosting logs or backups; those have separate provider retention settings.
