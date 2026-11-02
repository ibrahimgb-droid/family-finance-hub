/*
# Core schema v1 (personal ledger, categories, receipts, groups)

1. Plain-English summary
- Creates the base tables for profiles, currencies, categories, receipts, the personal ledger (transactions), groups, family units, invitations, group expenses with immutable split snapshots, and settlements.
- Adds the helper functions and triggers that keep money balanced and confirmed records locked.

2. New tables
- currencies (reference list with minor units), profiles, entitlements (server-only), categories, receipts, transactions, groups, group_members, family_units, family_members, invitations, group_expenses, expense_allocations, settlements.

3. Security
- Row level security enabled on every table.
- Each user can only reach their own profile, categories, receipts and transactions.
- Group data is visible only to members; group membership is only created by the accept_invitation function or the owner trigger.
- Entitlements are readable by the owner and writable only by the server.

4. Important notes
- Money is stored as whole minor units (bigint).
- Confirmed group expenses and their allocations cannot be edited; settlements are append-only.
*/

create extension if not exists pgcrypto;

create type public.tx_status as enum ('draft','confirmed','void');
create type public.tx_source as enum ('manual','receipt');
create type public.group_role as enum ('owner','admin','member');
create type public.invite_status as enum ('pending','accepted','revoked','expired');
create type public.split_method as enum ('equal','fixed','percentage','shares','member_count','weighted_family','consumption_units');
create type public.plan_tier as enum ('free','premium');

create table public.currencies (
  code char(3) primary key check (code ~ '^[A-Z]{3}$'),
  minor_digits smallint not null check (minor_digits between 0 and 3),
  name text not null
);
grant select on public.currencies to anon, authenticated;
grant all on public.currencies to service_role;
alter table public.currencies enable row level security;
create policy "currencies readable" on public.currencies for select using (true);
insert into public.currencies values
 ('KWD',3,'Kuwaiti Dinar'),('BHD',3,'Bahraini Dinar'),('OMR',3,'Omani Rial'),
 ('SAR',2,'Saudi Riyal'),('AED',2,'UAE Dirham'),('QAR',2,'Qatari Riyal'),
 ('USD',2,'US Dollar'),('EUR',2,'Euro'),('GBP',2,'Pound Sterling'),('INR',2,'Indian Rupee');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  default_currency char(3) not null default 'KWD' references public.currencies(code),
  locale text not null default 'en' check (locale in ('en','ar')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create table public.entitlements (
  user_id uuid primary key,
  tier public.plan_tier not null default 'free',
  valid_until timestamptz,
  updated_at timestamptz not null default now()
);
grant select on public.entitlements to authenticated;
grant all on public.entitlements to service_role;
alter table public.entitlements enable row level security;
create policy "own entitlement read" on public.entitlements for select to authenticated using (user_id = auth.uid());

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)), 80))
  on conflict (id) do nothing;
  insert into public.entitlements (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null check (char_length(name) between 1 and 40),
  icon text,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
grant select, insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "own categories" on public.categories for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  byte_size integer not null check (byte_size > 0 and byte_size <= 10485760),
  ocr_text text,
  extraction jsonb,
  extraction_schema_version text,
  retain_until timestamptz,
  created_at timestamptz not null default now(),
  check (storage_path like user_id::text || '/%')
);
create index receipts_user_idx on public.receipts(user_id, created_at desc);
grant select, insert, update, delete on public.receipts to authenticated;
grant all on public.receipts to service_role;
alter table public.receipts enable row level security;
create policy "own receipts" on public.receipts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status public.tx_status not null default 'draft',
  source public.tx_source not null default 'manual',
  merchant text check (char_length(merchant) <= 120),
  occurred_on date not null,
  currency char(3) not null references public.currencies(code),
  total_minor bigint not null check (total_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  category_id uuid references public.categories(id) on delete set null,
  document_ref text check (char_length(document_ref) <= 64),
  note text check (char_length(note) <= 500),
  receipt_id uuid references public.receipts(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (tax_minor <= total_minor),
  check ((status = 'confirmed') = (confirmed_at is not null) or status = 'void')
);
create index tx_user_date_idx on public.transactions(user_id, occurred_on desc);
create index tx_user_status_idx on public.transactions(user_id, status);
create index tx_user_cat_idx on public.transactions(user_id, category_id);
grant select, insert, update, delete on public.transactions to authenticated;
grant all on public.transactions to service_role;
alter table public.transactions enable row level security;
create policy "own tx" on public.transactions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  base_currency char(3) not null references public.currencies(code),
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null,
  role public.group_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index gm_user_idx on public.group_members(user_id);

create or replace function public.is_group_member(_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members where group_id = _group and user_id = auth.uid())
$$;
create or replace function public.is_group_admin(_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members where group_id = _group and user_id = auth.uid() and role in ('owner','admin'))
$$;

grant select, insert, update, delete on public.groups to authenticated;
grant all on public.groups to service_role;
alter table public.groups enable row level security;
create policy "members read group" on public.groups for select to authenticated using (public.is_group_member(id) or created_by = auth.uid());
create policy "create group" on public.groups for insert to authenticated with check (created_by = auth.uid());
create policy "admins update group" on public.groups for update to authenticated using (public.is_group_admin(id)) with check (public.is_group_admin(id));
create policy "owner delete group" on public.groups for delete to authenticated using (created_by = auth.uid());

create or replace function public.add_group_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.group_members(group_id, user_id, role) values (new.id, new.created_by, 'owner');
  return new;
end $$;
create trigger groups_add_owner after insert on public.groups for each row execute function public.add_group_owner();

grant select, update, delete on public.group_members to authenticated;
grant all on public.group_members to service_role;
alter table public.group_members enable row level security;
create policy "members read members" on public.group_members for select to authenticated using (public.is_group_member(group_id));
create policy "admins change roles" on public.group_members for update to authenticated using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id) and role <> 'owner');
create policy "leave or admin remove" on public.group_members for delete to authenticated using ((user_id = auth.uid() and role <> 'owner') or (public.is_group_admin(group_id) and role <> 'owner'));

