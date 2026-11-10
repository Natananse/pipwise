# Database role verification — 10 November 2026

**The production database role cutover completed at 12:00:08 Africa/Addis_Ababa (09:00:08 UTC).** Project `old-credit-68830713`, database `neondb`, PostgreSQL 18 and production branch `br-damp-bonus-zabur4d5` were verified before administration SQL. The user explicitly authorized the production changes after confirming no manual rollout had been completed. The [operator guide](DATA_LAYER_LEAST_PRIVILEGE.md) remains the reusable rollout and rollback procedure.

This record covers database preparation, disposable-branch tests, rollback and production role configuration. It does not establish hosted API/email deployment, successful scheduled cleanup, email delivery, Google sign-in, installed-device acceptance or store release.

## Branches and recovery

| Purpose | Branch | Evidence |
| --- | --- | --- |
| Production | `br-damp-bonus-zabur4d5` — `production` | Verified default branch in the existing project; direct endpoint ID `ep-round-tooth-za67qro2` checked against platform branch metadata before SQL. |
| Durable recovery | `br-small-cherry-zapghtfk` — `release-recovery-20261110-084939` | Created before mutating SQL; verified `ready`, parent is production, no expiration and no compute. Recovery point: LSN `0/21219D8`, 10 November 11:49:24 Addis (08:49:24 UTC). Retain this branch for recovery. |
| Disposable validation | `br-weathered-frog-zat9b33y` — `security-validation-20261110-084939` | Separate production child; endpoint ID `ep-purple-queen-zaz4opwc`. Expires **17 November 2026, 11:49:39 Addis (08:49:39 UTC)**. Final state after testing: metadata rollback applied and all three scoped roles `NOLOGIN`. |

The project reported a history-retention window of `21600` seconds, or six hours, during inspection. This time-limited history is separate from the recovery branch, which has no configured TTL. Metadata rollback is not a data backup. The recovery branch was verified through platform state and its production parent/restore point; no production restore was performed. Existing older branches were left intact. Branch creation used explicit project/parent IDs without changing `.neon` or pulling environment files.

## Exact SQL revisions

No security SQL file was edited during verification. These SHA-256 hashes bind this record to the tested inputs; their original preparation comments do not describe current deployment status.

| Input | SHA-256 | Execution |
| --- | --- | --- |
| [`01-admin-bootstrap.sql`](../neon/security/01-admin-bootstrap.sql) | `d77c5dd45fdde5a8e8a044c74db5cc33142968ab14269e395a61cd489e4d6e71` | Committed on validation and production. |
| [`02-app-permissions-and-helpers.sql`](../neon/security/02-app-permissions-and-helpers.sql) | `83817b44b20952cb1555bad129731aa84df9ef5a6b8f94f04f0b38524997d8b9` | Committed on validation and production. |
| [`03-verify-privileges.sql`](../neon/security/03-verify-privileges.sql) | `7234933c358b466fb834d42ff2eac86279961ac65045670d52ea5080dabc3b1e` | Read-only checks on both branches; all **20** assertions passed. |
| [`04-branch-only-checks.sql`](../neon/security/04-branch-only-checks.sql) | `fb34f161ed944594438aabf848c4eabdf3fa20271dffc1087028ca53fd1e0dc7` | Validation only; hash identifies the source template before private in-memory placeholder substitution. Ended in `ROLLBACK`. |
| [`90-rollback.sql`](../neon/security/90-rollback.sql) | `3caffc6e02e81391f70e7053de1ce8afa308c5b5876a34c9af64bc7465fc7e7a` | Committed on validation only, after functional and concurrency checks. |

[`04-branch-only-checks.sql`](../neon/security/04-branch-only-checks.sql) ran on validation only. Its confirmation and user placeholders were supplied privately after branch/endpoint verification, and its synthetic changes ended in `ROLLBACK`. Production never received this file or synthetic functional fixtures.

## Validation results

Tests used the existing driver and actual SQL from the repository. Independent database clients executed queries using separately initialized `app_runtime`, `retention_job` and `migrator` passwords. Direct login queries checked role identity and `search_path = pg_catalog, pg_temp`; administrator `SET ROLE` probes were additional checks, not substitutes for these logins.

| Area | Observed result |
| --- | --- |
| Catalog and ACL assertions | All 20 passed: constrained login attributes; no scoped-role memberships; no database/public-schema DDL or temporary-table privileges; exact runtime/retention column scope; restricted Auth/ledger access; helper ownership, definer/search-path settings and execution ACLs; preserved table owners/RLS and ledger scope. The administrator's separate bootstrap `ADMIN` and explicit noninheriting `SET` memberships were verified. |
| Independent permission checks | Runtime called the null-session helper and was denied direct Auth/message reads, temporary tables and `SET ROLE migrator`. Retention could read the cutoff column and was denied message/account-details reads, helper execution, temporary tables and role escalation. Migrator could read ledger metadata and create a helper-schema probe inside a rolled-back transaction, while public-schema and temporary-table creation were denied. |
| Feedback retention and RLS | SQL04 saw and deleted an expired synthetic row, hid/preserved a fresh row, and rejected unrelated data access. Its entire transaction rolled back. |
| Actual runtime SQL | Account-details insert/upsert and feedback insertion succeeded through an independent runtime client. The actual quota implementation allowed a reservation, enforced account and global caps, and rolled back its changes. |
| Email delivery ledger | The actual lease implementation exercised claim, busy, failed-lease release/reclaim, stale-owner rejection, completion and already-sent idempotency. No message was sent. |
| Session helpers | A cloned verified user/session supplied the private fixture. Active proof and account locking succeeded; wrong-token, unrelated-account, revoked, expired, impersonated, unverified and banned proofs were rejected. Stale proof could not authorize deletion; a fresh matching proof could. Fixture session timestamps/status were adjusted only on validation and rolled back or restored. No managed Auth row was invented or inserted. |
| Deletion and isolation | Fresh-session deletion removed the branch fixture's user, sessions, provider account, account details, feedback and quota rows while preserving the unrelated account. The deletion transaction rolled back. |
| Email concurrency | A second independent claim waited for the first transaction, confirmed through `pg_blocking_pids`. After the first owner completed and committed, the second observed `sent` instead of claiming another send. The synthetic ledger row was removed afterward. |
| Quota before deletion | Deletion waited behind quota initialization's identity lock. After quota committed, deletion succeeded and saw/removed the newly committed account quota. Deletion rolled back and the test quota was removed. |
| Deletion before quota | Quota initialization waited behind deletion's identity lock. After deletion rolled back, quota resumed successfully and its transaction also rolled back. This tests the reverse blocking order and recovery after rollback; it is not evidence for a committed deletion winning that race. |

