# Activate the PipWise retention scheduler

The nightly workflow is in [.github/workflows/data-retention.yml](../.github/workflows/data-retention.yml). **Last operational check, 9 November 2026: it exists on the default branch and scheduled runs start, but all three observed runs failed. Successful recurring cleanup is not established.** The 10 November source work also prepares an independent native Neon scheduler in [`neon.retention.ts`](../neon.retention.ts); it has not been deployed or verified against a live service by these source checks. Choose one monitored scheduler using the handoff below. Complete the [manual database-role rollout](DATA_LAYER_LEAST_PRIVILEGE.md) and branch tests before using the scoped job credential. These instructions do not record a secret update, deployment, successful cleanup or production SQL cutover.

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

## GitHub Actions activation

1. Review the maintenance script, tests, workflow, and manual least-privilege SQL with the release changes. Test and apply the SQL through the owner-run process; the source implementation has not executed it. The workflow is already on `main`; ensure its referenced script/helper/package lockfile and any approved fixes are there too.
2. Open the repository's **Settings > Actions > General**. Enable GitHub Actions and allow the official `actions/checkout`, `actions/setup-node` and `pnpm/action-setup` actions used by this workflow. Administrative Actions settings were not verified because local `gh` is not authenticated and the connector does not expose that endpoint.
3. First run the [local count-only preview](FEEDBACK_RETENTION.md) against the verified intended database and confirm the count privately. The existing GitHub schedule executes automatically once its secret works, so adding it is an activation step; perform that step during a monitored window. Open **Settings > Secrets and variables > Actions > New repository secret**. Add **`RETENTION_JOB_DATABASE_URL`** containing the intended production-branch pooled connection for the new **`retention_job`** role. Use the same database/branch as the maintained hosting server but a different scoped login. Set its password privately as described in the role-rollout guide. Do not copy the owner or `migrator` connection. Never paste a value into source, a workflow literal, an issue, a log or this document. Retire any old broad job `DATABASE_URL` secret after the scoped path is verified. [GitHub secret instructions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets).
4. Open **Actions > PipWise data retention > Run workflow** on `main`. Leave **execute=false** for the first run. Verify it succeeds and the eligible count matches expectations.
5. Review the eligible records privately if the count is unexpected. Run again with **execute=true** only when the intended database/cutoff is confirmed. Scheduled runs execute the purge automatically after the workflow lands on `main` and required settings/secret are available.
6. Verify the first scheduled run and retain its run URL/status as operational evidence. Enable workflow failure notifications and investigate failures promptly. Keep the secret current when rotating database credentials.

## Native Neon alternative: deploy disabled first

[`src/functions/feedbackRetention.ts`](../src/functions/feedbackRetention.ts) provides a bounded, count-only `POST /dry-run` and a native-trigger-only `POST /scheduled`. Both use only `RETENTION_JOB_DATABASE_URL` as `retention_job` and the existing 12-calendar-month cutoff. The trigger handler validates the platform envelope and exact trigger name with the installed `@neon/functions/triggers` parser. Its trust boundary is Neon's native edge, which strips externally supplied `X-Neon-*` headers; a copied invocation ID is not a secret or independent authorization. Keep this route on the native function host. [Neon trigger authentication](https://neon.com/docs/compute/functions/triggers/overview#confirming-a-request-came-from-neon).

