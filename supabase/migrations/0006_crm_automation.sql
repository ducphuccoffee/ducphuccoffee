-- Migration 0006: CRM automation fields
-- Run in Supabase Dashboard → SQL Editor

-- customers: additional CRM fields for automation
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS last_contact_at   timestamptz,
  ADD COLUMN IF NOT EXISTS crm_segment       text DEFAULT 'lead',
  ADD COLUMN IF NOT EXISTS avg_order_days    numeric;
  -- crm_segment: lead | active | vip | inactive | at_risk

-- Update crm_segment based on existing data (backfill)
-- Will be maintained by app logic going forward
UPDATE customers SET crm_segment = 'lead' WHERE crm_segment IS NULL;

-- orders: add owner for permission filtering (safe, idempotent)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_customers_crm_segment    ON customers(crm_segment);
CREATE INDEX IF NOT EXISTS idx_customers_last_contact   ON customers(last_contact_at);
CREATE INDEX IF NOT EXISTS idx_customers_next_followup  ON customers(next_follow_up_at);
CREATE INDEX IF NOT EXISTS idx_sales_visits_checkin     ON sales_visits(check_in_time);

-- customer_notes: ensure profiles join works
-- (table created in 0005, this just adds index if missing)
CREATE INDEX IF NOT EXISTS idx_customer_notes_created   ON customer_notes(created_at DESC);
