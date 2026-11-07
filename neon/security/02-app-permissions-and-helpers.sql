-- MANUAL, UNAPPLIED. Run after 01 as neondb_owner; never via automatic migration.
-- Adds permissions/policies and new helpers; does not edit existing user rows,
-- names, ownership, columns, or schemas. Existing tables remain in public.
BEGIN;
SET LOCAL lock_timeout = '10s';
DO $check_setup$
BEGIN
  IF current_database() <> 'neondb' OR current_user <> 'neondb_owner'
      OR NOT EXISTS (SELECT 1 FROM pg_namespace
        WHERE nspname = 'pipwise_app' AND nspowner = 'migrator'::regrole) THEN
    RAISE EXCEPTION 'Run bootstrap first, then this file as neondb_owner';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_auth_members
      WHERE member IN ('app_runtime'::regrole, 'retention_job'::regrole)) THEN
    RAISE EXCEPTION 'Service roles must have no memberships';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
      AND tablename IN ('account_details','beta_feedback','chart_review_usage',
        'auth_email_deliveries')) THEN
    RAISE EXCEPTION 'Existing app policies changed; review rather than OR with them';
  END IF;
END;
$check_setup$;

GRANT SELECT (user_id, country_code, phone_number),
  INSERT (user_id, country_code, phone_number),
  UPDATE (country_code, phone_number, updated_at)
  ON TABLE public.account_details TO app_runtime;
GRANT INSERT (user_id, client_report_id, rating, category, message,
  app_version, platform, language), SELECT (created_at), DELETE
  ON TABLE public.beta_feedback TO app_runtime;
GRANT SELECT (user_id, month_start, attempts),
  INSERT (user_id, month_start, attempts), UPDATE (attempts)
  ON TABLE public.chart_review_usage TO app_runtime;
GRANT SELECT (event_id, owner_id, status, lease_until, created_at),
  INSERT (event_id, owner_id, status, lease_until),
  UPDATE (owner_id, status, lease_until, updated_at), DELETE
  ON TABLE public.auth_email_deliveries TO app_runtime;
GRANT SELECT (created_at), DELETE ON TABLE public.beta_feedback TO retention_job;

-- Shared server roles are not mobile-user identities. API authentication still
-- checks the verified caller and current session before accessing their records.
CREATE POLICY pipwise_lp_details_select ON public.account_details
  FOR SELECT TO app_runtime USING (true);
CREATE POLICY pipwise_lp_details_insert ON public.account_details
  FOR INSERT TO app_runtime WITH CHECK (true);
CREATE POLICY pipwise_lp_details_update ON public.account_details
  FOR UPDATE TO app_runtime USING (true) WITH CHECK (true);
CREATE POLICY pipwise_lp_feedback_insert ON public.beta_feedback
  FOR INSERT TO app_runtime WITH CHECK (true);
CREATE POLICY pipwise_lp_feedback_select_expired ON public.beta_feedback
  FOR SELECT TO app_runtime USING (created_at <= now() - interval '12 months');
CREATE POLICY pipwise_lp_feedback_delete_expired ON public.beta_feedback
  FOR DELETE TO app_runtime USING (created_at <= now() - interval '12 months');
CREATE POLICY pipwise_lp_quota_select ON public.chart_review_usage
  FOR SELECT TO app_runtime USING (true);
CREATE POLICY pipwise_lp_quota_insert ON public.chart_review_usage
  FOR INSERT TO app_runtime WITH CHECK (true);
CREATE POLICY pipwise_lp_quota_update ON public.chart_review_usage
  FOR UPDATE TO app_runtime USING (true) WITH CHECK (true);
CREATE POLICY pipwise_lp_delivery_select ON public.auth_email_deliveries
  FOR SELECT TO app_runtime USING (true);
CREATE POLICY pipwise_lp_delivery_insert ON public.auth_email_deliveries
  FOR INSERT TO app_runtime WITH CHECK (true);
CREATE POLICY pipwise_lp_delivery_update ON public.auth_email_deliveries
  FOR UPDATE TO app_runtime USING (true) WITH CHECK (true);
CREATE POLICY pipwise_lp_delivery_delete_old ON public.auth_email_deliveries
  FOR DELETE TO app_runtime USING (created_at < now() - interval '30 days');
CREATE POLICY pipwise_lp_retention_select_expired ON public.beta_feedback
  FOR SELECT TO retention_job USING (created_at <= now() - interval '12 months');
CREATE POLICY pipwise_lp_retention_delete_expired ON public.beta_feedback
  FOR DELETE TO retention_job USING (created_at <= now() - interval '12 months');
-- Definer owner is not the owner of this existing table and cannot bypass RLS.
CREATE POLICY pipwise_lp_helper_quota_select ON public.chart_review_usage
  FOR SELECT TO migrator USING (true);
