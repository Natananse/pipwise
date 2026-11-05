-- Contact details are private server data, never exposed through the Data API.
create table public.account_details (
  user_id uuid primary key references neon_auth."user" (id) on delete cascade,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  phone_number text check (phone_number is null or phone_number ~ '^\+[1-9][0-9]{6,14}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_details enable row level security;
revoke all on table public.account_details from public;
do $private_account_details$
declare client_role text;
begin
  for client_role in select rolname from pg_roles where rolname in ('anonymous', 'authenticated') loop
    execute format('revoke all on table public.account_details from %I', client_role);
  end loop;
end;
$private_account_details$;
-- There are deliberately no client grants or client policies. Only the trusted
-- server database role queries this table after verifying the caller's JWT.
