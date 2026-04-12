-- ============================================================
-- One-time fix: assign owner_id to the 10 demo orders
-- so RLS (orders_read policy) lets the logged-in user see them.
--
-- Run in: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- Step 1: check which profile will be assigned
SELECT id, full_name, role, created_at
FROM public.profiles
ORDER BY created_at ASC
LIMIT 5;

-- Step 2: run the fix (assigns to the earliest-created profile = your admin account)
UPDATE public.orders
SET owner_id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1)
WHERE id LIKE 'aaaa%'
  AND owner_id IS NULL;

-- Step 3: verify — all 10 demo orders should now have a non-null owner_id
SELECT order_code, customer_name, status, total_amount, created_at::date, owner_id
FROM public.orders
WHERE id LIKE 'aaaa%'
ORDER BY created_at;
