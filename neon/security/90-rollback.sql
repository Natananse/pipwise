-- MANUAL, UNAPPLIED. Administrator-only metadata rollback, baseline-specific.
-- Restore compatible backend/browser/native code and private secrets BEFORE
-- removing helpers. Stop if unrelated later changes/dependencies exist.
-- Never add CASCADE, DROP OWNED, table drops, or user-row deletes.
-- New roles are disabled, not dropped; future dependent objects/data survive.
BEGIN;
SET LOCAL lock_timeout = '10s';
DO $check_rollback$
BEGIN
  IF current_database() <> 'neondb' OR current_user <> 'neondb_owner' THEN
    RAISE EXCEPTION 'Review baseline and run as neondb_owner in neondb';
  END IF;
END;
$check_rollback$;
ALTER ROLE app_runtime NOLOGIN;
ALTER ROLE retention_job NOLOGIN;
ALTER ROLE migrator NOLOGIN;

DROP POLICY IF EXISTS pipwise_lp_details_select ON public.account_details;
DROP POLICY IF EXISTS pipwise_lp_details_insert ON public.account_details;
DROP POLICY IF EXISTS pipwise_lp_details_update ON public.account_details;
DROP POLICY IF EXISTS pipwise_lp_feedback_insert ON public.beta_feedback;
DROP POLICY IF EXISTS pipwise_lp_feedback_select_expired ON public.beta_feedback;
DROP POLICY IF EXISTS pipwise_lp_feedback_delete_expired ON public.beta_feedback;
DROP POLICY IF EXISTS pipwise_lp_quota_select ON public.chart_review_usage;
DROP POLICY IF EXISTS pipwise_lp_quota_insert ON public.chart_review_usage;
DROP POLICY IF EXISTS pipwise_lp_quota_update ON public.chart_review_usage;
DROP POLICY IF EXISTS pipwise_lp_delivery_select ON public.auth_email_deliveries;
DROP POLICY IF EXISTS pipwise_lp_delivery_insert ON public.auth_email_deliveries;
DROP POLICY IF EXISTS pipwise_lp_delivery_update ON public.auth_email_deliveries;
DROP POLICY IF EXISTS pipwise_lp_delivery_delete_old ON public.auth_email_deliveries;
DROP POLICY IF EXISTS pipwise_lp_retention_select_expired ON public.beta_feedback;
DROP POLICY IF EXISTS pipwise_lp_retention_delete_expired ON public.beta_feedback;
DROP POLICY IF EXISTS pipwise_lp_helper_quota_select ON public.chart_review_usage;
DROP POLICY IF EXISTS pipwise_lp_helper_quota_delete ON public.chart_review_usage;

-- Table revocation also removes matching per-column grants (PostgreSQL 18).
REVOKE ALL ON TABLE public.account_details, public.beta_feedback,
  public.chart_review_usage, public.auth_email_deliveries
  FROM app_runtime, retention_job;
REVOKE ALL ON TABLE public.chart_review_usage FROM migrator;
REVOKE ALL ON TABLE pipwise_migrations.schema_migrations FROM migrator;
REVOKE ALL ON SCHEMA pipwise_migrations FROM migrator;
REVOKE ALL ON TABLE neon_auth."user", neon_auth.session,
  neon_auth.verification FROM migrator;
REVOKE ALL ON SCHEMA neon_auth FROM migrator;
REVOKE ALL ON SCHEMA public FROM migrator, app_runtime, retention_job;

-- Restore the new creator role's original defaults and close any future app
-- objects to service roles, without dropping their tables or retained data.
SET LOCAL ROLE migrator;
ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA pipwise_app
  REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM app_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA pipwise_app
  REVOKE USAGE ON SEQUENCES FROM app_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE migrator GRANT EXECUTE ON FUNCTIONS TO PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA pipwise_app FROM app_runtime, retention_job;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA pipwise_app FROM app_runtime, retention_job;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA pipwise_app
  FROM PUBLIC, app_runtime, retention_job;
DROP FUNCTION IF EXISTS pipwise_app.session_is_active(uuid,text) RESTRICT;
DROP FUNCTION IF EXISTS pipwise_app.lock_active_account(uuid) RESTRICT;
DROP FUNCTION IF EXISTS pipwise_app.delete_account(uuid,text) RESTRICT;
REVOKE ALL ON SCHEMA pipwise_app FROM app_runtime, retention_job;
DO $keep_future_objects$
BEGIN
  DROP SCHEMA pipwise_app RESTRICT;
EXCEPTION WHEN dependent_objects_still_exist THEN
  RAISE NOTICE 'pipwise_app retained because later objects exist; review them separately';
END;
$keep_future_objects$;
RESET ROLE;

-- Exact reviewed database ACL baseline:
-- {=Tc/neondb_owner,neondb_owner=CTc/neondb_owner,neon_superuser=CTc/neondb_owner}
-- Keep neon_superuser's PRE-EXISTING explicit TEMP grant. Only neon_auth's TEMP
-- grant was introduced here. Public-schema USAGE and ownership were unchanged.
GRANT TEMPORARY ON DATABASE neondb TO PUBLIC;
REVOKE TEMPORARY ON DATABASE neondb FROM neon_auth;
REVOKE CONNECT ON DATABASE neondb FROM migrator, app_runtime, retention_job;
ALTER ROLE migrator IN DATABASE neondb RESET search_path;
ALTER ROLE app_runtime IN DATABASE neondb RESET search_path;
ALTER ROLE retention_job IN DATABASE neondb RESET search_path;
REVOKE migrator FROM neondb_owner;
COMMIT;
-- The three disabled roles may retain future ownership dependencies. Do not
-- force-drop them. Privately revoke/replace unused credentials after recovery.
-- Run a reviewed catalog/ACL comparison to the saved original baseline.
