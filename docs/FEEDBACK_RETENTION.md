# Feedback retention operation

**Current setup, 10 November 2026:** the native Neon nightly scheduler is enabled for **04:17 Africa/Addis_Ababa**, with the next run on **11 November**. The owner explicitly approved cleanup. The deployed dry run returned zero eligible rows and a genuine count-only scheduled proof passed; the first actual nightly purge is still pending. GitHub Actions is manual-only. See [verified configuration, evidence and monitoring](RETENTION_SCHEDULER_SETUP.md).

The operator's policy is feedback retention for up to 12 months. `src/server/feedbackRetention.ts` deletes feedback whose `created_at` is at least 12 calendar months old. It returns a count only; messages and account details are not logged. Account deletion removes that account's feedback immediately through the database foreign key.

The authenticated feedback API runs this purge before each valid feedback insert. This is an additional safeguard, not a scheduler: an idle application has no requests to trigger cleanup. A regular, monitored maintenance job is necessary to enforce time-based retention independently of usage. Run it daily, monitor failures, and verify the oldest retained feedback timestamp. Add a safety margin before the maximum retention age if the operator requires a strict maximum despite scheduler delays.

The reviewed [least-privilege SQL is applied and verified](DATA_LAYER_VERIFICATION_2026_11_10.md); do not repeat its bootstrap. Use Node 24 with only the dedicated `retention_job` connection. The ignored mode-0600 `.env.retention` holds the current private configuration. The script rejects owner credentials and never falls back to `DATABASE_URL`:

```bash
pnpm exec node scripts/purge-retained-data.mjs --env .env.retention
```

The default is a dry run: it returns only the number of eligible records. For an intentionally authorized manual purge after confirming the count:

```bash
pnpm exec node scripts/purge-retained-data.mjs --execute --env .env.retention
```

For a deliberately selected private env file:

```bash
pnpm exec node scripts/purge-retained-data.mjs --execute --env /path/to/private.env
```

Do not expose this command through an unauthenticated public endpoint or put a database credential in a workflow file, URL, or `EXPO_PUBLIC_*` variable. The command is idempotent and can be retried. A successful exit code is required; a failed job must alert the operator through the chosen scheduler's normal failure notifications.

Existing-platform scheduler options, researched 6 November 2026:

- **Expo Workflows:** supports scheduled custom jobs with `environment: production` and private Expo environment variables. Scheduled workflows require a paid plan and run from the repository's default branch; delays or skipped executions are possible. A workflow must actually be enabled and monitored before relying on it. [Workflow schedule syntax](https://docs.expo.dev/eas/workflows/syntax/#onschedulecron), [workflow environment variables](https://docs.expo.dev/eas/workflows/environment/).
- **Neon `pg_cron`:** available for in-database cleanup, but requires compute configuration and a restart to enable it. It only runs while compute is active, so it does not enforce retention on a compute that remains scaled to zero. Do not disable scale to zero or restart production merely to enable it without reviewing the operational cost/impact. [Neon pg_cron documentation](https://neon.com/docs/extensions/pg_cron).
- **Neon Function Triggers — selected:** [`neon.retention.ts`](../neon.retention.ts) is deployed to the existing supported Frankfurt relay project and queries the maintained London app database only as `retention_job`. No replacement database was created. Its `/scheduled` handler accepts only validated native trigger delivery; the separately authenticated `/dry-run` handler only counts. Deployment 2 and the enabled nightly trigger were verified on 10 November. [Maintenance and monitoring](RETENTION_SCHEDULER_SETUP.md#native-neon-maintenance-deploy-disabled-first), [Neon Function Triggers](https://neon.com/docs/compute/functions/triggers/overview).

Only Neon owns recurring cleanup. The old GitHub cron was removed from `main`; all four historical runs failed and were complete before handoff. Its workflow remains an unconfigured manual fallback. Future rotation/recovery should deploy the native policy disabled first, verify counts/authentication, and stop/drain the previous scheduler before enabling recurrence. The application/email runtime and migrator credentials do not belong in this function. Record the first actual nightly execution after 04:17 on 11 November and monitor failures. Neither scheduler purges provider SMTP/hosting logs or backups; those have separate provider retention settings.
