# Activate the PipWise retention scheduler

The nightly workflow is in [.github/workflows/data-retention.yml](../.github/workflows/data-retention.yml). **Current check, 9 November 2026: it exists on the default branch and scheduled runs start, but all three observed runs failed. Successful recurring cleanup is not established.** No source was pushed, GitHub secret copied, job triggered, production purge performed, or least-privilege SQL executed during this verification. Complete the [manual database-role rollout](DATA_LAYER_LEAST_PRIVILEGE.md) and branch tests before using the scoped job credential.

## Observed Actions history — 9 November 2026

Connected GitHub repository metadata reports default branch `main` at `331c1aa93f967d485c1c7f85e55892285bdcfae9`. The remote workflow exactly matches the local file (Git blob SHA `4180e87ed99f9761c7c14985c4556fcf05d26472`). The repository runs response returned `total_count: 3`, all for this retention workflow:

| Run | Event / conclusion | Created, Africa/Addis_Ababa |
| --- | --- | --- |
| [42582423253](https://github.com/Natananse/pipwise/actions/runs/42582423253) | schedule / failure | 9 November 2026, 10:56:00 |
| [42458200197](https://github.com/Natananse/pipwise/actions/runs/42458200197) | schedule / failure | 8 November 2026, 10:17:46 |
| [42349846441](https://github.com/Natananse/pipwise/actions/runs/42349846441) | schedule / failure | 7 November 2026, 10:06:15 |

No successful scheduled run or manual dry run appears in that returned history. These timestamps are run-creation times, not proof the requested 04:17 local schedule ran on time. In the latest [job 129044100658](https://github.com/Natananse/pipwise/actions/runs/42582423253/job/129044100658), checkout, Node 24.18.0, pnpm 11.20.0 and locked dependency installation succeeded; step 7, **Delete feedback eligible under the retention policy**, failed. The manual preview step was skipped as expected for a scheduled run. Step metadata alone does not identify whether the failure is a credential, permission or application error.

A targeted, credential-free log check isolated this application-generated message at **10:56:59 Africa/Addis_Ababa**:

```text
Feedback retention cleanup failed. Set RETENTION_JOB_DATABASE_URL with the retention_job database credential.
```

This is the missing/blank configuration guard in `scripts/database-config.mjs`, reached before database client creation or queries. The scheduled process received no usable dedicated connection value; the message does not distinguish an absent GitHub secret from an empty or unavailable one. Complete the role/branch validation first, then privately add/correct the repository Actions secret **RETENTION_JOB_DATABASE_URL** for the intended **retention_job** login, following step 3 below. Never substitute the owner or migrator URL. The raw job log and environment payload were not reproduced, and no rerun was requested.

The existing repository is [Natananse/pipwise](https://github.com/Natananse/pipwise), public, with default branch `main` (verified through the connected GitHub repository metadata). Standard GitHub-hosted Actions runners are free for public repositories. [GitHub billing guidance](https://docs.github.com/en/actions/concepts/billing-and-usage).

The workflow runs `scripts/purge-retained-data.mjs --execute` at 01:17 UTC / 04:17 Africa/Addis_Ababa each day. Manual runs default to a dry run; setting the manual **execute** input to true authorizes the purge. The updated script uses only private `RETENTION_JOB_DATABASE_URL`, authenticated as `retention_job`, and reports aggregate counts rather than credentials or feedback content. It does not fall back to `DATABASE_URL` or the migrator credential. The job can read the feedback cutoff column and delete rows older than the 12-month cutoff; it cannot read message/user columns or other tables. See [FEEDBACK_RETENTION.md](FEEDBACK_RETENTION.md) for the deletion cutoff and script behavior.

## Owner activation steps

1. Review the maintenance script, tests, workflow, and manual least-privilege SQL with the release changes. Test and apply the SQL through the owner-run process; the source implementation has not executed it. The workflow is already on `main`; ensure its referenced script/helper/package lockfile and any approved fixes are there too.
2. Open the repository's **Settings > Actions > General**. Enable GitHub Actions and allow the official `actions/checkout`, `actions/setup-node` and `pnpm/action-setup` actions used by this workflow. Administrative Actions settings were not verified because local `gh` is not authenticated and the connector does not expose that endpoint.
3. Open **Settings > Secrets and variables > Actions > New repository secret**. Add **`RETENTION_JOB_DATABASE_URL`** containing the intended production-branch pooled connection for the new **`retention_job`** role. Use the same database/branch as the maintained hosting server but a different scoped login. Set its password privately as described in the role-rollout guide. Do not copy the owner or `migrator` connection. Never paste a value into source, a workflow literal, an issue, a log or this document. Retire any old broad job `DATABASE_URL` secret after the scoped path is verified. [GitHub secret instructions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets).
4. Open **Actions > PipWise data retention > Run workflow** on `main`. Leave **execute=false** for the first run. Verify it succeeds and the eligible count matches expectations.
5. Review the eligible records privately if the count is unexpected. Run again with **execute=true** only when the intended database/cutoff is confirmed. Scheduled runs execute the purge automatically after the workflow lands on `main` and required settings/secret are available.
6. Verify the first scheduled run and retain its run URL/status as operational evidence. Enable workflow failure notifications and investigate failures promptly. Keep the secret current when rotating database credentials.

## Scheduling limitations to monitor

GitHub schedules run from the default branch and can be delayed or occasionally dropped under load. Public-repository schedules are disabled after 60 days without repository activity. Check the Actions page regularly, re-enable disabled workflows and perform a manual catch-up run when needed. Do not claim an operational nightly retention guarantee until activation and monitoring are in place. The server's opportunistic cleanup on valid feedback submissions provides another cleanup opportunity; it does not replace this schedule. [GitHub schedule behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

Deleting expired rows at a nightly boundary can trail their exact cutoff by one run interval, and a missed run can extend that delay. The public policy must describe the actual operational retention/deletion window rather than promising a stronger deadline than the operator can meet.

## Why this does not use Expo scheduled workflows

Expo's documented cron trigger requires a paid plan and reads scheduled workflows from the connected repository's default branch. A one-time `eas workflow:run` uploads/runs local source; it is not evidence that recurring scheduling is active. The prepared GitHub Actions job avoids adding a paid scheduler. [Expo schedule requirements](https://docs.expo.dev/eas/workflows/syntax/#onschedulecron).

Neon also supports `pg_cron`, but it runs only while compute is active; enabling it can require compute settings/restart. It was not configured as a substitute for an external schedule on a scale-to-zero database. [Neon pg_cron behavior](https://neon.com/docs/extensions/pg_cron).
