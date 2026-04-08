-- Migration: orders + order_items thêm cột mới cho Orders module MVP
-- Chạy trong Supabase Dashboard → SQL Editor

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS ordered_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS note text;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS product_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'kg',
  ADD COLUMN IF NOT EXISTS unit_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal numeric GENERATED ALWAYS AS (qty * unit_price) STORED;