All fixture changes were discarded or restored. Before and after validation, server-side row counts/fingerprints matched for nine tables: `public.account_details`, `public.beta_feedback`, `public.chart_review_usage`, `public.auth_email_deliveries`, `neon_auth.user`, `neon_auth.session`, `neon_auth.account`, `neon_auth.verification` and `pipwise_migrations.schema_migrations`. Existing app-table/ledger ownership and RLS flags also matched. No private row values, user/session identifiers or raw Auth fingerprints are published here.

The private execution log retains two corrected runner issues: an initial assertion-count expectation greater than the file's actual 20 checks, and helper fixture probes that initially lacked the rollback-only administrator `SET ROLE` grant used by SQL04. Neither required a source SQL change. All final checks passed before production approval.

## Rollback evidence

Validation rollback completed at **11:56:54 Addis (08:56:54 UTC)**. It removed introduced policies/helpers, set all three scoped roles to `NOLOGIN`, restored the original database ACL and preserved the nine table fingerprints and existing owners. The restored ACL was:

```text
{=Tc/neondb_owner,neondb_owner=CTc/neondb_owner,neon_superuser=CTc/neondb_owner}
```

Fresh validation clients subsequently attempted a real identity query with each disabled role. All three queries failed with SQLSTATE **`28000`**. The observed Neon WebSocket client's `connect()` callback completed before that rejection surfaced, so connection setup alone was not treated as successful authentication.

A real rollback must pause callers and drain application pools and already-authenticated sessions. `NOLOGIN` controls new authentication; it does not terminate an established session. This test does not claim existing sessions were closed, and it did not change working production roles during the rollback probe. See [PostgreSQL role attributes](https://www.postgresql.org/docs/18/role-attributes.html) and [session controls](https://www.postgresql.org/docs/18/functions-admin.html#FUNCTIONS-ADMIN-SIGNAL).

## Production cutover and credential separation

The guarded production runner required the verified durable recovery branch, successful disposable tests/rollback, exact SQL hashes, the explicit production branch and matching endpoint metadata before applying SQL01/02. Both production transactions committed at **11:59:50 Addis (08:59:50 UTC)**. SQL03 then passed all 20 assertions. Distinct strong passwords were initialized privately with `ALTER ROLE` over the secured administrator connection.

Independent production queries passed as `app_runtime` and `retention_job` through the pooled endpoint and as `migrator` through the direct endpoint. Permitted operations and representative forbidden reads/role escalation were checked without production fixtures, feedback deletion, account deletion or email sending. Final data/ownership checks and private-file creation completed at **12:00:08 Addis (09:00:08 UTC)**.

All nine table row fingerprints and existing app-table/ledger owners matched the production snapshot taken immediately before SQL. Existing `.env`, `.env.local` and `.neon` file hashes remained unchanged. The cutover created only these Git-ignored private operator files, each mode **`0600`**:

| File | Keys at initial creation |
| --- | --- |
| `.env.server-runtime` | `APP_RUNTIME_DATABASE_URL` only; `app_runtime` pooled connection. |
| `.env.retention` | `RETENTION_JOB_DATABASE_URL`; fresh 64-character `PIPWISE_RETENTION_CHECK_SECRET`; `PIPWISE_RETENTION_SCHEDULE_ENABLED=0`. |
| `.env.migrator` | `MIGRATOR_DATABASE_URL` only; direct `migrator` connection, operator-local. |

No URL, password, token or check-secret value belongs in repository documentation. Initial local credential creation does not establish that hosting variables were updated or that retention was activated; consult the [release status](FINAL_RELEASE_STATUS.md) and [scheduler record](RETENTION_SCHEDULER_SETUP.md) for those separate actions.

## Operator evidence and reproduction

Protected local records are `/tmp/pipwise-security-validation-report.json` and `/tmp/pipwise-security-production-report.json`. The runner is `/tmp/pipwise-security-validation.cjs`; its reviewed production version had SHA-256 `70268fc56e725a26d5c9c97a1ee2df9f1cd72df6d70752d3fd4076477c8eb4dc`. These private files are not repository artifacts, are not guaranteed to survive cleanup, and must not be copied wholesale into an issue or commit. Preserve needed operator records securely.

For future reproduction, use the [operator guide](DATA_LAYER_LEAST_PRIVILEGE.md) and a fresh recovery/validation branch pair with current endpoint/baseline checks. The temporary runner is bound to this run's branch IDs and existing state; do not rerun its production mode. Revalidate against any changed schema, SQL revision, role state or platform behavior before another rollout. No production restore, committed production deletion, hosted HTTP/JWT flow or physical-device test is claimed by this record.
