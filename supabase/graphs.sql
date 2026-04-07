create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free',
  subscription_status text not null default 'inactive',
  ai_quota integer not null default 3,
  ai_used integer not null default 0,
  quota_period_start timestamptz,
  quota_period_end timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.graphs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  topic text not null,
  memo text not null default '',
  seed jsonb not null,
  saved_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  is_favorite boolean not null default false,
  archived_at timestamptz
);

create table if not exists public.supporter_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  supporter_name text not null,
  email text not null,
  support_amount integer not null,
  depositor_name text not null,
  status text not null default 'pending',
  memo text,
  proof_url text,
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles
  add column if not exists plan text not null default 'free',
  add column if not exists subscription_status text not null default 'inactive',
  add column if not exists ai_quota integer not null default 3,
  add column if not exists ai_used integer not null default 0,
  add column if not exists quota_period_start timestamptz,
  add column if not exists quota_period_end timestamptz,
  add column if not exists pro_expires_at timestamptz;

alter table public.graphs
  add column if not exists title text,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists is_favorite boolean not null default false,
  add column if not exists archived_at timestamptz;

alter table public.supporter_requests
  add column if not exists supporter_name text,
  add column if not exists email text,
  add column if not exists support_amount integer,
  add column if not exists depositor_name text,
  add column if not exists status text not null default 'pending',
  add column if not exists memo text,
  add column if not exists proof_url text,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.profiles
set
  plan = coalesce(plan, 'free'),
  subscription_status = coalesce(subscription_status, 'inactive'),
  ai_quota = coalesce(ai_quota, 3),
  ai_used = coalesce(ai_used, 0),
  quota_period_start = coalesce(quota_period_start, timezone('utc', now())),
  quota_period_end = coalesce(quota_period_end, timezone('utc', now()) + interval '30 days'),
  updated_at = timezone('utc', now())
where quota_period_start is null
   or quota_period_end is null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'ai_uses'
  ) then
    execute $migration$
      update public.profiles
      set
        ai_used = coalesce(ai_uses, ai_used, 0),
        ai_quota = coalesce(ai_quota, 3),
        quota_period_start = coalesce(quota_period_start, timezone('utc', now())),
        quota_period_end = coalesce(quota_period_end, timezone('utc', now()) + interval '30 days'),
        updated_at = timezone('utc', now())
    $migration$;

    alter table public.profiles drop column ai_uses;
  end if;
end
$$;

update public.graphs
set
  title = coalesce(nullif(title, ''), topic),
  created_at = coalesce(created_at, saved_at, timezone('utc', now())),
  updated_at = coalesce(updated_at, saved_at, timezone('utc', now()))
where title is null or title = '';

alter table public.graphs
  alter column title set not null;

drop index if exists graphs_user_id_idx;

create index if not exists graphs_user_id_updated_at_idx
  on public.graphs (user_id, updated_at desc);

create index if not exists graphs_user_id_favorite_updated_at_idx
  on public.graphs (user_id, is_favorite desc, updated_at desc);

create index if not exists supporter_requests_user_id_created_at_idx
  on public.supporter_requests (user_id, created_at desc);

alter table public.graphs enable row level security;
alter table public.profiles enable row level security;
alter table public.supporter_requests enable row level security;

drop policy if exists "graphs_select_own" on public.graphs;
drop policy if exists "graphs_insert_own" on public.graphs;
drop policy if exists "graphs_update_own" on public.graphs;
drop policy if exists "graphs_delete_own" on public.graphs;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "supporter_requests_select_own" on public.supporter_requests;
drop policy if exists "supporter_requests_insert_own" on public.supporter_requests;
drop policy if exists "supporter_requests_update_own" on public.supporter_requests;

create policy "graphs_select_own"
  on public.graphs
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "graphs_insert_own"
  on public.graphs
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "graphs_update_own"
  on public.graphs
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "graphs_delete_own"
  on public.graphs
  for delete
  to authenticated
  using (user_id = auth.uid());

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "supporter_requests_select_own"
  on public.supporter_requests
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "supporter_requests_insert_own"
  on public.supporter_requests
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "supporter_requests_update_own"
  on public.supporter_requests
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Stripe billing fields
alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists stripe_status text;
