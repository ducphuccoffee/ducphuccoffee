-- Roastery ERP (MVP) schema for Supabase Postgres
-- Run once in Supabase Dashboard -> SQL Editor

-- Extensions
create extension if not exists "pgcrypto";

-- Profiles (optional)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text default 'admin',
  created_at timestamptz not null default now()
);

-- Auto create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), 'admin')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Products (raw/finished)
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text unique,
  type text not null check (type in ('raw','finished')),
  unit text default 'kg',
  cost_price numeric,
  sell_price numeric,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Customers
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  credit_limit numeric default 0,
  created_at timestamptz not null default now()
);

-- Orders
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_code text unique,
  customer_id uuid references customers(id),
  total_amount numeric default 0,
  cost_amount numeric default 0,
  profit numeric default 0,
  status text default 'draft',
  created_at timestamptz not null default now()
);

-- Order items
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  qty numeric not null check (qty > 0),
  sell_price numeric not null default 0,
  cost_price numeric not null default 0
);

-- Payments
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  amount numeric not null default 0,
  payment_date date not null default current_date,
  method text,
  created_at timestamptz not null default now()
);

-- Expenses
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  amount numeric not null default 0,
  note text,
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- Roast batches
create table if not exists roast_batches (
  id uuid primary key default gen_random_uuid(),
  batch_code text unique,
  roast_date date not null default current_date,
  finished_product_id uuid references products(id),
  green_input_kg numeric default 0,
  roasted_output_kg numeric default 0,
  total_cost numeric default 0,
  cost_per_kg numeric,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- Batch material usage (links to products of type raw)
create table if not exists batch_material_usage (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references roast_batches(id) on delete cascade,
  raw_product_id uuid not null references products(id),
  qty_kg numeric not null default 0,
  cost numeric not null default 0
);

-- Inventory transactions
create table if not exists inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  type text not null check (type in ('IN','OUT','ADJUST')),
  qty numeric not null default 0,
  ref_type text,
  ref_id uuid,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_inventory_product on inventory_transactions(product_id);
create index if not exists idx_inventory_type on inventory_transactions(type);

-- Order adjustments (discount/return/cancel partial)
create table if not exists order_adjustments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  type text not null check (type in ('discount','return','cancel_partial','surcharge')),
  amount numeric not null default 0,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_order_adjustments_order on order_adjustments(order_id);

-- Views
create or replace view v_inventory_balance as
select
  product_id,
  sum(case when type='IN' then qty
           when type='OUT' then -qty
           else qty end) as qty_on_hand
from inventory_transactions
group by product_id;

create or replace view v_customer_debt as
with pay as (
  select customer_id, sum(amount) as paid
  from payments
  group by customer_id
),
adj as (
  select o.customer_id,
         sum(case when a.type in ('discount','return','cancel_partial') then a.amount else 0 end) as decrease,
         sum(case when a.type in ('surcharge') then a.amount else 0 end) as increase
  from orders o
  left join order_adjustments a on a.order_id=o.id
  group by o.customer_id
),
ord as (
  select customer_id, sum(total_amount) as total
  from orders
  group by customer_id
)
select
  c.id as customer_id,
  coalesce(ord.total,0) - coalesce(pay.paid,0) - coalesce(adj.decrease,0) + coalesce(adj.increase,0) as debt
from customers c
left join ord on ord.customer_id=c.id
left join pay on pay.customer_id=c.id
left join adj on adj.customer_id=c.id;

-- Trigger recalc order totals
create or replace function fn_recalc_order_total(_order_id uuid)
returns void language plpgsql as $$
begin
  update orders o
  set total_amount = (
    select coalesce(sum(qty * sell_price),0)
    from order_items
    where order_id = _order_id
  )
  where o.id = _order_id;
end; $$;

create or replace function trg_order_items_recalc()
returns trigger language plpgsql as $$
begin
  perform fn_recalc_order_total(coalesce(new.order_id, old.order_id));
  return null;
end; $$;

drop trigger if exists t_order_items_recalc on order_items;
create trigger t_order_items_recalc
after insert or update or delete on order_items
for each row execute function trg_order_items_recalc();

-- RLS (MVP: authenticated can read/write everything; tighten later)
alter table profiles enable row level security;
alter table products enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payments enable row level security;
alter table expenses enable row level security;
alter table roast_batches enable row level security;
alter table batch_material_usage enable row level security;
alter table inventory_transactions enable row level security;
alter table order_adjustments enable row level security;

do $$ begin
  create policy "auth_all" on profiles for all to authenticated using (true) with check (true);
  create policy "auth_all" on products for all to authenticated using (true) with check (true);
  create policy "auth_all" on customers for all to authenticated using (true) with check (true);
  create policy "auth_all" on orders for all to authenticated using (true) with check (true);
  create policy "auth_all" on order_items for all to authenticated using (true) with check (true);
  create policy "auth_all" on payments for all to authenticated using (true) with check (true);
  create policy "auth_all" on expenses for all to authenticated using (true) with check (true);
  create policy "auth_all" on roast_batches for all to authenticated using (true) with check (true);
  create policy "auth_all" on batch_material_usage for all to authenticated using (true) with check (true);
  create policy "auth_all" on inventory_transactions for all to authenticated using (true) with check (true);
  create policy "auth_all" on order_adjustments for all to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;
