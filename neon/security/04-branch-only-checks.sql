-- MANUAL, UNAPPLIED. NEVER RUN ON PRODUCTION. Ends in ROLLBACK, not COMMIT.
-- First sign up a disposable, verified user through the app on an ISOLATED
-- branch. Confirm the actual endpoint/branch privately in Neon. Replace BOTH
-- placeholders below. The confirmation is a human guard, not branch detection.
-- These limited synthetic checks do not test Auth seed/deletion/concurrency.
BEGIN ISOLATION LEVEL READ COMMITTED;
SET LOCAL lock_timeout = '10s';
SET LOCAL pipwise.test_branch_confirmation = 'REPLACE_WITH_ISOLATED_BRANCH_CONFIRMED';
SET LOCAL pipwise.test_user_id = 'REPLACE_WITH_DISPOSABLE_BRANCH_USER_UUID';

DO $guard$
DECLARE fixture_id uuid;
BEGIN
  IF current_database() <> 'neondb' OR current_user <> 'neondb_owner'
      OR current_setting('pipwise.test_branch_confirmation',true)
        IS DISTINCT FROM 'ISOLATED_BRANCH_CONFIRMED' THEN
    RAISE EXCEPTION 'Stop: confirm isolated branch and edit both placeholders';
  END IF;
  fixture_id := current_setting('pipwise.test_user_id')::uuid;
  IF NOT EXISTS (SELECT 1 FROM neon_auth."user"
      WHERE id = fixture_id AND "emailVerified" = true
        AND COALESCE(banned,false) = false) THEN
    RAISE EXCEPTION 'Expected disposable verified user created on this branch';
  END IF;
  PERFORM set_config('pipwise.test_expired_id',gen_random_uuid()::text,true);
  PERFORM set_config('pipwise.test_fresh_id',gen_random_uuid()::text,true);
  PERFORM set_config('pipwise.test_runtime_id',gen_random_uuid()::text,true);
  PERFORM set_config('pipwise.test_expired_at',
    (now() - interval '13 months' - random() * interval '1 day')::text,true);
  PERFORM set_config('pipwise.test_fresh_at',now()::text,true);
  PERFORM set_config('pipwise.test_quota_id','__lp_test_' || gen_random_uuid()::text,true);
  PERFORM set_config('pipwise.test_delivery_id','lp_test_' || gen_random_uuid()::text,true);
  IF EXISTS (SELECT 1 FROM public.beta_feedback
      WHERE created_at IN (current_setting('pipwise.test_expired_at')::timestamptz,
        current_setting('pipwise.test_fresh_at')::timestamptz)) THEN
    RAISE EXCEPTION 'Timestamp collision: rollback and retry isolated fixture';
  END IF;
END;
$guard$;

-- All rows inserted by this file are synthetic and discarded by ROLLBACK.
INSERT INTO public.beta_feedback
  (id,user_id,client_report_id,rating,category,message,app_version,platform,language,created_at)
VALUES
  (current_setting('pipwise.test_expired_id')::uuid,
   current_setting('pipwise.test_user_id')::uuid,
   current_setting('pipwise.test_expired_id'),5,'other','Synthetic expired permission test',
   'permission-test','android','en',current_setting('pipwise.test_expired_at')::timestamptz),
  (current_setting('pipwise.test_fresh_id')::uuid,
   current_setting('pipwise.test_user_id')::uuid,
   current_setting('pipwise.test_fresh_id'),5,'other','Synthetic fresh permission test',
   'permission-test','android','en',current_setting('pipwise.test_fresh_at')::timestamptz);

-- SET-role capability is granted only inside this rollback transaction. Actual
-- independent password logins must also be tested privately by the owner.
GRANT app_runtime, retention_job TO neondb_owner
  WITH INHERIT FALSE, SET TRUE GRANTED BY neondb_owner;
