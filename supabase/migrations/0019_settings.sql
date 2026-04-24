-- Migration 0019: Settings (org profile + CRM thresholds + KPI targets)
-- Safe to re-run.

----------------------------------------------------------------------
-- 1. orgs: profile columns + jsonb settings bag
----------------------------------------------------------------------
ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS address   text,
  ADD COLUMN IF NOT EXISTS tax_code  text,
  ADD COLUMN IF NOT EXISTS phone     text,
  ADD COLUMN IF NOT EXISTS email     text,
  ADD COLUMN IF NOT EXISTS logo_url  text,
  ADD COLUMN IF NOT EXISTS settings  jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Seed defaults for existing orgs (merge with whatever is already there).
UPDATE public.orgs
SET settings = jsonb_build_object(
  'crm', jsonb_build_object(
    'stale_lead_days',        COALESCE((settings->'crm'->>'stale_lead_days')::int,        7),
    'stuck_opp_days',         COALESCE((settings->'crm'->>'stuck_opp_days')::int,         5),
    'dormant_customer_days',  COALESCE((settings->'crm'->>'dormant_customer_days')::int, 60)
  ),
  'kpi', jsonb_build_object(
    'monthly_revenue_target', COALESCE((settings->'kpi'->>'monthly_revenue_target')::numeric, 0)
  )
) || COALESCE(settings, '{}'::jsonb);

----------------------------------------------------------------------
-- 2. user_targets: per-user monthly revenue targets
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_targets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_revenue  numeric NOT NULL DEFAULT 0,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid,
  UNIQUE (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_targets_org  ON public.user_targets(org_id);
CREATE INDEX IF NOT EXISTS idx_user_targets_user ON public.user_targets(user_id);

ALTER TABLE public.user_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_targets_select" ON public.user_targets;
DROP POLICY IF EXISTS "user_targets_write"  ON public.user_targets;

-- Anyone in the org can read (so sales can see their own target);
-- only admin/manager can write.
CREATE POLICY "user_targets_select" ON public.user_targets FOR SELECT USING (
  user_id = auth.uid() OR public.is_admin()
);
CREATE POLICY "user_targets_write" ON public.user_targets FOR ALL USING (
  public.is_admin()
) WITH CHECK (public.is_admin());

----------------------------------------------------------------------
-- 3. commission_rules: make sure RLS lets admins manage
----------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DROP POLICY IF EXISTS "commission_rules_select" ON public.commission_rules;
DROP POLICY IF EXISTS "commission_rules_write"  ON public.commission_rules;

DO $$ BEGIN
  CREATE POLICY "commission_rules_select" ON public.commission_rules FOR SELECT USING (true);
  CREATE POLICY "commission_rules_write"  ON public.commission_rules FOR ALL
    USING (public.is_admin()) WITH CHECK (public.is_admin());
EXCEPTION WHEN undefined_table THEN NULL; END $$;
