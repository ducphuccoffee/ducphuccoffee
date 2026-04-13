-- ============================================================
-- Migration 0008: Complete Orders Schema Fix
-- Combines 0004 + 0007 changes into one safe-to-run script
-- Run in Supabase Dashboard → SQL Editor
-- Safe to re-run (all IF NOT EXISTS)
-- ============================================================

-- ── Bước 1: Thêm cột còn thiếu vào orders ───────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS note            text,
  ADD COLUMN IF NOT EXISTS order_code      text,
  ADD COLUMN IF NOT EXISTS customer_name   text,
  ADD COLUMN IF NOT EXISTS customer_phone  text,
  ADD COLUMN IF NOT EXISTS ordered_at      timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS payment_status  text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_method  text NOT NULL DEFAULT 'cash';

-- ── Bước 2: Thêm cột còn thiếu vào order_items ──────────────
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS unit         text NOT NULL DEFAULT 'kg',
  ADD COLUMN IF NOT EXISTS unit_price   numeric NOT NULL DEFAULT 0;

-- Thêm subtotal nếu chưa có (GENERATED ALWAYS AS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'subtotal'
  ) THEN
    ALTER TABLE public.order_items
      ADD COLUMN subtotal numeric GENERATED ALWAYS AS (qty * unit_price) STORED;
  END IF;
END $$;

-- ── Bước 3: Backfill order_code từ id ───────────────────────
UPDATE public.orders
SET order_code = '#' || UPPER(SUBSTRING(id::text, 1, 8))
WHERE order_code IS NULL OR order_code = '';

-- ── Bước 4: Migrate status cũ → mới ────────────────────────
-- draft      → new        (chờ tiếp nhận)
-- confirmed  → accepted   (đã tiếp nhận)
-- delivered  → delivered  (giữ nguyên)
-- closed     → completed  (hoàn thành)
UPDATE public.orders SET status = 'new'       WHERE status = 'draft';
UPDATE public.orders SET status = 'accepted'  WHERE status = 'confirmed';
UPDATE public.orders SET status = 'completed' WHERE status = 'closed';

-- ── Bước 5: Unique constraint cho order_code ────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'orders'
      AND constraint_name = 'orders_order_code_key'
  ) THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_order_code_key UNIQUE (order_code);
  END IF;
END $$;

-- ── Bước 6: Drop và thêm lại constraint status ──────────────
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check CHECK (
    status IN (
      'new', 'accepted', 'preparing', 'ready_to_ship',
      'shipping', 'delivered', 'completed', 'cancelled', 'failed'
    )
  );

-- ── Bước 7: Constraint payment_status và payment_method ─────
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_status_check CHECK (
    payment_status IN ('unpaid', 'partial_paid', 'paid', 'debt')
  );

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_method_check CHECK (
    payment_method IN ('cash', 'bank_transfer', 'debt')
  );

-- ── Bước 8: Indexes ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_status          ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status  ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_org_status      ON public.orders(org_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_customer        ON public.orders(customer_id);

-- ── Bước 9: Verify ──────────────────────────────────────────
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'orders'
ORDER BY ordinal_position;
