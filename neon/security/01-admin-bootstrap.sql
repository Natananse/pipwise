-- MANUAL, UNAPPLIED. Review docs/DATA_LAYER_LEAST_PRIVILEGE.md first.
-- Run as neondb_owner in the Neon SQL Editor on an isolated branch first.
-- Preserves all existing schemas, table names, owners, columns and user rows.
-- No password/connection string belongs in this file. Set passwords privately.
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $baseline$
DECLARE app_table text;
BEGIN
  IF current_database() <> 'neondb' OR current_user <> 'neondb_owner'
      OR current_setting('server_version_num')::integer / 10000 <> 18 THEN
    RAISE EXCEPTION 'Expected neondb, neondb_owner, PostgreSQL 18; review baseline';
  END IF;
  IF NOT pg_has_role(current_user,'neon_auth','USAGE') THEN
    RAISE EXCEPTION 'Administrator must inherit managed Auth owner authority to grant scoped access';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles
      WHERE rolname IN ('migrator', 'app_runtime', 'retention_job'))
      OR to_regnamespace('pipwise_app') IS NOT NULL THEN
    RAISE EXCEPTION 'New role/helper names already exist; do not adopt them';
  END IF;
  FOREACH app_table IN ARRAY ARRAY['account_details','beta_feedback',
      'chart_review_usage','auth_email_deliveries'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class AS c
        JOIN pg_namespace AS n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = app_table
          AND c.relkind = 'r' AND c.relowner = 'neondb_owner'::regrole
          AND c.relrowsecurity AND NOT c.relforcerowsecurity)
        OR EXISTS (SELECT 1 FROM pg_policies
          WHERE schemaname = 'public' AND tablename = app_table) THEN
      RAISE EXCEPTION 'Application ownership/RLS/policy baseline differs: %', app_table;
    END IF;
  END LOOP;
  IF to_regclass('pipwise_migrations.schema_migrations') IS NULL
      OR NOT EXISTS (SELECT 1 FROM pg_namespace
        WHERE nspname = 'pipwise_migrations'
          AND nspowner = 'neondb_owner'::regrole) THEN
    RAISE EXCEPTION 'Expected existing owner-managed migration ledger';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_database AS d,
      LATERAL aclexplode(COALESCE(d.datacl, acldefault('d', d.datdba))) AS a
      WHERE d.datname = current_database() AND a.grantee = 0
        AND a.privilege_type = 'TEMPORARY') THEN
    RAISE EXCEPTION 'Expected PUBLIC TEMP baseline; review rollback before changing';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_database AS d,
      LATERAL aclexplode(COALESCE(d.datacl, acldefault('d', d.datdba))) AS a
      WHERE d.datname = current_database()
        AND a.grantee = 'neon_auth'::regrole
        AND a.privilege_type = 'TEMPORARY') THEN
    RAISE EXCEPTION 'Auth TEMP baseline changed; review rollback assumptions';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_database AS d,
      LATERAL aclexplode(COALESCE(d.datacl, acldefault('d', d.datdba))) AS a
      WHERE d.datname = current_database()
        AND a.grantee = 'neon_superuser'::regrole
        AND a.privilege_type = 'TEMPORARY') THEN
    RAISE EXCEPTION 'Expected existing neon_superuser TEMP grant';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_namespace AS n,
      LATERAL aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner))) AS a
      WHERE n.nspname = 'public' AND a.grantee = 0
        AND a.privilege_type = 'CREATE') THEN
    RAISE EXCEPTION 'Unexpected PUBLIC CREATE on public; review ACLs first';
  END IF;
END;
$baseline$;

CREATE ROLE migrator LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS;
CREATE ROLE app_runtime LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS;
CREATE ROLE retention_job LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOREPLICATION NOBYPASSRLS;

-- PostgreSQL already gives the creator a bootstrap-granted ADMIN membership.
-- Preserve it; a circular ADMIN self-grant fails with SQLSTATE 0LP01. Add only
-- an explicit SET membership under this administrator's own grantor identity.
-- Neither service role belongs to migrator, Auth, or another service role.
GRANT migrator TO neondb_owner WITH INHERIT FALSE, SET TRUE
  GRANTED BY neondb_owner;
GRANT CONNECT ON DATABASE neondb TO migrator, app_runtime, retention_job;

-- PUBLIC TEMP is inherited by every login; a direct runtime revoke cannot deny
-- it. Preserve managed administrator/Auth behavior before removing that grant.
-- Baseline already grants TEMP to neon_superuser; preserve that existing grant.
-- Only neon_auth needs a new explicit grant before PUBLIC TEMP is removed.
GRANT TEMPORARY ON DATABASE neondb TO neon_auth;
REVOKE TEMPORARY ON DATABASE neondb FROM PUBLIC;
-- No CREATE-on-database grant: new DDL is scoped to owned pipwise_app only.

CREATE SCHEMA pipwise_app AUTHORIZATION migrator;
SET LOCAL ROLE migrator;
REVOKE ALL ON SCHEMA pipwise_app FROM PUBLIC;
GRANT USAGE ON SCHEMA pipwise_app TO app_runtime;
RESET ROLE;

-- Public schema PUBLIC USAGE remains as in the baseline. No CREATE is granted.
GRANT USAGE ON SCHEMA public TO migrator, app_runtime, retention_job;
GRANT USAGE ON SCHEMA pipwise_migrations TO migrator;
GRANT SELECT, INSERT ON TABLE pipwise_migrations.schema_migrations TO migrator;
-- Existing ledger ownership and schema contents remain unchanged.

-- Only helper owner migrator receives these exact managed-Auth privileges.
GRANT USAGE ON SCHEMA neon_auth TO migrator;
GRANT SELECT (id, email, "emailVerified", banned), UPDATE (id), DELETE
  ON TABLE neon_auth."user" TO migrator;
GRANT SELECT ("userId", token, "expiresAt", "createdAt", "impersonatedBy")
  ON TABLE neon_auth.session TO migrator;
GRANT SELECT (id, identifier, value), DELETE
  ON TABLE neon_auth.verification TO migrator;
-- UPDATE(id) is required for row locks; helpers never update the identity.
-- No memberships, Auth ownership, Auth policy changes, or password-table reads.
GRANT SELECT (user_id), DELETE ON TABLE public.chart_review_usage TO migrator;

ALTER ROLE migrator IN DATABASE neondb SET search_path = pg_catalog, pg_temp;
ALTER ROLE app_runtime IN DATABASE neondb SET search_path = pg_catalog, pg_temp;
ALTER ROLE retention_job IN DATABASE neondb SET search_path = pg_catalog, pg_temp;
COMMIT;

-- Passwords are deliberately unset. Initialize them through a private secured
-- administrator connection; Neon requires plaintext input, not SCRAM verifiers.
-- Continue with 02-app-permissions-and-helpers.sql as neondb_owner.