SET LOCAL ROLE retention_job;
DO $retention_checks$
DECLARE affected integer;
BEGIN
  SELECT count(*) INTO affected FROM public.beta_feedback
    WHERE created_at = current_setting('pipwise.test_expired_at')::timestamptz;
  IF affected <> 1 THEN RAISE EXCEPTION 'Expired synthetic row must be visible'; END IF;
  SELECT count(*) INTO affected FROM public.beta_feedback
    WHERE created_at = current_setting('pipwise.test_fresh_at')::timestamptz;
  IF affected <> 0 THEN RAISE EXCEPTION 'Fresh row must be hidden from retention'; END IF;
  DELETE FROM public.beta_feedback
    WHERE created_at = current_setting('pipwise.test_fresh_at')::timestamptz;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'Retention deleted a fresh row'; END IF;
  DELETE FROM public.beta_feedback
    WHERE created_at = current_setting('pipwise.test_expired_at')::timestamptz;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN RAISE EXCEPTION 'Retention failed to delete expired fixture'; END IF;
  BEGIN
    PERFORM message FROM public.beta_feedback WHERE false;
    RAISE EXCEPTION 'Retention unexpectedly can read messages';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM country_code FROM public.account_details WHERE false;
    RAISE EXCEPTION 'Retention unexpectedly can read account details';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM name FROM pipwise_migrations.schema_migrations WHERE false;
    RAISE EXCEPTION 'Retention unexpectedly can read ledger';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM pipwise_app.session_is_active(current_setting('pipwise.test_user_id')::uuid,'invalid-fixture');
    RAISE EXCEPTION 'Retention unexpectedly can execute Auth helper';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    CREATE TEMP TABLE __pipwise_lp_should_fail (id integer);
    RAISE EXCEPTION 'Retention unexpectedly can create temporary tables';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$retention_checks$;
RESET ROLE;

SET LOCAL ROLE app_runtime;
INSERT INTO public.beta_feedback
  (user_id,client_report_id,rating,category,message,app_version,platform,language)
VALUES (current_setting('pipwise.test_user_id')::uuid,
  current_setting('pipwise.test_runtime_id'),5,'other','Synthetic runtime insert',
  'permission-test','android','en');
INSERT INTO public.chart_review_usage (user_id,month_start,attempts)
VALUES (current_setting('pipwise.test_quota_id'),date_trunc('month',now())::date,0);
UPDATE public.chart_review_usage SET attempts = attempts + 1
WHERE user_id = current_setting('pipwise.test_quota_id');
INSERT INTO public.auth_email_deliveries (event_id,owner_id,status,lease_until)
VALUES (current_setting('pipwise.test_delivery_id'),gen_random_uuid(),'sending',now() + interval '1 minute');
UPDATE public.auth_email_deliveries SET status = 'sent',updated_at = now()
WHERE event_id = current_setting('pipwise.test_delivery_id') AND status = 'sending';
DO $runtime_checks$
DECLARE attempts integer; active boolean;
BEGIN
  SELECT usage.attempts INTO attempts FROM public.chart_review_usage AS usage
    WHERE user_id = current_setting('pipwise.test_quota_id');
  IF attempts IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'Runtime quota read/update failed'; END IF;
  SELECT pipwise_app.session_is_active(current_setting('pipwise.test_user_id')::uuid,
    'invalid-fixture-' || gen_random_uuid()::text) INTO active;
  IF active IS DISTINCT FROM false THEN RAISE EXCEPTION 'Invalid session accepted'; END IF;
  BEGIN
    PERFORM id FROM neon_auth."user" WHERE false;
    RAISE EXCEPTION 'Runtime unexpectedly has direct Auth reads';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM message FROM public.beta_feedback WHERE false;
    RAISE EXCEPTION 'Runtime unexpectedly can read feedback messages';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    DELETE FROM public.chart_review_usage
      WHERE user_id = current_setting('pipwise.test_quota_id');
    RAISE EXCEPTION 'Runtime unexpectedly has direct quota deletion';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    CREATE TABLE pipwise_app.__pipwise_lp_should_fail (id integer);
    RAISE EXCEPTION 'Runtime unexpectedly can create persistent tables';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    CREATE TEMP TABLE __pipwise_lp_should_fail (id integer);
    RAISE EXCEPTION 'Runtime unexpectedly can create temporary tables';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$runtime_checks$;
RESET ROLE;

DO $owner_checks$
BEGIN
  IF EXISTS (SELECT 1 FROM public.beta_feedback
      WHERE id = current_setting('pipwise.test_expired_id')::uuid)
      OR NOT EXISTS (SELECT 1 FROM public.beta_feedback
        WHERE id = current_setting('pipwise.test_fresh_id')::uuid)
      OR NOT EXISTS (SELECT 1 FROM public.beta_feedback
        WHERE user_id = current_setting('pipwise.test_user_id')::uuid
          AND client_report_id = current_setting('pipwise.test_runtime_id')) THEN
    RAISE EXCEPTION 'Synthetic retention/runtime postconditions failed';
  END IF;
END;
$owner_checks$;
SELECT 'Limited synthetic branch checks reached rollback; no changes retained' AS result;
ROLLBACK;
-- If any statement errors, explicitly ROLLBACK before retrying. Do not COMMIT.
-- Still UNTESTED: independent logins, real JWT/session calls, account-details
-- upserts, email leasing contention, full quota initialization/caps, account
-- deletion/cascades, revoked/stale/impersonated sessions, and concurrent locks.