create table public.family_units (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (group_id, name)
);
create index fu_group_idx on public.family_units(group_id);
create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_unit_id uuid not null references public.family_units(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  user_id uuid,
  weight_milli integer not null default 1000 check (weight_milli >= 0 and weight_milli <= 100000),
  included boolean not null default true,
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);
create index fm_unit_idx on public.family_members(family_unit_id);

create or replace function public.family_member_group_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from public.family_units where id = new.family_unit_id and group_id = new.group_id) then
    raise exception 'family_unit does not belong to group';
  end if;
  return new;
end $$;
create trigger fm_group_guard before insert or update on public.family_members for each row execute function public.family_member_group_guard();

grant select, insert, update, delete on public.family_units, public.family_members to authenticated;
grant all on public.family_units, public.family_members to service_role;
alter table public.family_units enable row level security;
alter table public.family_members enable row level security;
create policy "members read units" on public.family_units for select to authenticated using (public.is_group_member(group_id));
create policy "admins write units" on public.family_units for all to authenticated using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));
create policy "members read fm" on public.family_members for select to authenticated using (public.is_group_member(group_id));
create policy "admins write fm" on public.family_members for all to authenticated using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  invited_by uuid not null,
  email text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  family_member_id uuid references public.family_members(id) on delete cascade,
  token_hash text not null unique,
  status public.invite_status not null default 'pending',
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_by uuid,
  created_at timestamptz not null default now()
);
create index inv_group_idx on public.invitations(group_id);
grant select, insert, update on public.invitations to authenticated;
grant all on public.invitations to service_role;
alter table public.invitations enable row level security;
create policy "admins read invites" on public.invitations for select to authenticated using (public.is_group_admin(group_id));
create policy "admins create invites" on public.invitations for insert to authenticated with check (public.is_group_admin(group_id) and invited_by = auth.uid() and status = 'pending');
create policy "admins revoke invites" on public.invitations for update to authenticated using (public.is_group_admin(group_id)) with check (status in ('pending','revoked'));

