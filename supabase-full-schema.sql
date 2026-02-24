-- Duc Phuc Coffee • Roastery + CRM + ERP mini
-- Paste ONE TIME into Supabase Dashboard → SQL Editor → Run
-- Safe to re-run: uses IF NOT EXISTS where possible.

-- 0) Extensions
create extension if not exists "uuid-ossp";

-- 1) Profiles (role + permission flags)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'sales',
  can_view_profit boolean not null default false,
  created_at timestamptz not null default now()
);

-- Auto-create profile when user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, can_view_profit)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'sales', false)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- 2) Products / Customers / Orders (minimal MVP)
create table if not exists public.products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  sku text unique,
  type text not null check (type in ('raw','finished')),
  unit text,
  cost_price numeric not null default 0,
  sell_price numeric not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text,
  email text,
  address text,
  credit_limit numeric not null default 0,
  owner_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default uuid_generate_v4(),
  order_code text unique,
  customer_id uuid references public.customers(id),
  owner_id uuid references public.profiles(id),
  total_amount numeric not null default 0,
  cost_amount numeric not null default 0,
  profit numeric not null default 0,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  qty numeric not null default 0,
  sell_price numeric not null default 0,
  cost_price numeric not null default 0
);

create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references public.orders(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  amount numeric not null default 0,
  payment_date date not null default (now()::date),
  method text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 3) Green coffee types + inbound lots
create table if not exists public.green_types (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- seed your 4 default types (safe re-run)
insert into public.green_types (name) values
  ('Robusta S18'),
  ('Culi Robusta S18'),
  ('Robusta Honey S18'),
  ('Arabica S18')
on conflict (name) do nothing;

create table if not exists public.green_inbounds (
  id uuid primary key default uuid_generate_v4(),
  inbound_at timestamptz not null default now(),
  lot_code text not null unique,
  green_type_id uuid not null references public.green_types(id),
  qty_kg numeric not null check (qty_kg > 0),
  unit_cost numeric not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create or replace view public.v_green_inbounds as
select
  gi.id,
  gi.inbound_at,
  gi.lot_code,
  gi.green_type_id,
  gt.name as green_type_name,
  gi.qty_kg,
  gi.unit_cost,
  gi.created_at
from public.green_inbounds gi
join public.green_types gt on gt.id = gi.green_type_id;

-- 4) CRM Leads
create table if not exists public.leads (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text,
  stage text not null default 'lead',
  owner_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 5) SFA Check-ins
create table if not exists public.checkins (
  id uuid primary key default uuid_generate_v4(),
  checkin_at timestamptz not null default now(),
  lat double precision not null,
  lng double precision not null,
  place_name text,
  note text,
  owner_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 6) Commission (MVP)
-- Admin sets commission rate per user (sales/ctv). When payment is inserted (status success), you can add rows here.
create table if not exists public.commission_rules (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  rate_pct numeric not null default 0, -- e.g. 3 = 3%
  created_at timestamptz not null default now(),
  unique(user_id)
);

create table if not exists public.commissions (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  beneficiary_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric not null default 0,
  status text not null default 'pending', -- pending/earned/reversed
  reason text not null default 'payment',
  created_at timestamptz not null default now()
);

create or replace view public.v_commissions_my as
select * from public.commissions where beneficiary_id = auth.uid();

-- 7) RLS
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.green_types enable row level security;
alter table public.green_inbounds enable row level security;
alter table public.leads enable row level security;
alter table public.checkins enable row level security;
alter table public.commission_rules enable row level security;
alter table public.commissions enable row level security;

-- Helper: is admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

-- profiles: read own; admin can read all; admin can update all
drop policy if exists "profiles_read_own" on public.profiles;
create policy "profiles_read_own" on public.profiles for select
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles for update
using (public.is_admin())
with check (public.is_admin());

-- products: all authenticated can read; only admin/roastery_manager/warehouse can write
drop policy if exists "products_read" on public.products;
create policy "products_read" on public.products for select
using (auth.role() = 'authenticated');

