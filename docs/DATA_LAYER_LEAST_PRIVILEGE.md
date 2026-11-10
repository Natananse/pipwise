# Database role separation: manual rollout

This is a **prepared change with no verified production cutover**. A 10 November read-only `pg_roles` query on the matching configured app endpoint returned none of the three scoped roles. No administration SQL, database password change, or hosting/GitHub secret update was performed in that session. Earlier working-copy probe notes lack reproducible evidence, as described below. Local unit tests and static checks do not establish that the SQL works against the live database. Review and test it on an isolated branch before production use.

The application keeps its existing four tables in `public`: `account_details`, `beta_feedback`, `chart_review_usage`, and `auth_email_deliveries`. It does not move, rename, recreate, truncate, or backfill these tables. Managed `neon_auth` table ownership remains with the managed service. The new `pipwise_app` namespace contains only reviewed helper functions.

The permission changes necessarily affect existing metadata: grants, row-security policies, and database temporary-object privileges. Existing table and schema owners remain unchanged, including `neondb_owner` ownership of the four app tables and migration ledger. These are not user-row edits, but they are not literally “only new database objects.” The approved preparation permits permission changes while preserving all existing schemas, owners, table names, and user data. Applying the SQL remains an owner-run action.

## Credentials and responsibilities

| Role | Intended use | Private environment variable | Scope |
| --- | --- | --- | --- |
| `migrator` | Owner-run local migrations through a direct connection | `MIGRATOR_DATABASE_URL` | Own new helper schema/functions and future objects there; read/append the existing ledger; limited managed Auth and quota privileges needed by helpers |
| `app_runtime` | Hosted application API and email delivery | `APP_RUNTIME_DATABASE_URL` | Explicit app-table column operations and three helper calls; no direct managed Auth table access, DDL, role membership, or migration-ledger access |
| `retention_job` | Scheduled feedback cleanup | `RETENTION_JOB_DATABASE_URL` | Read the feedback cutoff column and delete expired feedback only |

Keep the migrator credential local to the operator. It must not be present in the application hosting environment, mobile build environment, email relay, or scheduled workflow. Runtime and retention connections may use the pooled host. The migrator connection must use the direct host without `-pooler`.

These are server credentials. Never prefix their names with `EXPO_PUBLIC_`, put them in an app config, commit them, paste them into a ticket, or include values in a SQL file. Application code must not fall back to the previous owner `DATABASE_URL` when a scoped variable is missing or invalid.

| Destination | Intended configuration |
| --- | --- |
| EAS mobile build profiles `preview`, `testflight`, and `production` | Select the public-only **production** environment; public Auth/API/return URLs, provider flags and store publishable keys only; no database, SMTP, relay or model secrets |
| Hosted backend and email relay | The separately maintained **preview** server environment and relay private settings receive `APP_RUNTIME_DATABASE_URL`; never the migrator or owner credential |
| Selected retention scheduler | GitHub receives only the private `RETENTION_JOB_DATABASE_URL` secret; the independent native Neon policy also receives its private count-only check secret and explicitly replaces injected DB defaults with the same retention login |
| Operator's local migration environment | Only local direct `MIGRATOR_DATABASE_URL`; never forwarded to hosting, builds or the workflow |

