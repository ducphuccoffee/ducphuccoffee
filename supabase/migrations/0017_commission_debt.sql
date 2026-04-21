-- Migration 0017: Commission + Debt system enhancements

----------------------------------------------------------------------
-- 1. Commissions: add status + type tracking
----------------------------------------------------------------------
ALTER TABLE public.commissions
  ADD COLUMN IF NOT EXISTS status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid')),
  ADD COLUMN IF NOT EXISTS commission_type text,
  ADD COLUMN IF NOT EXISTS created_by      uuid;

CREATE INDEX IF NOT EXISTS idx_commissions_order ON public.commissions(order_id);
CREATE INDEX IF NOT EXISTS idx_commissions_user  ON public.commissions(beneficiary_user_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON public.commissions(status);

----------------------------------------------------------------------
-- 2. Commission_rules: add product-type based rules
----------------------------------------------------------------------
ALTER TABLE public.commission_rules
  ADD COLUMN IF NOT EXISTS id              uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS commission_type text,
  ADD COLUMN IF NOT EXISTS fixed_amount    numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active       boolean DEFAULT true;

-- Seed default rules if none exist
INSERT INTO public.commission_rules (org_id, commission_type, fixed_amount, collaborator_rate_per_kg, is_active)
SELECT '00000000-0000-0000-0000-000000000001', 'machine_sale', 1000000, 0, true
WHERE NOT EXISTS (SELECT 1 FROM public.commission_rules WHERE commission_type = 'machine_sale');

INSERT INTO public.commission_rules (org_id, commission_type, fixed_amount, collaborator_rate_per_kg, is_active)
SELECT '00000000-0000-0000-0000-000000000001', 'rental', 500000, 0, true
WHERE NOT EXISTS (SELECT 1 FROM public.commission_rules WHERE commission_type = 'rental');

INSERT INTO public.commission_rules (org_id, commission_type, fixed_amount, collaborator_rate_per_kg, is_active)
SELECT '00000000-0000-0000-0000-000000000001', 'coffee', 0, 50000, true
WHERE NOT EXISTS (SELECT 1 FROM public.commission_rules WHERE commission_type = 'coffee');

----------------------------------------------------------------------
-- 3. Payments: add method + note
----------------------------------------------------------------------
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS method  text DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS note    text;

CREATE INDEX IF NOT EXISTS idx_payments_order  ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

----------------------------------------------------------------------
-- 4. Orders: add opportunity_id index (already has column)
----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_opportunity ON public.orders(opportunity_id);

----------------------------------------------------------------------
-- 5. View: customer debt summary
----------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_customer_debt AS
SELECT
  o.org_id,
  o.customer_id,
  c.name AS customer_name,
  c.phone AS customer_phone,
  c.owner_user_id,
  SUM(o.total_amount) AS total_ordered,
  COALESCE(p.total_paid, 0) AS total_paid,
  SUM(o.total_amount) - COALESCE(p.total_paid, 0) AS debt_amount,
  COUNT(o.id) AS order_count,
  MAX(o.created_at) AS last_order_at
FROM public.orders o
JOIN public.customers c ON c.id = o.customer_id
LEFT JOIN (
  SELECT order_id, SUM(amount) AS total_paid
  FROM public.payments
  WHERE status = 'confirmed'
  GROUP BY order_id
) p ON p.order_id = o.id
WHERE o.status IN ('accepted', 'delivered', 'completed')
GROUP BY o.org_id, o.customer_id, c.name, c.phone, c.owner_user_id, p.total_paid
HAVING SUM(o.total_amount) - COALESCE(p.total_paid, 0) > 0;

----------------------------------------------------------------------
-- 6. View: sales KPI per user
----------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_sales_kpi AS
SELECT
  o.org_id,
  o.owner_user_id,
  COUNT(DISTINCT o.id) AS total_orders,
  SUM(o.total_amount) AS total_revenue,
  COALESCE(cm.total_commission, 0) AS total_commission,
  COALESCE(ld.total_leads, 0) AS total_leads,
  COALESCE(ld.converted_leads, 0) AS converted_leads,
  CASE WHEN COALESCE(ld.total_leads, 0) > 0
    THEN ROUND(COALESCE(ld.converted_leads, 0)::numeric / ld.total_leads * 100, 1)
    ELSE 0
  END AS conversion_rate
FROM public.orders o
LEFT JOIN (
  SELECT beneficiary_user_id, SUM(amount) AS total_commission
  FROM public.commissions
  GROUP BY beneficiary_user_id
) cm ON cm.beneficiary_user_id = o.owner_user_id
LEFT JOIN (
  SELECT owner_user_id,
    COUNT(*) AS total_leads,
    COUNT(*) FILTER (WHERE status = 'converted') AS converted_leads
  FROM public.leads
  GROUP BY owner_user_id
) ld ON ld.owner_user_id = o.owner_user_id
WHERE o.status IN ('accepted', 'delivered', 'completed')
GROUP BY o.org_id, o.owner_user_id, cm.total_commission, ld.total_leads, ld.converted_leads;