drop policy if exists "products_write" on public.products;
create policy "products_write" on public.products for all
using (
  public.is_admin() or exists(
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('roastery_manager','warehouse')
  )
)
with check (
  public.is_admin() or exists(
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('roastery_manager','warehouse')
  )
);

-- customers: sales sees own; admin sees all
drop policy if exists "customers_read" on public.customers;
create policy "customers_read" on public.customers for select
using (public.is_admin() or owner_id = auth.uid());

drop policy if exists "customers_write" on public.customers;
create policy "customers_write" on public.customers for all
using (public.is_admin() or owner_id = auth.uid())
with check (public.is_admin() or owner_id = auth.uid());

-- leads: sales sees own; admin sees all
drop policy if exists "leads_read" on public.leads;
create policy "leads_read" on public.leads for select
using (public.is_admin() or owner_id = auth.uid());

drop policy if exists "leads_write" on public.leads;
create policy "leads_write" on public.leads for all
using (public.is_admin() or owner_id = auth.uid())
with check (public.is_admin() or owner_id = auth.uid());

-- checkins: sales/ctv sees own; admin sees all
drop policy if exists "checkins_read" on public.checkins;
create policy "checkins_read" on public.checkins for select
using (public.is_admin() or owner_id = auth.uid());

drop policy if exists "checkins_write" on public.checkins;
create policy "checkins_write" on public.checkins for insert
with check (owner_id = auth.uid() or public.is_admin());

-- green types/inbounds: warehouse/roastery_manager/admin
drop policy if exists "green_types_read" on public.green_types;
create policy "green_types_read" on public.green_types for select
using (auth.role() = 'authenticated');

drop policy if exists "green_types_write" on public.green_types;
create policy "green_types_write" on public.green_types for all
using (
  public.is_admin() or exists(
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('roastery_manager','warehouse')
  )
)
with check (
  public.is_admin() or exists(
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('roastery_manager','warehouse')
  )
);

drop policy if exists "green_inbounds_read" on public.green_inbounds;
create policy "green_inbounds_read" on public.green_inbounds for select
using (
  public.is_admin() or exists(
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('roastery_manager','warehouse')
  )
);

drop policy if exists "green_inbounds_write" on public.green_inbounds;
create policy "green_inbounds_write" on public.green_inbounds for insert
with check (
  public.is_admin() or exists(
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('roastery_manager','warehouse')
  )
);

-- orders/order_items/payments: sales sees own; admin sees all (MVP)
drop policy if exists "orders_read" on public.orders;
create policy "orders_read" on public.orders for select
using (public.is_admin() or owner_id = auth.uid());

drop policy if exists "orders_write" on public.orders;
create policy "orders_write" on public.orders for all
using (public.is_admin() or owner_id = auth.uid())
with check (public.is_admin() or owner_id = auth.uid());

drop policy if exists "order_items_rw" on public.order_items;
create policy "order_items_rw" on public.order_items for all
using (
  public.is_admin() or exists(select 1 from public.orders o where o.id = order_id and o.owner_id = auth.uid())
)
with check (
  public.is_admin() or exists(select 1 from public.orders o where o.id = order_id and o.owner_id = auth.uid())
);

drop policy if exists "payments_rw" on public.payments;
create policy "payments_rw" on public.payments for all
using (public.is_admin() or created_by = auth.uid())
with check (public.is_admin() or created_by = auth.uid());

-- commissions: beneficiary sees own; admin sees all
drop policy if exists "commissions_read" on public.commissions;
create policy "commissions_read" on public.commissions for select
using (public.is_admin() or beneficiary_id = auth.uid());

drop policy if exists "commissions_write_admin" on public.commissions;
create policy "commissions_write_admin" on public.commissions for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "commission_rules_read" on public.commission_rules;
create policy "commission_rules_read" on public.commission_rules for select
using (public.is_admin() or user_id = auth.uid());

drop policy if exists "commission_rules_write_admin" on public.commission_rules;
create policy "commission_rules_write_admin" on public.commission_rules for all
using (public.is_admin())
with check (public.is_admin());

-- 8) Notes
--  - Role suggestions:
--    admin, roastery_manager, warehouse, sales, collaborator
--  - For roastery_manager: set can_view_profit = false by default, admin can toggle.
