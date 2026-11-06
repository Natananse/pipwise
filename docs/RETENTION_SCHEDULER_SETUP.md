# Activate the PipWise retention scheduler

The nightly workflow is prepared in [.github/workflows/data-retention.yml](../.github/workflows/data-retention.yml). **It is not active merely because this file exists locally.** No source was pushed, GitHub secret copied or production purge performed during preparation.

The existing repository is [Natananse/pipwise](https://github.com/Natananse/pipwise), public, with default branch `main` (verified through the connected GitHub repository metadata). Standard GitHub-hosted Actions runners are free for public repositories. [GitHub billing guidance](https://docs.github.com/en/actions/concepts/billing-and-usage).

The workflow runs `scripts/purge-retained-data.mjs --execute` at 01:17 UTC / 04:17 Africa/Addis_Ababa each day. Manual runs default to a dry run; setting the manual **execute** input to true authorizes the purge. The script uses only the private `DATABASE_URL` environment variable and reports aggregate counts rather than credentials or feedback content. See [FEEDBACK_RETENTION.md](FEEDBACK_RETENTION.md) for the deletion cutoff and script behavior.

## Owner activation steps

1. Review the maintenance script, tests and workflow with the rest of the release changes, then commit/push the approved files to the repository's default branch, `main`. The workflow and its referenced script/helper/package lockfile must all exist there. This task intentionally leaves changes uncommitted for review.
2. Open the repository's **Settings > Actions > General**. Enable GitHub Actions and allow the official `actions/checkout`, `actions/setup-node` and `pnpm/action-setup` actions used by this workflow. Administrative Actions settings were not verified because local `gh` is not authenticated and the connector does not expose that endpoint.
3. Open **Settings > Secrets and variables > Actions > New repository secret**. Add a secret named **`DATABASE_URL`** containing the existing intended production-branch pooled database connection. Use the same database as the app's maintained hosting server. Copy it privately from the provider or hosting environment; never paste it into source, a workflow literal, an issue, a log or this document. [GitHub secret instructions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets).
4. Open **Actions > PipWise data retention > Run workflow** on `main`. Leave **execute=false** for the first run. Verify it succeeds and the eligible count matches expectations.
5. Review the eligible records privately if the count is unexpected. Run again with **execute=true** only when the intended database/cutoff is confirmed. Scheduled runs execute the purge automatically after the workflow lands on `main` and required settings/secret are available.
6. Verify the first scheduled run and retain its run URL/status as operational evidence. Enable workflow failure notifications and investigate failures promptly. Keep the secret current when rotating database credentials.

## Scheduling limitations to monitor

GitHub schedules run from the default branch and can be delayed or occasionally dropped under load. Public-repository schedules are disabled after 60 days without repository activity. Check the Actions page regularly, re-enable disabled workflows and perform a manual catch-up run when needed. Do not claim an operational nightly retention guarantee until activation and monitoring are in place. The server's opportunistic cleanup on valid feedback submissions provides another cleanup opportunity; it does not replace this schedule. [GitHub schedule behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

Deleting expired rows at a nightly boundary can trail their exact cutoff by one run interval, and a missed run can extend that delay. The public policy must describe the actual operational retention/deletion window rather than promising a stronger deadline than the operator can meet.

## Why this does not use Expo scheduled workflows

Expo's documented cron trigger requires a paid plan and reads scheduled workflows from the connected repository's default branch. A one-time `eas workflow:run` uploads/runs local source; it is not evidence that recurring scheduling is active. The prepared GitHub Actions job avoids adding a paid scheduler. [Expo schedule requirements](https://docs.expo.dev/eas/workflows/syntax/#onschedulecron).

Neon also supports `pg_cron`, but it runs only while compute is active; enabling it can require compute settings/restart. It was not configured as a substitute for an external schedule on a scale-to-zero database. [Neon pg_cron behavior](https://neon.com/docs/extensions/pg_cron).
