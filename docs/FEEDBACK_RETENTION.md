# Feedback retention operation

The operator's policy is feedback retention for up to 12 months. `src/server/feedbackRetention.ts` deletes feedback whose `created_at` is at least 12 calendar months old. It returns a count only; messages and account details are not logged. Account deletion removes that account's feedback immediately through the database foreign key.

The authenticated feedback API runs this purge before each valid feedback insert. This is an additional safeguard, not a scheduler: an idle application has no requests to trigger cleanup. A regular, monitored maintenance job is necessary to enforce time-based retention independently of usage. Run it daily, monitor failures, and verify the oldest retained feedback timestamp. Add a safety margin before the maximum retention age if the operator requires a strict maximum despite scheduler delays.

From a trusted runtime with Node 24 and the private production `DATABASE_URL` supplied as an environment secret:

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
- **Neon Function Triggers:** can wake at scale to zero, but the existing project's `aws-eu-west-2` region is outside the Functions availability list checked by the Neon skill. This task does not provision a replacement project or migrate the backend for scheduling.

The checked-in GitHub Actions retention workflow must be on the default branch with its production database secret configured before it can run. Merely adding a workflow file does not activate or verify it. Production setup must record its first successful run and who monitors failures. This command does not purge provider SMTP/hosting logs or backups; those have separate provider retention settings.
