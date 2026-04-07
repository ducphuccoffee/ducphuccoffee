-- ============================================================
-- PHASE 1: roast_batches schema
-- Chạy toàn bộ file này trong Supabase SQL Editor → Run
-- ============================================================

-- 1) Bảng chính
create table if not exists public.roast_batches (
  id               uuid        primary key default uuid_generate_v4(),
  batch_code       text        not null unique,
  roast_date       date        not null default current_date,
  status           text        not null default 'draft'
                               check (status in ('draft','completed','cancelled')),

  -- Lô nguyên liệu (link về green_inbounds nếu có)
  green_inbound_id uuid        references public.green_inbounds(id) on delete set null,
  green_type_id    uuid        references public.green_types(id)    on delete set null,
  green_type_name  text,       -- denorm để query nhanh
  lot_code         text,       -- denorm từ green_inbounds.lot_code

  -- Số liệu rang
  input_kg         numeric     not null check (input_kg > 0),
  output_kg        numeric     not null check (output_kg > 0),
  loss_kg          numeric     generated always as (input_kg - output_kg) stored,
  loss_pct         numeric     generated always as (
                     round(((input_kg - output_kg) / input_kg * 100)::numeric, 2)
                   ) stored,

  -- Giá vốn
  unit_cost_green  numeric     not null default 0,
  total_cost       numeric     generated always as (input_kg * unit_cost_green) stored,
  cost_per_kg      numeric     generated always as (
                     round((input_kg * unit_cost_green / output_kg)::numeric, 0)
                   ) stored,

  note             text,
  created_by       uuid        references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- 2) Constraint thêm
alter table public.roast_batches
  drop constraint if exists chk_output_lte_input;
alter table public.roast_batches
  add constraint chk_output_lte_input check (output_kg <= input_kg);

-- 3) Index
create index if not exists idx_roast_batches_date
  on public.roast_batches (roast_date desc);

create index if not exists idx_roast_batches_status
  on public.roast_batches (status);

create index if not exists idx_roast_batches_inbound
  on public.roast_batches (green_inbound_id);

-- 4) Auto updated_at
create or replace function public.fn_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists t_roast_batches_updated_at on public.roast_batches;
create trigger t_roast_batches_updated_at
  before update on public.roast_batches
  for each row execute function public.fn_set_updated_at();

-- 5) RLS
alter table public.roast_batches enable row level security;

do $$ begin
  create policy "auth_all" on public.roast_batches
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null;
end $$;

-- 6) View: tồn nhân xanh theo lô (FIFO)
create or replace view public.v_green_stock as
select
  gi.id              as green_inbound_id,
  gi.inbound_at,
  gi.lot_code,
  gi.green_type_id,
  gt.name            as green_type_name,
  gi.qty_kg          as original_qty_kg,
  gi.unit_cost,
  coalesce(u.used_kg, 0)                    as used_kg,
  gi.qty_kg - coalesce(u.used_kg, 0)        as remaining_kg
from public.green_inbounds gi
join public.green_types gt on gt.id = gi.green_type_id
left join (
  select green_inbound_id, sum(input_kg) as used_kg
  from public.roast_batches
  where status != 'cancelled'
  group by green_inbound_id
) u on u.green_inbound_id = gi.id
order by gi.inbound_at asc;  -- FIFO: nhập trước lên trên