CREATE POLICY pipwise_lp_helper_quota_delete ON public.chart_review_usage
  FOR DELETE TO migrator USING (true);

SET LOCAL ROLE migrator;
-- Global creator default revocation is required for functions: IN SCHEMA alone
-- cannot remove the built-in PUBLIC EXECUTE default. No defaults change for the
-- owners of public or managed Auth objects.
ALTER DEFAULT PRIVILEGES FOR ROLE migrator REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA pipwise_app
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA pipwise_app
  GRANT USAGE ON SEQUENCES TO app_runtime;
-- Namespace is app-only; future tables there also need explicit RLS policies.
-- No default grants in public, Auth, or ledger, and none for retention_job.

CREATE FUNCTION pipwise_app.session_is_active(p_user_id uuid, p_session_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT p_session_token IS NOT NULL
    AND length(p_session_token) BETWEEN 1 AND 2048
    AND EXISTS (
      SELECT 1 FROM neon_auth."user" AS account
      JOIN neon_auth.session AS session ON session."userId" = account.id
      WHERE account.id = p_user_id
        AND account."emailVerified" = true
        AND COALESCE(account.banned, false) = false
        AND session.token = p_session_token
        AND session."expiresAt" > now()
        AND session."impersonatedBy" IS NULL
    );
$function$;

CREATE FUNCTION pipwise_app.lock_active_account(p_user_id uuid)
RETURNS TABLE (id uuid) LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
BEGIN
  RETURN QUERY SELECT account.id FROM neon_auth."user" AS account
    WHERE account.id = p_user_id
      AND account."emailVerified" = true
      AND COALESCE(account.banned, false) = false
    FOR KEY SHARE OF account;
END;
$function$;

CREATE FUNCTION pipwise_app.delete_account(p_user_id uuid, p_session_token text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
DECLARE did_delete boolean;
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION USING ERRCODE = '25001',
      MESSAGE = 'Account deletion requires read committed';
  END IF;
  IF p_session_token IS NULL OR length(p_session_token) NOT BETWEEN 1 AND 2048 THEN
    RETURN false;
  END IF;
  -- Separate internal commands preserve the original lock/snapshot ordering.
  -- VOLATILE commands obtain fresh snapshots under READ COMMITTED.
  PERFORM account.id FROM neon_auth."user" AS account
    WHERE account.id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  WITH authorized AS MATERIALIZED (
    SELECT account.id, account.email FROM neon_auth."user" AS account
    WHERE account.id = p_user_id
      AND account."emailVerified" = true
      AND COALESCE(account.banned, false) = false
      AND EXISTS (
        SELECT 1 FROM neon_auth.session AS session
        WHERE session."userId" = account.id AND session.token = p_session_token
          AND session."expiresAt" > now()
          AND session."createdAt" >= now() - interval '10 minutes'
          AND session."createdAt" <= now() + interval '30 seconds'
          AND session."impersonatedBy" IS NULL
      )
    FOR UPDATE OF account
  ), removed_quota AS (
    DELETE FROM public.chart_review_usage AS usage USING authorized
    WHERE usage.user_id = authorized.id::text RETURNING usage.user_id
  ), removed_verification AS (
    DELETE FROM neon_auth.verification AS verification USING authorized
    WHERE verification.identifier IN (
        authorized.email,
        'email-verification-otp-' || lower(authorized.email),
        'sign-in-otp-' || lower(authorized.email),
        'forget-password-otp-' || lower(authorized.email)
      )
      OR starts_with(verification.identifier,
        'change-email-otp-' || lower(authorized.email) || '-')
      OR (starts_with(verification.identifier, 'reset-password:')
        AND verification.value = authorized.id::text)
    RETURNING verification.id
  ), removed_user AS (
    DELETE FROM neon_auth."user" AS account USING authorized
    WHERE account.id = authorized.id
      AND (SELECT count(*) FROM removed_quota) >= 0
      AND (SELECT count(*) FROM removed_verification) >= 0
    RETURNING account.id
  ) SELECT EXISTS (SELECT 1 FROM removed_user) INTO did_delete;
  -- Existing verified FKs cascade sessions/provider accounts/details/feedback.
  RETURN COALESCE(did_delete, false);
END;
$function$;

REVOKE ALL ON FUNCTION pipwise_app.session_is_active(uuid, text),
  pipwise_app.lock_active_account(uuid), pipwise_app.delete_account(uuid, text)
  FROM PUBLIC, retention_job;
GRANT EXECUTE ON FUNCTION pipwise_app.session_is_active(uuid, text),
  pipwise_app.lock_active_account(uuid), pipwise_app.delete_account(uuid, text)
  TO app_runtime;
RESET ROLE;
COMMIT;
