-- =============================================================
-- Migration 0005: CRM + SFA schema
-- Run in Supabase Dashboard → SQL Editor
-- =============================================================

-- 1) customers: CRM fields
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS latitude  numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS next_follow_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS crm_status text DEFAULT 'active'; -- active | inactive | prospect

-- 2) orders: ownership for permission filtering
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3) customer_notes
CREATE TABLE IF NOT EXISTS customer_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  content      text NOT NULL,
  created_by   uuid NOT NULL REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "auth_all" ON customer_notes
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) sales_visits (SFA)
CREATE TABLE IF NOT EXISTS sales_visits (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id),
  check_in_time  timestamptz NOT NULL DEFAULT now(),
  check_in_lat   numeric,
  check_in_lng   numeric,
  note           text,
  status         text NOT NULL DEFAULT 'visited', -- visited | no_answer | follow_up
  created_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sales_visits ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "auth_all" ON sales_visits
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5) Index helpers
CREATE INDEX IF NOT EXISTS idx_customers_assigned_user  ON customers(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_owner_user        ON orders(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_customer  ON customer_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_created_by ON customer_notes(created_by);
CREATE INDEX IF NOT EXISTS idx_sales_visits_customer    ON sales_visits(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_visits_user        ON sales_visits(user_id);