1. Confirm the already-existing relay project's region supports Functions and verify its exact project and branch IDs. The app's existing London project is not the deployment target. Do not create a replacement database or apply this policy to the app project. Validate the scoped database role on a disposable branch before selecting the maintained database credential.
2. Create an ignored private `.env.retention` file with permissions `0600`, containing only `RETENTION_JOB_DATABASE_URL`, a fresh random `PIPWISE_RETENTION_CHECK_SECRET` of 43–512 printable non-space ASCII characters, and `PIPWISE_RETENTION_SCHEDULE_ENABLED=0`. The optional operator-only `PIPWISE_RETENTION_FUNCTION_URL` can be added after obtaining the native host. Keep the role URL and secret out of shell arguments/output. Do not copy the complete application env file. Only fields declared by this independent policy enter the function; its injected pooled/direct DB defaults are replaced with the same scoped retention login. Deployment environments retain omitted old user variables, so inspect names and deliberately remove any stale credentials through private settings. [Neon environment snapshots and overrides](https://neon.com/docs/compute/functions/environment-variables).
3. With reviewed source and the verified IDs, deploy the disabled policy. The explicit flag below overrides an inherited shell/file setting; `--no-env-pull` preserves local app configuration. This command does not deploy `neon.email.ts`:

   ```bash
   PIPWISE_RETENTION_SCHEDULE_ENABLED=0 neon deploy --config neon.retention.ts --project-id '<relay-project-id>' --branch '<relay-branch-id>' --env .env.retention --no-env-pull
   neon functions get retention --project-id '<relay-project-id>' --branch '<relay-branch-id>' -E
   neon triggers list --project-id '<relay-project-id>' --branch '<relay-branch-id>'
   ```

   Inspect the deployed function and variable names without exposing values. Confirm exactly `pipwise-feedback-retention`, function `retention`, path `/scheduled`, cron `17 1 * * *`, and `enabled=false` with no next run. Record the deployment revision, project/branch and trigger ID. CLI syntax was checked against local Neon CLI 8.18.0; use the current [deploy reference](https://neon.com/docs/cli/deploy) if upgrading.
4. Set `PIPWISE_RETENTION_FUNCTION_URL` privately to that function's native HTTPS origin. Run this count-only request from Node 24; the private check secret is loaded from the file and never appears in command arguments:

   ```bash
   node --env-file=.env.retention --input-type=module <<'NODE'
   const origin = new URL(process.env.PIPWISE_RETENTION_FUNCTION_URL);
   if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') {
     throw new Error('Set the verified native HTTPS function origin.');
   }
   const secret = process.env.PIPWISE_RETENTION_CHECK_SECRET;
   if (!secret || !/^[\x21-\x7e]{43,512}$/.test(secret)) throw new Error('Configure the private dry-run secret.');
   const result = await fetch(new URL('/dry-run', origin), {
     method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Pipwise-Retention-Check': secret },
     body: '{}', signal: AbortSignal.timeout(30_000),
   });
   const body = await result.json();
   if (!result.ok || body.mode !== 'dry-run' || !Number.isInteger(body.eligible) || body.eligible < 0) {
     throw new Error(`Retention preview failed (HTTP ${result.status}).`);
   }
   console.log(JSON.stringify({ mode: body.mode, eligible: body.eligible }));
   NODE
   ```

   Confirm the count against the intended branch and cutoff privately. Check that a JSON request with a missing/wrong dry-run secret returns `401`, and that an external JSON `/scheduled` POST, including one with a caller-supplied `X-Neon-Trigger-Invocation-Id`, returns `401` on the native host. Do not publish secret-bearing requests or raw driver logs. Local mocked tests validate parsing, credential selection and request bounds; they do not prove deployed edge stripping, grants or scheduling.
5. Complete the single-scheduler handoff below before enabling deletion. Set the private file's flag to `1`, then run the same deployment command with `PIPWISE_RETENTION_SCHEDULE_ENABLED=1`. Recheck the trigger's enabled state, exact nightly cron and next run. Do not add a public execution option or forge headers to test deletion. The authenticated dry-run endpoint always counts; it cannot delete.
6. Observe the first actual native scheduled invocation. Require a successful response and the matching fixed `feedback-retention` application log with `ok:true`, `mode:execute`, aggregate `removed` count and invocation ID. Record date/time, deployment revision and trigger/run evidence. Verify continued nightly success and assign failure monitoring; presence of a trigger alone does not establish enforcement. Native trigger delivery can retry, so retain the existing idempotent cutoff query. [Neon schedules and observability](https://neon.com/docs/compute/functions/triggers/schedule).

## Use one active scheduler

For a handoff to Neon, keep its trigger disabled while validating deployment and the count-only request. Disable **PipWise data retention** in GitHub Actions, confirm it is disabled and all active runs have finished, then enable the verified native schedule. Observe its first scheduled success and retain both the handoff time and monitoring owner. The checked-in GitHub workflow remains available as a fallback; source presence is separate from its enabled state.

For a handoff back to GitHub, set `PIPWISE_RETENTION_SCHEDULE_ENABLED=0` and redeploy the native policy, then confirm the trigger is disabled and pending/in-flight deliveries have drained before enabling GitHub. The immediate operational stop is `neon triggers disable '<trigger-id>' --project-id '<relay-project-id>' --branch '<relay-branch-id>'`; reconcile the private flag to `0` before any later deployment. A disabled trigger can still have an already queued delivery, so inspect activity before changing database permissions or credentials. Complete the local dry-run and monitored GitHub activation above. Do not leave both schedules enabled; keep the current owner and scheduler choice in the release record.

## Scheduling limitations to monitor

GitHub schedules run from the default branch and can be delayed or occasionally dropped under load. Public-repository schedules are disabled after 60 days without repository activity. Check the Actions page regularly, re-enable disabled workflows and perform a manual catch-up run when needed. Do not claim an operational nightly retention guarantee until activation and monitoring are in place. The server's opportunistic cleanup on valid feedback submissions provides another cleanup opportunity; it does not replace this schedule. [GitHub schedule behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

Deleting expired rows at a nightly boundary can trail their exact cutoff by one run interval, and a missed run can extend that delay. The public policy must describe the actual operational retention/deletion window rather than promising a stronger deadline than the operator can meet.

## Why this does not use Expo scheduled workflows

Expo's documented cron trigger requires a paid plan and reads scheduled workflows from the connected repository's default branch. A one-time `eas workflow:run` uploads/runs local source; it is not evidence that recurring scheduling is active. The prepared GitHub Actions job avoids adding a paid scheduler. [Expo schedule requirements](https://docs.expo.dev/eas/workflows/syntax/#onschedulecron).

Neon also supports `pg_cron`, but it runs only while compute is active; enabling it can require compute settings/restart. It was not configured as a substitute for an external schedule on a scale-to-zero database. [Neon pg_cron behavior](https://neon.com/docs/extensions/pg_cron).
