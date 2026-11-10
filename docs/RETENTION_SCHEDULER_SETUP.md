# PipWise retention scheduler

**Configured and enabled on 10 November 2026.** After the [verified production role rollout](DATA_LAYER_VERIFICATION_2026_11_10.md), the owner explicitly approved nightly deletion of feedback older than 12 calendar months. The native Neon trigger is the selected recurring scheduler. GitHub Actions is a manual fallback; its cron was removed from `main` in [commit `aac7677`](https://github.com/Natananse/pipwise/commit/aac7677b8d417202ec14bcf7d095bf21eab7df01).

| Setting | Verified value |
| --- | --- |
| Function project / branch | `steep-hill-28178125` / `br-snowy-cake-b96dtgbu`, Frankfurt |
| Function / active deployment | `retention` / **2**, completed `2026-11-10T09:10:38.327231Z` |
| Trigger | `trigger-e1fd86d2-1bc3-4ab8-988b-280ab6600f04`, name `pipwise-feedback-retention` |
| Route / enabled / cron | `/scheduled` / **true** / `17 1 * * *` |
| Next run | **11 November 2026, 04:17 Africa/Addis_Ababa** / `01:17Z` |
| Database identity | Production `retention_job`; both injected DB defaults explicitly replaced with that scoped login |

The deployed count-only request returned **eligible: 0**. Missing/wrong check secrets and public scheduled calls, including a forged native trigger header, returned **401**. A genuine separate **count-only** Neon tick succeeded at **12:09 Addis on 10 November**; it had no usable database credentials or deletion path. Its temporary function and trigger were deleted and verified absent at **12:09:36**. That proof establishes scheduled delivery and the protected count request, not a scheduled purge. **The first actual nightly deletion run has not occurred yet; no production feedback was deleted during this setup.** Monitor the next run as described below.

The ignored mode-0600 `.env.retention` now contains the scoped connection, private count-check secret, native function origin and `PIPWISE_RETENTION_SCHEDULE_ENABLED=1`. Keep values private. The app's London project remains the maintained database/Auth project; it is not the Functions deployment target.

## Historical Actions failures — 7–10 November 2026

Before the handoff, the final repository run query returned four completed failures and **no active runs**. After the change, a remote reread confirmed the manual-only workflow blob `4b3fdbe1a4c377289779e93d47c0bf0cef24070c`, matching local source:

| Run | Event / conclusion | Created, Africa/Addis_Ababa |
| --- | --- | --- |
| [42782323763](https://github.com/Natananse/pipwise/actions/runs/42782323763) | schedule / failure | 10 November 2026, 11:23:58 |
| [42582423253](https://github.com/Natananse/pipwise/actions/runs/42582423253) | schedule / failure | 9 November 2026, 10:56:00 |
| [42458200197](https://github.com/Natananse/pipwise/actions/runs/42458200197) | schedule / failure | 8 November 2026, 10:17:46 |
| [42349846441](https://github.com/Natananse/pipwise/actions/runs/42349846441) | schedule / failure | 7 November 2026, 10:06:15 |

No successful GitHub cleanup appears in that history. These are creation times, not proof the old cron ran on time. The separately inspected **9 November** [job 129044100658](https://github.com/Natananse/pipwise/actions/runs/42582423253/job/129044100658) completed checkout/runtime/install and failed at the cleanup step; its manual preview step was skipped.

A targeted, credential-free log check isolated this application-generated message at **10:56:59 Africa/Addis_Ababa**:

```text
Feedback retention cleanup failed. Set RETENTION_JOB_DATABASE_URL with the retention_job database credential.
```

This was the missing/blank configuration guard in `scripts/database-config.mjs`, before client creation or queries. No GitHub secret was copied or rerun requested during the handoff. The native scheduler now uses the separately verified scoped credential; do not substitute owner or migrator credentials in either path.

The existing repository is [Natananse/pipwise](https://github.com/Natananse/pipwise), public, with default branch `main` (verified through the connected GitHub repository metadata). Standard GitHub-hosted Actions runners are free for public repositories. [GitHub billing guidance](https://docs.github.com/en/actions/concepts/billing-and-usage).

The checked-in workflow now has **no cron**. Manual runs default to a count-only preview; **execute=true** authorizes that manual purge. The script uses only `RETENTION_JOB_DATABASE_URL` as `retention_job` and returns aggregate counts. It cannot read feedback message/user columns or other tables. See [FEEDBACK_RETENTION.md](FEEDBACK_RETENTION.md).

## Manual GitHub fallback

The role rollout is already applied; do not rerun bootstrap. To use the fallback, privately configure only the repository Actions secret `RETENTION_JOB_DATABASE_URL` with the maintained `retention_job` connection, then run **PipWise data retention** on `main` with **execute=false**. Confirm the count before an intentionally authorized **execute=true** run. Never use an owner or migrator URL. Adding this secret alone does not restore recurring execution because the workflow has no cron. A future recurring handoff requires a reviewed cron change and the native-scheduler stop/drain procedure below. [GitHub secret instructions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets).

## Native Neon maintenance: deploy disabled first

The current setup is complete. These steps are for a new deployment, credential rotation or recovery; preserve the existing private files and verified IDs rather than recreating the project or roles.

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

The completed handoff removed GitHub's cron and verified all old runs complete before enabling the native nightly trigger. For a future handoff to Neon, keep its trigger disabled until counts/authentication are verified and the previous scheduler is stopped and drained. Source presence is separate from enabled state.

For a handoff back to recurring GitHub execution, set `PIPWISE_RETENTION_SCHEDULE_ENABLED=0`, redeploy the native policy, and confirm pending/in-flight deliveries have drained before restoring a reviewed GitHub cron. The immediate operational stop is `neon triggers disable 'trigger-e1fd86d2-1bc3-4ab8-988b-280ab6600f04' --project-id 'steep-hill-28178125' --branch 'br-snowy-cake-b96dtgbu'`; reconcile the private flag to `0` before later deployment. A queued delivery may still fire after disabling. Keep only one recurring scheduler active.

## Scheduling limitations to monitor

Inspect `neon logs query --project-id steep-hill-28178125 --branch br-snowy-cake-b96dtgbu --source function --service-name neon-function/retention --since 24h --body-contains feedback-retention` after the first nightly run. Require `ok:true`, `mode:execute`, aggregate `removed` and an invocation ID; retain the result and investigate failures. The count-only scheduled proof must not be recorded as a purge. The server's opportunistic cleanup on valid feedback submissions provides another opportunity, not a replacement for monitoring.

If GitHub cron is restored later, its schedules can be delayed/dropped and public-repository schedules can be disabled after inactivity. [GitHub schedule behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

Deleting expired rows at a nightly boundary can trail their exact cutoff by one run interval, and a missed run can extend that delay. The public policy must describe the actual operational retention/deletion window rather than promising a stronger deadline than the operator can meet.

## Why this does not use Expo scheduled workflows

Expo's documented cron trigger requires a paid plan and reads scheduled workflows from the connected repository's default branch. A one-time `eas workflow:run` uploads/runs local source; it is not evidence that recurring scheduling is active. The prepared GitHub Actions job avoids adding a paid scheduler. [Expo schedule requirements](https://docs.expo.dev/eas/workflows/syntax/#onschedulecron).

Neon also supports `pg_cron`, but it runs only while compute is active; enabling it can require compute settings/restart. It was not configured as a substitute for an external schedule on a scale-to-zero database. [Neon pg_cron behavior](https://neon.com/docs/extensions/pg_cron).
