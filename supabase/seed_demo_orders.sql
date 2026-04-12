-- ============================================================
-- Demo seed: 10 realistic orders spread over last 6 months
-- Safe to re-run: uses ON CONFLICT DO NOTHING throughout.
-- Run in: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ── 1) Ensure demo products exist ───────────────────────────
-- Using stable UUIDs so order_items can reference them reliably.

insert into public.products (id, name, sku, kind, unit, price, is_active)
values
  ('11111111-0000-0000-0000-000000000001', 'Robusta Rang Medium (500g)',  'ROB-MED-500',  'original', 'túi',  85000,  true),
  ('11111111-0000-0000-0000-000000000002', 'Arabica Rang Light (250g)',   'ARA-LGT-250',  'original', 'túi',  120000, true),
  ('11111111-0000-0000-0000-000000000003', 'Culi Robusta Rang Dark (500g)','CUL-DRK-500', 'original', 'túi',  95000,  true),
  ('11111111-0000-0000-0000-000000000004', 'Blend Signature (1kg)',        'BLD-SIG-1KG',  'blend',    'túi',  210000, true),
  ('11111111-0000-0000-0000-000000000005', 'Arabica Honey Rang Light (250g)','ARA-HNY-250','original','túi',  135000, true)
on conflict (id) do nothing;

-- ── 2) Ensure demo customers exist ──────────────────────────

insert into public.customers (id, name, phone, address)
values
  ('22222222-0000-0000-0000-000000000001', 'Quán Cà Phê Sài Gòn',  '0901111111', '12 Nguyễn Huệ, Q.1, TP.HCM'),
  ('22222222-0000-0000-0000-000000000002', 'Trà Sữa Hồng Trà',     '0902222222', '45 Lê Lợi, Q.3, TP.HCM'),
  ('22222222-0000-0000-0000-000000000003', 'Cafe Phố Cổ',           '0903333333', '78 Đinh Tiên Hoàng, Bình Thạnh'),
  ('22222222-0000-0000-0000-000000000004', 'Nguyễn Minh Tuấn',      '0904444444', '90 Hoàng Văn Thụ, Phú Nhuận'),
  ('22222222-0000-0000-0000-000000000005', 'The Coffee Lab',         '0905555555', '33 Võ Văn Tần, Q.3, TP.HCM')
on conflict (id) do nothing;

-- ── 3) Insert 10 demo orders ─────────────────────────────────
-- Spread across Nov 2025 → Apr 2026.
-- total_amount already includes any tax (no separate column).

insert into public.orders
  (id, order_code, customer_name, customer_phone, status, total_amount, note, created_at)
values
  (
    'aaaa0001-0000-0000-0000-000000000001',
    'DP-20251105-A1B2',
    'Quán Cà Phê Sài Gòn', '0901111111',
    'delivered', 425000,
    'Giao buổi sáng',
    '2025-11-05 09:15:00+07'
  ),
  (
    'aaaa0002-0000-0000-0000-000000000002',
    'DP-20251118-C3D4',
    'Trà Sữa Hồng Trà', '0902222222',
    'delivered', 680000,
    null,
    '2025-11-18 14:30:00+07'
  ),
  (
    'aaaa0003-0000-0000-0000-000000000003',
    'DP-20251202-E5F6',
    'Cafe Phố Cổ', '0903333333',
    'delivered', 1050000,
    'Đơn định kỳ tháng 12',
    '2025-12-02 10:00:00+07'
  ),
  (
    'aaaa0004-0000-0000-0000-000000000004',
    'DP-20251220-G7H8',
    'Nguyễn Minh Tuấn', '0904444444',
    'delivered', 240000,
    null,
    '2025-12-20 16:45:00+07'
  ),
  (
    'aaaa0005-0000-0000-0000-000000000005',
    'DP-20260108-I9J0',
    'The Coffee Lab', '0905555555',
    'delivered', 1890000,
    'Lấy hàng số lượng lớn',
    '2026-01-08 11:20:00+07'
  ),
  (
    'aaaa0006-0000-0000-0000-000000000006',
    'DP-20260125-K1L2',
    'Quán Cà Phê Sài Gòn', '0901111111',
    'delivered', 510000,
    null,
    '2026-01-25 09:00:00+07'
  ),
  (
    'aaaa0007-0000-0000-0000-000000000007',
    'DP-20260214-M3N4',
    'Cafe Phố Cổ', '0903333333',
    'delivered', 735000,
    'Tặng kèm sample',
    '2026-02-14 13:10:00+07'
  ),
  (
    'aaaa0008-0000-0000-0000-000000000008',
    'DP-20260305-O5P6',
    'The Coffee Lab', '0905555555',
    'confirmed', 2310000,
    null,
    '2026-03-05 10:30:00+07'
  ),
  (
    'aaaa0009-0000-0000-0000-000000000009',
    'DP-20260322-Q7R8',
    'Trà Sữa Hồng Trà', '0902222222',
    'delivered', 405000,
    null,
    '2026-03-22 15:00:00+07'
  ),
  (
    'aaaa0010-0000-0000-0000-000000000010',
    'DP-20260410-S9T0',
    'Nguyễn Minh Tuấn', '0904444444',
    'pending', 630000,
    'Chờ xác nhận địa chỉ',
    '2026-04-10 08:45:00+07'
  )
