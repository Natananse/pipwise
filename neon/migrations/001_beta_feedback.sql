-- Private beta reviews for Neon Managed Auth users. The Data API accepts only
-- inserts attributed to the JWT subject; reviews stay readable by the owner.
create table public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references neon_auth."user" (id) on delete cascade,
  client_report_id text not null check (client_report_id ~ '^[a-z0-9-]{10,80}$'),
  rating smallint not null check (rating between 1 and 5),
  category text not null check (category in ('bug', 'idea', 'other')),
  message text not null check (char_length(btrim(message)) between 1 and 2000),
  app_version text not null check (char_length(app_version) <= 80),
  platform text not null check (char_length(platform) <= 20),
  language text not null check (char_length(language) <= 10),
  created_at timestamptz not null default now(),
  constraint beta_feedback_user_report_key unique (user_id, client_report_id)
);

alter table public.beta_feedback enable row level security;
-- Auth-only branches have no Data API roles or auth.user_id(). Keep the table
-- private there rather than provisioning an unrelated database interface.
revoke all on table public.beta_feedback from public;
do $feedback_access$
declare client_role text;
begin
  for client_role in select rolname from pg_roles where rolname in ('anonymous', 'authenticated') loop
    execute format('revoke all on table public.beta_feedback from %I', client_role);
  end loop;
  if exists (select 1 from pg_roles where rolname = 'authenticated')
    and to_regprocedure('auth.user_id()') is not null then
    execute 'grant usage on schema public to authenticated';
    execute 'grant insert on table public.beta_feedback to authenticated';
    execute $policy$
      create policy "signed-in users submit own beta feedback"
        on public.beta_feedback for insert to authenticated
        with check ((select auth.user_id()) = user_id::text)
    $policy$;
  end if;
end;
$feedback_access$;

-- No SELECT/UPDATE/DELETE grants or policies: clients cannot read or change
-- reviews, including their own. INSERT uses return=minimal in the app.
