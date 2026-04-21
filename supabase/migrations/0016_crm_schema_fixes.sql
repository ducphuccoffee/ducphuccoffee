-- Migration 0016: CRM schema critical fixes (patch only, no recreate)

----------------------------------------------------------------------
-- 1. crm_activities: add owner_user_id
----------------------------------------------------------------------
ALTER TABLE public.crm_activities
  ADD COLUMN IF NOT EXISTS owner_user_id uuid;

-- Backfill: set owner = created_by where null
UPDATE public.crm_activities SET owner_user_id = created_by WHERE owner_user_id IS NULL;

----------------------------------------------------------------------
-- 2. sfa_visits: add created_by
----------------------------------------------------------------------
ALTER TABLE public.sfa_visits
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- Backfill: set created_by = owner_user_id where null
UPDATE public.sfa_visits SET created_by = owner_user_id WHERE created_by IS NULL;

----------------------------------------------------------------------
-- 3. orders: enforce owner_user_id NOT NULL
----------------------------------------------------------------------
-- Backfill: set owner = created_by for orders missing owner
UPDATE public.orders SET owner_user_id = created_by WHERE owner_user_id IS NULL;

-- Now safe to enforce
ALTER TABLE public.orders ALTER COLUMN owner_user_id SET NOT NULL;

----------------------------------------------------------------------
-- 4. tasks.type: DO NOT create enum
-- tasks.type is text and already used for production workflow:
--   confirm_order, prepare_order, deliver_order, close_order, production
-- CRM adds: crm_followup, visit, quotation_followup, debt_followup
-- Using text with CHECK would break existing rows.
-- Keep as text — application validates allowed values per context.
----------------------------------------------------------------------

----------------------------------------------------------------------
-- 5. INDEXES (idempotent)
----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tasks_owner       ON public.tasks(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_customer     ON public.tasks(customer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_lead         ON public.tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_leads_owner        ON public.leads(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_opp_owner          ON public.opportunities(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_sfa_visits_owner   ON public.sfa_visits(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_crm_act_owner      ON public.crm_activities(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_owner       ON public.orders(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer    ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_opportunity ON public.orders(opportunity_id);
