-- Private beta reviews. Read them as the project owner in Supabase Table Editor.
-- App users can submit their own reviews, never list or edit other reviews.
create table public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
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
revoke all on table public.beta_feedback from anon, authenticated;
grant insert on table public.beta_feedback to authenticated;

create policy "signed-in users submit own beta feedback"
  on public.beta_feedback for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- No SELECT policy or grant: reviews remain private to the project owner.
