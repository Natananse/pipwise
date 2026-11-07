-- READ-ONLY, UNAPPLIED. Run as neondb_owner after 01/02; no credential values.
-- Inventory references private schemas; it is not a restricted-role login test.
-- Every row in the assertions result must have passes=true. Inspect inventories
-- too: a success row cannot certify unlisted future objects or login passwords.
BEGIN READ ONLY;
SELECT current_database() AS database_name, current_user AS connected_role,
  current_setting('server_version') AS server_version;

WITH checks(name, passes) AS (
  SELECT 'three constrained login roles', count(*) = 3 AND bool_and(
    rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
    AND NOT rolreplication AND NOT rolbypassrls AND NOT rolinherit)
  FROM pg_roles WHERE rolname IN ('migrator','app_runtime','retention_job')
  UNION ALL SELECT 'no memberships for any scoped role', NOT EXISTS (
    SELECT 1 FROM pg_auth_members
    WHERE member IN ('migrator'::regrole,'app_runtime'::regrole,'retention_job'::regrole))
  UNION ALL SELECT 'no database CREATE or TEMP for scoped roles', bool_and(
    NOT has_database_privilege(role_name, current_database(), 'CREATE')
    AND NOT has_database_privilege(role_name, current_database(), 'TEMP'))
    FROM unnest(ARRAY['migrator','app_runtime','retention_job']) AS role_name
  UNION ALL SELECT 'no public-schema CREATE for scoped roles', bool_and(
    NOT has_schema_privilege(role_name,'public','CREATE'))
    FROM unnest(ARRAY['migrator','app_runtime','retention_job']) AS role_name
  UNION ALL SELECT 'runtime and retention cannot use Auth or ledger schemas', bool_and(
    NOT has_schema_privilege(role_name,'neon_auth','USAGE')
    AND NOT has_schema_privilege(role_name,'pipwise_migrations','USAGE'))
    FROM unnest(ARRAY['app_runtime','retention_job']) AS role_name
  UNION ALL SELECT 'runtime allowed account-details columns',
    has_column_privilege('app_runtime','public.account_details','country_code','SELECT')
    AND has_column_privilege('app_runtime','public.account_details','user_id','INSERT')
    AND has_column_privilege('app_runtime','public.account_details','phone_number','UPDATE')
    AND NOT has_table_privilege('app_runtime','public.account_details','DELETE')
  UNION ALL SELECT 'runtime feedback contents are not readable',
    has_column_privilege('app_runtime','public.beta_feedback','message','INSERT')
    AND has_column_privilege('app_runtime','public.beta_feedback','created_at','SELECT')
    AND NOT has_column_privilege('app_runtime','public.beta_feedback','message','SELECT')
  UNION ALL SELECT 'retention cutoff read/delete only',
    has_column_privilege('retention_job','public.beta_feedback','created_at','SELECT')
    AND has_table_privilege('retention_job','public.beta_feedback','DELETE')
    AND NOT has_column_privilege('retention_job','public.beta_feedback','message','SELECT')
    AND NOT has_column_privilege('retention_job','public.beta_feedback','user_id','SELECT')
    AND NOT has_any_column_privilege('retention_job','public.beta_feedback','INSERT')
    AND NOT has_any_column_privilege('retention_job','public.beta_feedback','UPDATE')
  UNION ALL SELECT 'retention no other app-table operations', bool_and(
    NOT has_any_column_privilege('retention_job', table_name,'SELECT,INSERT,UPDATE,REFERENCES')
    AND NOT has_table_privilege('retention_job',table_name,'DELETE,TRUNCATE,TRIGGER'))
    FROM unnest(ARRAY['public.account_details','public.chart_review_usage',
      'public.auth_email_deliveries']) AS table_name
  UNION ALL SELECT 'runtime/retention no direct Auth table operations', bool_and(
    NOT has_any_column_privilege(role_name,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')
    AND NOT has_table_privilege(role_name,c.oid,'DELETE,TRUNCATE,TRIGGER'))
    FROM unnest(ARRAY['app_runtime','retention_job']) AS role_name
    CROSS JOIN pg_class AS c JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'neon_auth' AND c.relkind IN ('r','p','v','m','f')
  UNION ALL SELECT 'new helper schema DDL only for migrator',
    has_schema_privilege('migrator','pipwise_app','CREATE')
    AND NOT has_schema_privilege('app_runtime','pipwise_app','CREATE')
    AND NOT has_schema_privilege('retention_job','pipwise_app','USAGE')
  UNION ALL SELECT 'helper owner Auth user privileges',
    bool_and(has_column_privilege('migrator','neon_auth."user"',column_name,'SELECT'))
    AND has_schema_privilege('migrator','neon_auth','USAGE')
    AND has_column_privilege('migrator','neon_auth."user"','id','UPDATE')
    AND has_table_privilege('migrator','neon_auth."user"','DELETE')
    FROM unnest(ARRAY['id','email','emailVerified','banned']) AS column_name
  UNION ALL SELECT 'helper owner Auth session privileges',
    bool_and(has_column_privilege('migrator','neon_auth.session',column_name,'SELECT'))
    FROM unnest(ARRAY['userId','token','expiresAt','createdAt','impersonatedBy']) AS column_name
  UNION ALL SELECT 'helper owner Auth verification privileges',
    bool_and(has_column_privilege('migrator','neon_auth.verification',column_name,'SELECT'))
    AND has_table_privilege('migrator','neon_auth.verification','DELETE')
    FROM unnest(ARRAY['id','identifier','value']) AS column_name
  UNION ALL SELECT 'helper owner and secure properties', count(*) = 3
    AND bool_and(p.proowner = 'migrator'::regrole AND p.prosecdef
      AND p.proconfig @> ARRAY['search_path=pg_catalog, pg_temp'])
    FROM pg_proc AS p JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'pipwise_app'
      AND p.proname IN ('session_is_active','lock_active_account','delete_account')
  UNION ALL SELECT 'helper execution runtime only', bool_and(
    has_function_privilege('app_runtime', function_name,'EXECUTE')
    AND NOT has_function_privilege('retention_job',function_name,'EXECUTE'))
    FROM unnest(ARRAY['pipwise_app.session_is_active(uuid,text)',
      'pipwise_app.lock_active_account(uuid)',
      'pipwise_app.delete_account(uuid,text)']) AS function_name
  UNION ALL SELECT 'helpers have no PUBLIC EXECUTE', NOT EXISTS (
    SELECT 1 FROM pg_proc AS p JOIN pg_namespace AS n ON n.oid = p.pronamespace,
      LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) AS a
    WHERE n.nspname = 'pipwise_app' AND a.grantee = 0
      AND a.privilege_type = 'EXECUTE')
  UNION ALL SELECT 'legacy table owners/RLS preserved', count(*) = 4 AND bool_and(
    c.relowner = 'neondb_owner'::regrole AND c.relrowsecurity AND NOT c.relforcerowsecurity)
    FROM pg_class AS c JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname IN ('account_details','beta_feedback',
      'chart_review_usage','auth_email_deliveries')
  UNION ALL SELECT 'ledger owner preserved and migrator DML scoped',
    (SELECT relowner = 'neondb_owner'::regrole
      FROM pg_class WHERE oid = 'pipwise_migrations.schema_migrations'::regclass)
    AND has_table_privilege('migrator','pipwise_migrations.schema_migrations','SELECT')
    AND has_table_privilege('migrator','pipwise_migrations.schema_migrations','INSERT')
    AND NOT has_table_privilege('migrator','pipwise_migrations.schema_migrations','UPDATE,DELETE,TRUNCATE')
) SELECT name, COALESCE(passes,false) AS passes FROM checks ORDER BY name;

-- Effective object/column ACL inventory. Column SELECT is deliberate: table-level
-- has_table_privilege(...,'SELECT') alone misses the allowed retention read.
SELECT grantee, table_schema, table_name, column_name, privilege_type
FROM information_schema.column_privileges
WHERE grantee IN ('migrator','app_runtime','retention_job')
ORDER BY grantee, table_schema, table_name, column_name, privilege_type;
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE policyname LIKE 'pipwise_lp_%'
ORDER BY schemaname, tablename, policyname;
SELECT r.rolname AS creator, COALESCE(n.nspname,'<global>') AS schema_scope,
  d.defaclobjtype AS object_type, d.defaclacl AS default_acl
FROM pg_default_acl AS d JOIN pg_roles AS r ON r.oid = d.defaclrole
LEFT JOIN pg_namespace AS n ON n.oid = d.defaclnamespace
WHERE r.rolname IN ('migrator','app_runtime','retention_job')
ORDER BY creator, schema_scope, object_type;
-- Expect only creator=migrator: global no PUBLIC function EXECUTE, future
-- pipwise_app table DML and sequence USAGE to runtime, no retention defaults.
COMMIT;
