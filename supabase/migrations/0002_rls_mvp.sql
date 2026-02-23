-- MVP RLS + policy: authenticated can read/write all core tables
-- Run in Supabase Dashboard -> SQL Editor

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

do $$
begin
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
