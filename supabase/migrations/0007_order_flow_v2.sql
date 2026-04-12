-- Migration 0007: Order Flow Chuẩn Hóa
-- Mục đích:
--   1. Thêm các cột còn thiếu vào orders: note, order_code, customer_name, customer_phone, ordered_at, payment_status, payment_method
--   2. Migrate status cũ -> status mới (draft->new, confirmed->accepted, delivered->delivered, closed->completed)
--   3. Thêm constraint check mới cho status
-- Safe to re-run (IF NOT EXISTS / DO $$ EXCEPTION handling)

-- ── Bước 1: Thêm cột còn thiếu ─────────────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS note            text,
  ADD COLUMN IF NOT EXISTS order_code      text,
  ADD COLUMN IF NOT EXISTS customer_name   text,
  ADD COLUMN IF NOT EXISTS customer_phone  text,
  ADD COLUMN IF NOT EXISTS ordered_at      timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS payment_status  text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_method  text NOT NULL DEFAULT 'cash';

-- ── Bước 2: Backfill order_code từ id ───────────────────────────────────────
UPDATE orders
SET order_code = '#' || UPPER(SUBSTRING(id::text, 1, 8))
WHERE order_code IS NULL OR order_code = '';

-- ── Bước 3: Migrate status cũ → mới ────────────────────────────────────────
-- draft      → new        (chưa được tiếp nhận chính thức)
-- confirmed  → accepted   (đã tiếp nhận)
-- delivered  → delivered  (giữ nguyên)
-- closed     → completed  (đã hoàn thành)
UPDATE orders SET status = 'new'       WHERE status = 'draft';
UPDATE orders SET status = 'accepted'  WHERE status = 'confirmed';
UPDATE orders SET status = 'completed' WHERE status = 'closed';

-- ── Bước 4: Drop constraint cũ nếu có, thêm constraint mới ─────────────────
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_status_check CHECK (
    status IN (
      'new', 'accepted', 'preparing', 'ready_to_ship',
      'shipping', 'delivered', 'completed', 'cancelled', 'failed'
    )
  );

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_payment_status_check CHECK (
    payment_status IN ('unpaid', 'partial_paid', 'paid', 'debt')
  );

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_payment_method_check CHECK (
    payment_method IN ('cash', 'bank_transfer', 'debt')
  );

-- ── Bước 5: Indexes ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_status          ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status  ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_org_status      ON orders(org_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_customer        ON orders(customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_code ON orders(order_code) WHERE order_code IS NOT NULL;
