-- Migration 0021: Stock alerts + audit log
-- Adds min_stock thresholds on products & items, default alert threshold in
-- orgs.settings, and locks down the existing audit_log table with RLS.

----------------------------------------------------------------------
-- 1. Per-product min_stock (sellable products: roasted bean SKUs etc.)
----------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS min_stock numeric;

----------------------------------------------------------------------
-- 2. Per-item min_stock (raw / green / packaging tracked in items)
----------------------------------------------------------------------
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS min_stock numeric;

----------------------------------------------------------------------
-- 3. Org-level default fallback (settings.stock.default_min_stock_kg)
----------------------------------------------------------------------
UPDATE public.orgs
SET settings = settings || jsonb_build_object(
  'stock', jsonb_build_object(
    'default_min_stock_kg',
      COALESCE((settings->'stock'->>'default_min_stock_kg')::numeric, 5)
  )
)
WHERE settings->'stock' IS NULL;

----------------------------------------------------------------------
-- 4. audit_log: enable RLS — admin/manager read inside their org only.
--    Inserts go through service-role from API routes, so no insert policy
--    is required (anon/authenticated cannot insert).
----------------------------------------------------------------------
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_select" ON public.audit_log;

CREATE POLICY "audit_log_select" ON public.audit_log FOR SELECT USING (
  public.is_admin()
  AND org_id IN (
    SELECT org_id FROM public.org_members
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE INDEX IF NOT EXISTS idx_audit_log_org_created
  ON public.audit_log (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity
  ON public.audit_log (entity_type, entity_id);
