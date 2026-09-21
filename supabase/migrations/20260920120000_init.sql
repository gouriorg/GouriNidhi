-- GouriNidhi shared schema. Paste into Supabase SQL editor or apply with the CLI.
-- Auth: disable "Confirm email" in Authentication → Providers → Email.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables first (SQL helper functions reference these relations)
-- ---------------------------------------------------------------------------

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'member')),
  created_at timestamptz not null default now()
);

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  mobile text not null unique,
  address text,
  notes text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schemes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  monthly_amount bigint not null,
  max_members integer not null,
  duration_months integer not null,
  start_date date not null,
  collection_day integer not null check (collection_day between 1 and 28),
  profit_bps integer not null default 0,
  distribution_mode text not null default 'fixed_profit',
  schedule_snapshot jsonb,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scheme_members (
  id uuid primary key default gen_random_uuid(),
  scheme_id uuid not null references public.schemes (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete restrict,
  member_number integer not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  joined_at date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scheme_id, person_id),
  unique (scheme_id, member_number)
);

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  scheme_id uuid not null references public.schemes (id) on delete cascade,
  month_number integer not null,
  due_date date not null,
  expected_collection bigint not null,
  actual_collection bigint not null default 0,
  pending_amount bigint not null default 0,
  planned_payout_amount bigint not null,
  recipient_person_id uuid references public.people (id),
  status text not null default 'upcoming',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scheme_id, month_number)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  scheme_id uuid not null references public.schemes (id) on delete cascade,
  round_id uuid not null references public.rounds (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete restrict,
  amount_due bigint not null,
  amount_paid bigint not null default 0,
  paid_date date,
  method text,
  reference text,
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scheme_id, round_id, person_id)
);

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  scheme_id uuid not null references public.schemes (id) on delete cascade,
  round_id uuid not null references public.rounds (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete restrict,
  gross_pool bigint not null,
  adjustment bigint not null,
  payout_amount bigint not null,
  auto_calculated boolean not null default true,
  paid_date date,
  method text,
  reference text,
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scheme_id, round_id)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  summary text not null,
  before_json text,
  after_json text,
  actor_person_id uuid,
  actor_label text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  key text primary key,
  value jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists people_mobile_idx on public.people (mobile);
create index if not exists scheme_members_scheme_idx on public.scheme_members (scheme_id);
create index if not exists scheme_members_person_idx on public.scheme_members (person_id);
create index if not exists rounds_scheme_idx on public.rounds (scheme_id);
create index if not exists payments_round_idx on public.payments (round_id);
create index if not exists payments_person_idx on public.payments (person_id);
create index if not exists payouts_person_idx on public.payouts (person_id);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.my_person_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.people where auth_user_id = auth.uid() limit 1;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.user_roles enable row level security;
alter table public.people enable row level security;
alter table public.schemes enable row level security;
alter table public.scheme_members enable row level security;
alter table public.rounds enable row level security;
alter table public.payments enable row level security;
alter table public.payouts enable row level security;
alter table public.audit_logs enable row level security;
alter table public.settings enable row level security;

drop policy if exists user_roles_admin_all on public.user_roles;
create policy user_roles_admin_all on public.user_roles
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists user_roles_self_read on public.user_roles;
create policy user_roles_self_read on public.user_roles
  for select using (user_id = auth.uid());

drop policy if exists people_admin_all on public.people;
create policy people_admin_all on public.people
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists people_self_read on public.people;
create policy people_self_read on public.people
  for select using (id = public.my_person_id());

drop policy if exists schemes_admin_all on public.schemes;
create policy schemes_admin_all on public.schemes
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists schemes_member_read on public.schemes;
create policy schemes_member_read on public.schemes
  for select using (
    exists (
      select 1 from public.scheme_members sm
      where sm.scheme_id = schemes.id
        and sm.person_id = public.my_person_id()
    )
  );

drop policy if exists scheme_members_admin_all on public.scheme_members;
create policy scheme_members_admin_all on public.scheme_members
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists scheme_members_self_read on public.scheme_members;
create policy scheme_members_self_read on public.scheme_members
  for select using (person_id = public.my_person_id());

drop policy if exists rounds_admin_all on public.rounds;
create policy rounds_admin_all on public.rounds
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists rounds_member_read on public.rounds;
create policy rounds_member_read on public.rounds
  for select using (
    exists (
      select 1 from public.scheme_members sm
      where sm.scheme_id = rounds.scheme_id
        and sm.person_id = public.my_person_id()
    )
  );

drop policy if exists payments_admin_all on public.payments;
create policy payments_admin_all on public.payments
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists payments_self_read on public.payments;
create policy payments_self_read on public.payments
  for select using (person_id = public.my_person_id());

drop policy if exists payouts_admin_all on public.payouts;
create policy payouts_admin_all on public.payouts
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists payouts_self_read on public.payouts;
create policy payouts_self_read on public.payouts
  for select using (person_id = public.my_person_id());

drop policy if exists audit_admin_all on public.audit_logs;
create policy audit_admin_all on public.audit_logs
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists settings_admin_all on public.settings;
create policy settings_admin_all on public.settings
  for all using (public.is_admin()) with check (public.is_admin());

grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.is_admin() to authenticated, anon;
grant execute on function public.my_person_id() to authenticated, anon;

-- The first admin Auth user is created by the bootstrap-admin Edge Function
-- (email admin@gourinidhi.local, password admin). Member logins use
-- {mobile}@members.gourinidhi.local with password = mobile.