on conflict (id) do nothing;

-- ── 4) Insert order_items for each order ─────────────────────
-- subtotal is a GENERATED column (qty * unit_price) — do NOT insert it.

insert into public.order_items
  (id, order_id, product_id, product_name, unit, qty, unit_price)
values
  -- Order 1: 5 túi Robusta 500g
  ('bbbb0001-0001-0000-0000-000000000001','aaaa0001-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','Robusta Rang Medium (500g)','túi',5,85000),
  -- Order 2: 2 Arabica + 4 Robusta
  ('bbbb0002-0001-0000-0000-000000000001','aaaa0002-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000002','Arabica Rang Light (250g)','túi',2,120000),
  ('bbbb0002-0002-0000-0000-000000000001','aaaa0002-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000001','Robusta Rang Medium (500g)','túi',4,85000),
  -- Order 3: 5 Blend Signature
  ('bbbb0003-0001-0000-0000-000000000001','aaaa0003-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000004','Blend Signature (1kg)','túi',5,210000),
  -- Order 4: 2 Culi Robusta
  ('bbbb0004-0001-0000-0000-000000000001','aaaa0004-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000003','Culi Robusta Rang Dark (500g)','túi',2,95000),
  -- Order 5: 6 Blend + 3 Arabica Honey
  ('bbbb0005-0001-0000-0000-000000000001','aaaa0005-0000-0000-0000-000000000005','11111111-0000-0000-0000-000000000004','Blend Signature (1kg)','túi',6,210000),
  ('bbbb0005-0002-0000-0000-000000000001','aaaa0005-0000-0000-0000-000000000005','11111111-0000-0000-0000-000000000005','Arabica Honey Rang Light (250g)','túi',3,135000),
  -- Order 6: 6 Robusta
  ('bbbb0006-0001-0000-0000-000000000001','aaaa0006-0000-0000-0000-000000000006','11111111-0000-0000-0000-000000000001','Robusta Rang Medium (500g)','túi',6,85000),
  -- Order 7: 3 Arabica + 3 Culi
  ('bbbb0007-0001-0000-0000-000000000001','aaaa0007-0000-0000-0000-000000000007','11111111-0000-0000-0000-000000000002','Arabica Rang Light (250g)','túi',3,120000),
  ('bbbb0007-0002-0000-0000-000000000001','aaaa0007-0000-0000-0000-000000000007','11111111-0000-0000-0000-000000000003','Culi Robusta Rang Dark (500g)','túi',3,95000),
  -- Order 8: 11 Blend Signature (large order)
  ('bbbb0008-0001-0000-0000-000000000001','aaaa0008-0000-0000-0000-000000000008','11111111-0000-0000-0000-000000000004','Blend Signature (1kg)','túi',11,210000),
  -- Order 9: 3 Arabica Honey
  ('bbbb0009-0001-0000-0000-000000000001','aaaa0009-0000-0000-0000-000000000009','11111111-0000-0000-0000-000000000005','Arabica Honey Rang Light (250g)','túi',3,135000),
  -- Order 10: 2 Arabica + 4 Robusta
  ('bbbb0010-0001-0000-0000-000000000001','aaaa0010-0000-0000-0000-000000000010','11111111-0000-0000-0000-000000000002','Arabica Rang Light (250g)','túi',2,120000),
  ('bbbb0010-0002-0000-0000-000000000001','aaaa0010-0000-0000-0000-000000000010','11111111-0000-0000-0000-000000000001','Robusta Rang Medium (500g)','túi',4,85000)
on conflict (id) do nothing;

-- ── 5) Assign owner_id so RLS lets the logged-in user see these rows ──
-- RLS policy: orders_read requires (is_admin() OR owner_id = auth.uid())
-- Seed runs as postgres (superuser) so auth.uid() = null at insert time.
-- This UPDATE assigns all demo orders to the first profile in the table,
-- which is the account that was used to set up the app.
-- If you have multiple users, replace the subquery with the exact UUID
-- from: SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1;

UPDATE public.orders
SET owner_id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1)
WHERE id LIKE 'aaaa%'
  AND owner_id IS NULL;

-- ── 6) Quick verification ─────────────────────────────────────
select
  o.order_code,
  o.customer_name,
  o.status,
  o.total_amount,
  o.created_at::date as order_date,
  o.owner_id,
  count(oi.id) as line_items
from public.orders o
left join public.order_items oi on oi.order_id = o.id
where o.id like 'aaaa%'
group by o.id, o.order_code, o.customer_name, o.status, o.total_amount, o.created_at, o.owner_id
order by o.created_at;