create table public.group_expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null,
  paid_by_member_id uuid not null references public.family_members(id),
  description text not null check (char_length(description) between 1 and 120),
  occurred_on date not null,
  currency char(3) not null references public.currencies(code),
  total_minor bigint not null check (total_minor > 0),
  method public.split_method not null,
  status public.tx_status not null default 'draft',
  engine_version text not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create index ge_group_idx on public.group_expenses(group_id, occurred_on desc);
create table public.expense_allocations (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.group_expenses(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  family_unit_id uuid references public.family_units(id),
  family_member_id uuid references public.family_members(id),
  amount_minor bigint not null check (amount_minor >= 0),
  input_value numeric,
  count_snapshot integer,
  weight_snapshot_milli bigint,
  check (family_unit_id is not null or family_member_id is not null)
);
create index ea_expense_idx on public.expense_allocations(expense_id);

grant select, insert, update, delete on public.group_expenses, public.expense_allocations to authenticated;
grant all on public.group_expenses, public.expense_allocations to service_role;
alter table public.group_expenses enable row level security;
alter table public.expense_allocations enable row level security;
create policy "members read expenses" on public.group_expenses for select to authenticated using (public.is_group_member(group_id));
create policy "members create expenses" on public.group_expenses for insert to authenticated with check (public.is_group_member(group_id) and created_by = auth.uid() and status = 'draft');
create policy "creator edit draft" on public.group_expenses for update to authenticated using (public.is_group_member(group_id) and created_by = auth.uid() and status = 'draft') with check (public.is_group_member(group_id));
create policy "creator delete draft" on public.group_expenses for delete to authenticated using (created_by = auth.uid() and status = 'draft');
create policy "members read alloc" on public.expense_allocations for select to authenticated using (public.is_group_member(group_id));
create policy "write alloc on own draft" on public.expense_allocations for all to authenticated
  using (exists (select 1 from public.group_expenses e where e.id = expense_id and e.created_by = auth.uid() and e.status = 'draft' and e.group_id = expense_allocations.group_id))
  with check (exists (select 1 from public.group_expenses e where e.id = expense_id and e.created_by = auth.uid() and e.status = 'draft' and e.group_id = expense_allocations.group_id));

create or replace function public.expense_confirm_guard() returns trigger
language plpgsql set search_path = public as $$
declare s bigint;
begin
  if old.status = 'confirmed' then
    if new.status = 'void' and new.total_minor = old.total_minor and new.method = old.method then return new; end if;
    raise exception 'confirmed expense is immutable';
  end if;
  if new.status = 'confirmed' then
    select coalesce(sum(amount_minor),0) into s from public.expense_allocations where expense_id = new.id;
    if s <> new.total_minor then raise exception 'allocations (%) do not equal total (%)', s, new.total_minor; end if;
    new.confirmed_at := now();
  end if;
  return new;
end $$;
create trigger ge_confirm_guard before update on public.group_expenses for each row execute function public.expense_confirm_guard();

create or replace function public.alloc_immutable_guard() returns trigger
language plpgsql set search_path = public as $$
declare st public.tx_status;
begin
  select status into st from public.group_expenses where id = coalesce(new.expense_id, old.expense_id);
  if st is not null and st <> 'draft' then raise exception 'allocations of a confirmed expense are immutable'; end if;
  return coalesce(new, old);
end $$;
create trigger ea_immutable before insert or update or delete on public.expense_allocations for each row execute function public.alloc_immutable_guard();

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  from_member_id uuid not null references public.family_members(id),
  to_member_id uuid not null references public.family_members(id),
  currency char(3) not null references public.currencies(code),
  amount_minor bigint not null check (amount_minor > 0),
  note text check (char_length(note) <= 200),
  recorded_by uuid not null,
  settled_on date not null default current_date,
  created_at timestamptz not null default now(),
  check (from_member_id <> to_member_id)
);
create index st_group_idx on public.settlements(group_id);
grant select, insert on public.settlements to authenticated;
grant all on public.settlements to service_role;
alter table public.settlements enable row level security;
create policy "members read settlements" on public.settlements for select to authenticated using (public.is_group_member(group_id));
create policy "members record settlements" on public.settlements for insert to authenticated with check (public.is_group_member(group_id) and recorded_by = auth.uid());

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger tx_touch before update on public.transactions for each row execute function public.touch_updated_at();
