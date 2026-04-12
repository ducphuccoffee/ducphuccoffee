-- ============================================================
-- SEED: 15 demo orders cho public.orders
-- Chạy 1 lần trong Supabase Dashboard → SQL Editor → Run
-- created_by / delivered_by lấy từ profiles thật
-- customer_id lấy từ customers thật (nếu có), fallback = profile id
-- org_id = NULL (thay bằng real uuid nếu bảng của bạn NOT NULL)
-- ============================================================

WITH
  _user AS (
    -- Lấy user đầu tiên trong profiles (user thật)
    SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1
  ),
  _cust AS (
    -- Lấy customer đầu tiên (nếu bảng customers tồn tại)
    -- Nếu không có bảng customers → thay bằng: SELECT id FROM public.profiles LIMIT 1
    SELECT id FROM public.customers ORDER BY created_at ASC LIMIT 1
  )
INSERT INTO public.orders
  (id, org_id, customer_id, status, total_qty_kg, total_amount, delivered_by, created_by, created_at)
SELECT
  gen_random_uuid(),
  NULL,                       -- org_id: thay bằng real uuid nếu cần
  (SELECT id FROM _cust),
  v.status::order_status,
  v.qty_kg,
  v.amount,
  (SELECT id FROM _user),     -- delivered_by
  (SELECT id FROM _user),     -- created_by
  v.ts
FROM (VALUES
  -- Tháng -6 (Oct 2025)
  ('delivered',  8.5,   720000,  NOW() - INTERVAL '175 days'),
  ('delivered',  15.0,  1350000, NOW() - INTERVAL '168 days'),
  -- Tháng -5 (Nov 2025)
  ('delivered',  10.0,  900000,  NOW() - INTERVAL '148 days'),
  ('closed',     22.5,  2800000, NOW() - INTERVAL '140 days'),
  ('delivered',  6.0,   540000,  NOW() - INTERVAL '133 days'),
  -- Tháng -4 (Dec 2025)
  ('delivered',  18.0,  1620000, NOW() - INTERVAL '112 days'),
  ('delivered',  12.0,  1080000, NOW() - INTERVAL '105 days'),
  ('confirmed',  30.0,  2700000, NOW() - INTERVAL '98 days'),
  -- Tháng -3 (Jan 2026)
  ('delivered',  9.5,   855000,  NOW() - INTERVAL '77 days'),
  ('closed',     25.0,  2500000, NOW() - INTERVAL '70 days'),
  ('delivered',  7.0,   630000,  NOW() - INTERVAL '63 days'),
  -- Tháng -2 (Feb 2026)
  ('delivered',  14.0,  1260000, NOW() - INTERVAL '49 days'),
  ('delivered',  20.0,  1980000, NOW() - INTERVAL '42 days'),
  -- Tháng -1 (Mar 2026)
  ('delivered',  11.0,  990000,  NOW() - INTERVAL '21 days'),
  ('confirmed',  16.5,  1485000, NOW() - INTERVAL '14 days'),
  -- Tuần này
  ('draft',      8.0,   720000,  NOW() - INTERVAL '3 days')
) AS v(status, qty_kg, amount, ts);

-- ── Verify ────────────────────────────────────────────────────
SELECT COUNT(*) AS total_inserted FROM public.orders;

SELECT
  id,
  status,
  total_qty_kg,
  total_amount,
  created_at::date AS order_date
FROM public.orders
ORDER BY created_at DESC
LIMIT 20;