The EAS environment routing is a **local configuration change**, not evidence that cloud environments have been cleaned or updated. The owner must inspect those remote settings privately before building. Legacy `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, and `PIPWISE_AUTH_DATABASE_URL` are not accepted fallbacks by the new paths; remove broad copies from deployment/job settings after the scoped rollout is verified.

Use these owner dashboard locations; enter all values privately:

- **Expo:** open account **natananse → PipWise project → Project settings → Environment variables → Add Variables**. Set `APP_RUNTIME_DATABASE_URL` only for the server's **preview** environment, with **Sensitive** visibility. Inspect both project- and account-scoped variables so a broad inherited variable cannot enter builds. Select **production** separately and keep it public-only for all mobile profiles. [Expo environment-variable dashboard](https://docs.expo.dev/eas/environment-variables/manage/)
- **Neon relay:** select the separate relay project and intended branch, then **Functions → PipWise auth email relay** (`authmail`). Its private deployment configuration is the `functions.authmail.env` declaration in [`neon.email.ts`](../neon.email.ts), where `APP_RUNTIME_DATABASE_URL` is read from the operator's private deployment environment. The prepared policy also replaces both injected DB defaults with that scoped login. A change to a local variable alone does not update the deployed function: its environment snapshot must be redeployed by the owner. Omitted old user variables can persist across deployments; inspect/remove old broad values deliberately. Prefer a functions-only relay branch/project without Postgres to avoid additional injected credentials. Ignoring an injected owner URL in code is not equivalent to removing or replacing it in the process. The independent [`neon.retention.ts`](../neon.retention.ts) targets only the retention function with its own role; follow [disabled-first setup and scheduler handoff](RETENTION_SCHEDULER_SETUP.md#native-neon-alternative-deploy-disabled-first). [Neon function environments](https://neon.com/docs/compute/functions/environment-variables)
- **GitHub:** open **Natananse/pipwise → Settings → Secrets and variables → Actions → New repository secret** and create `RETENTION_JOB_DATABASE_URL` for `retention_job`. Do not use a GitHub Variable or workflow literal for its value.
- **Migrator:** store `MIGRATOR_DATABASE_URL` only in the operator's ignored private local environment. It has no Expo, Neon Function or GitHub runtime destination.

These instructions describe owner actions to perform later. No dashboard or relay environment was changed during implementation.

SQL-created roles are deliberate: roles created with the Neon Console/API or the default role-creation CLI command receive administrator membership. Verify the resulting roles and membership graph rather than relying on `NOINHERIT`, which does not itself prevent `SET ROLE`. The existing administrator receives membership in `migrator` to create helpers as their intended owner; none of the three scoped roles receives membership in another role. See [Neon role creation](https://neon.com/docs/manage/roles) and [PostgreSQL role membership](https://www.postgresql.org/docs/current/role-membership.html).

The prepared SQL accounts for PostgreSQL 18's automatic creator membership by preserving the bootstrap-granted administrator membership and adding a separate `SET TRUE`, noninheriting membership explicitly granted by `neondb_owner`. It does not self-grant `ADMIN`; rollback revokes only the introduced grantor-specific membership. A prior working-copy note reported a `0LP01` self-grant failure and an isolated probe confirming both membership rows, but no reproducible probe record is present in this repository. Treat that observation as **unverified** and require the catalog checks and actual role logins on the selected disposable branch before rollout. See [PostgreSQL role attributes](https://www.postgresql.org/docs/18/role-attributes.html).

The migrator does **not** own existing app tables or the ledger and has no database-wide or public-schema `CREATE` grant. Future `ALTER` operations on those existing tables must therefore be reviewed and run manually by their existing owner in the SQL Editor. Future new objects can be created by `migrator` inside its owned `pipwise_app` namespace. A successful migration-runner check does not grant ownership or make legacy-table DDL possible.

## Set passwords privately

The bootstrap creates login roles without passwords; they cannot use password authentication until the owner sets passwords privately. Do not add a literal password or connection URL to the supplied SQL.

Neon's documented SQL password limitation requires plaintext password input over the secured administrator connection rather than client-generated SCRAM/password hashes. Consequently `psql \password`, which sends a pre-hashed verifier, is unsuitable here. Validate initialization through commit on the disposable branch; a rollback-only test cannot establish committed password behavior. See [Neon's documented password limitation](https://neon.com/docs/manage/roles#manage-roles-with-sql).

A prior working-copy note reported `422: cannot update password for role without password` when resetting a passwordless SQL-created role. That live-probe claim is **unverified** here; do not treat it as completed role or password validation. Plan to initialize each new role using `ALTER ROLE` through a private programmatic administrator connection, with fresh high-entropy values held in memory and persisted only in protected local secret files. Do not put values in source SQL, shell arguments, terminal output, saved SQL Editor queries, reports or this chat. Disable raw query/error output in the operator script. Recheck actual role logins, attributes and memberships afterward; the scoped roles must never gain administrator membership. Later password rotation must use the existing role rather than recreating it through the default administrator-granting creation flow.

For a strictly SQL-Editor-only workflow, enter the initialization in a private, one-time session and account for retained query history. Do not save/share the scratch query or copy that history into a report. Do not recreate the role through the default Console/API creation flow to work around password initialization.

Store each connection privately in its intended environment using the correct username, URL-encoded password, endpoint, database name, and TLS settings. Do not use “create role” in the Console as a substitute for this bootstrap.

## Review before applying

Confirm the selected project, branch, database (`neondb`), PostgreSQL major version, existing owners, table columns, foreign keys, policies, function ACLs, database ACLs, and role memberships. The SQL is based on the reviewed state and should fail rather than silently adopt an existing role or helper namespace. If that baseline has changed, stop and update the plan and its rollback before running it.

**Before any mutating SQL, create and verify a recoverable backup or recovery branch from the intended production state and confirm the available restore window.** Record the branch/restore point privately and confirm the recovery procedure; the supplied metadata rollback is not a data backup. Select and verify a separate disposable branch for functional tests. No recovery branch or backup was created during this implementation.

The reviewed original database ACL is `{=Tc/neondb_owner,neondb_owner=CTc/neondb_owner,neon_superuser=CTc/neondb_owner}`. `neon_superuser` already has an explicit TEMP grant, which is preserved. Bootstrap adds explicit TEMP for managed `neon_auth` before removing inherited `PUBLIC TEMP`; rollback restores PUBLIC TEMP and removes only that newly added Auth grant. It does not revoke the original administrator TEMP privileges.

The four application tables already enable RLS. The new server roles need both object grants and role-specific policies; a grant alone does not bypass RLS. Retention policies restrict visibility and deletion to the same 12-month cutoff used by the cleanup script. HTTP authorization still scopes runtime operations to the signed-in user: a shared server login is not an individual user's database identity. [PostgreSQL policies](https://www.postgresql.org/docs/current/sql-createpolicy.html)

No blanket future-table DML grant belongs on `public`, because that would grant access to unrelated future objects. Existing public tables receive explicit column grants. A future DML default applies only to tables created **as migrator inside the app-only `pipwise_app` namespace**; future sequences there receive runtime `USAGE`, and future RLS-enabled tables still need reviewed policies. No future defaults apply to public, managed Auth, the ledger, or retention. Future app helper functions default to no `PUBLIC EXECUTE`; revoking that default only `IN SCHEMA` does not override the global default. [Default privileges](https://www.postgresql.org/docs/current/sql-alterdefaultprivileges.html)

## Manual SQL files

| Order | File | Actor and transaction |
| --- | --- | --- |
| 1 | [`01-admin-bootstrap.sql`](../neon/security/01-admin-bootstrap.sql) | Existing `neondb_owner`; explicit `BEGIN`/`COMMIT`; verifies baseline, creates roles/new helper namespace, grants scoped access |
| 2 | [`02-app-permissions-and-helpers.sql`](../neon/security/02-app-permissions-and-helpers.sql) | Existing `neondb_owner`; explicit `BEGIN`/`COMMIT`; app policies/grants, then `SET LOCAL ROLE migrator` for new functions/defaults |
| 3 | [`03-verify-privileges.sql`](../neon/security/03-verify-privileges.sql) | Existing `neondb_owner`; read-only catalog/ACL checks; every assertion must pass and inventories require review |
| 4 | [`04-branch-only-checks.sql`](../neon/security/04-branch-only-checks.sql) | Isolated branch only; edit confirmation and disposable-user placeholders; temporarily inserts/deletes synthetic feedback and app metadata, then discards all test changes with `ROLLBACK` |
| Recovery | [`90-rollback.sql`](../neon/security/90-rollback.sql) | Existing administrator, coordinated with code/environment rollback; restores baseline permissions and disables new roles |

Paste and run each complete file separately in the Neon SQL Editor while signed in as its stated actor. Do not remove transaction boundaries or run only selected lines after an error. If an explicit transaction errors, issue `ROLLBACK` before attempting a reviewed retry. These files are deliberately outside `neon/migrations/`; `pnpm db:migrate` does not automatically execute them.

## Rollout order

1. Review the SQL files in `neon/security/` and their rollback with the code changes. Create/verify the production recovery branch or backup and confirm the restore window **before any mutating SQL**. The files are manual administration inputs, not an automated deployment hook. Keep migrations `001`–`004` unchanged. There is no automatic security migration `005`.
2. Select a separate isolated branch with the expected schema. Privately confirm its endpoint before any mutating test. Apply bootstrap and permissions/helper SQL there in the documented order and transaction boundaries. Do not run the synthetic functional test on production.
3. Run `03-verify-privileges.sql` as `neondb_owner`; its private-schema inventories are administrator checks. Set branch role passwords privately, connect independently as each new role, and verify `SELECT current_user` plus a simple permitted operation without returning private contents. Examples: runtime can call `pipwise_app.session_is_active(NULL::uuid,NULL::text)`; retention can `SELECT created_at FROM public.beta_feedback LIMIT 0`; migrator can `SELECT name,checksum FROM pipwise_migrations.schema_migrations LIMIT 0`. An administrator merely using `SET ROLE` is useful for policy checks but is not a substitute for actual login/default-setting checks.
4. Run the branch-only checks and the app integration flows against that branch. Validate successful account-details upsert, feedback insertion and expired cleanup, email-delivery leasing, active-session checks, and quota reservation. Validate recent-session deletion, wrong/revoked/expired/impersonated session rejection, unrelated-account isolation, foreign-key cascades, rollback, and both concurrent quota/deletion lock orders. Record failures and stop the rollout until resolved.
5. Test the rollback on the branch. It must restore the baseline metadata without dropping application tables or editing user rows. Preserve the previous application release and secret configuration privately for a coordinated rollback.
6. During a planned production cutover, the owner applies the reviewed administration SQL manually and verifies privileges. Update the hosting API and separate email relay to use only `APP_RUNTIME_DATABASE_URL`; update the retention secret to the `retention_job` connection. Keep the migrator URL local. Do not copy a complete environment file into hosting or a workflow.
7. Deploy the matching backend and browser client, and build/install a new native release. The strengthened API session proof includes `X-Pipwise-Session`; an older APK that sends only a JWT cannot satisfy it. Test email and Google sign-in, account details, feedback, deletion, and release startup with the development server turned off.
8. Verify scheduler dry-run and first scheduled success, and retain their run URLs/statuses. Remove the previous broad owner credential from runtime/relay/job environments only after the scoped paths are confirmed, preserving the operator's secure administrative recovery access.

No cloud build, deployment, workflow activation, production purge, account deletion, password change, or SQL execution is implied by completing the source changes.

The supplied branch SQL covers limited app-table grants, expired/fresh feedback RLS, invalid-session helper execution and permission denials. It requires an existing disposable verified branch user created through signup; it does not invent or insert managed Auth rows. Its confirmation placeholder is an intentional human guard, **not automatic detection of a Neon branch**. It does not validate successful session proofs, full deletion/cascades, email contention or concurrent quota/deletion locking. Those require the separate owner-run integration work above.

## Rollback

Restore the compatible backend/browser/native release and prior private environment configuration in a coordinated maintenance window before removing helpers that the new backend calls. Reverting database permissions first can break active requests. An older mobile release and a backend requiring the new session header must not be left paired.

Pause application writes, email-relay processing and retention jobs before the manual rollback and wait for in-flight requests/transactions to finish. Keep the scheduler paused until the compatible code and intended scoped or prior recovery credentials have been verified. Restore service deliberately after permission checks; do not let scheduled deletion race with a partially reverted deployment.

Use the reviewed rollback SQL as an administrator after confirming that the baseline still applies. It removes only introduced policies/grants/helpers, restores original database privileges, and disables the three new roles with `NOLOGIN`. Existing ownership was never changed. New roles are not force-dropped, and the helper namespace is retained if later objects depend on it. Function dependencies can cause a safe rollback failure that requires review. It uses restrictive drops; do not add `CASCADE`, `DROP OWNED`, table drops, or row deletes to force it through. Changes made after rollout require a fresh dependency/ACL review.

Revoking a table privilege also revokes matching column privileges, but does not remove grants received through another role or `PUBLIC`. Verify effective privileges after rollback rather than trusting command success alone. [PostgreSQL revocation](https://www.postgresql.org/docs/current/sql-revoke.html)

## Verification status

**SQL integration is not verified.** The supplied SQL, role-login behavior, RLS behavior, helper execution, managed Auth grants, concurrency, metadata rollback, private credential distribution, hosted deployment, and new installed native release require recorded validation. Passing lint, TypeScript and local unit tests covers source behavior only.
