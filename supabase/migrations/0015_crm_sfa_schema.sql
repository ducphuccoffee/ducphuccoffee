-- Migration 0015: CRM + SFA unified schema
-- Creates leads, opportunities, crm_activities, sfa_visits
-- Alters existing tables to add CRM links
-- Safe to re-run (IF NOT EXISTS / DO $$ blocks)

----------------------------------------------------------------------
-- SECTION 1: ALTER EXISTING TABLES
----------------------------------------------------------------------

-- 1a) orders: add opportunity_id
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS opportunity_id uuid;

-- 1b) tasks: add CRM link columns
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS customer_id     uuid,
  ADD COLUMN IF NOT EXISTS lead_id         uuid,
  ADD COLUMN IF NOT EXISTS opportunity_id  uuid,
  ADD COLUMN IF NOT EXISTS owner_user_id   uuid,
  ADD COLUMN IF NOT EXISTS description     text;

----------------------------------------------------------------------
-- SECTION 2: CREATE NEW TABLES
----------------------------------------------------------------------

-- 2a) leads
CREATE TABLE IF NOT EXISTS public.leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  name            text NOT NULL,
  phone           text,
  address         text,
  area            text,
  source          text,
  demand          text,
  temperature     text NOT NULL DEFAULT 'cold'
                    CHECK (temperature IN ('cold','warm','hot')),
  status          text NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new','contacted','meeting_scheduled','quoted','converted','lost')),
  owner_user_id   uuid NOT NULL,
  converted_customer_id uuid,
  created_by      uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_org ON public.leads(org_id);
CREATE INDEX IF NOT EXISTS idx_leads_owner ON public.leads(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);

-- 2b) opportunities
CREATE TABLE IF NOT EXISTS public.opportunities (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL,
  lead_id             uuid,
  customer_id         uuid,
  title               text NOT NULL,
  expected_value      numeric DEFAULT 0,
  probability         numeric DEFAULT 50,
  stage               text NOT NULL DEFAULT 'new'
                        CHECK (stage IN ('new','consulting','demo','quoted','negotiating','won','lost')),
  owner_user_id       uuid NOT NULL,
  expected_close_date date,
  created_by          uuid NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opp_org ON public.opportunities(org_id);
CREATE INDEX IF NOT EXISTS idx_opp_owner ON public.opportunities(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_opp_stage ON public.opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_opp_lead ON public.opportunities(lead_id);
CREATE INDEX IF NOT EXISTS idx_opp_customer ON public.opportunities(customer_id);

-- 2c) crm_activities
CREATE TABLE IF NOT EXISTS public.crm_activities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  lead_id         uuid,
  customer_id     uuid,
  opportunity_id  uuid,
  type            text NOT NULL
                    CHECK (type IN ('call','message','meeting','visit','quotation','note')),
  content         text,
  created_by      uuid NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_act_org ON public.crm_activities(org_id);
CREATE INDEX IF NOT EXISTS idx_crm_act_lead ON public.crm_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_act_customer ON public.crm_activities(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_act_opp ON public.crm_activities(opportunity_id);

-- 2d) sfa_visits
CREATE TABLE IF NOT EXISTS public.sfa_visits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  lead_id         uuid,
  customer_id     uuid,
  owner_user_id   uuid NOT NULL,
  checkin_at      timestamptz NOT NULL DEFAULT now(),
  checkout_at     timestamptz,
  checkin_lat     numeric,
  checkin_lng     numeric,
  result          text
                    CHECK (result IS NULL OR result IN (
                      'no_answer','met_owner','sampled','quoted','followup_needed','won','lost'
                    )),
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sfa_visits_org ON public.sfa_visits(org_id);
CREATE INDEX IF NOT EXISTS idx_sfa_visits_owner ON public.sfa_visits(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_sfa_visits_customer ON public.sfa_visits(customer_id);
CREATE INDEX IF NOT EXISTS idx_sfa_visits_lead ON public.sfa_visits(lead_id);

----------------------------------------------------------------------
-- SECTION 3: FOREIGN KEY CONSTRAINTS (idempotent)
----------------------------------------------------------------------

-- leads
DO $$ BEGIN
  ALTER TABLE public.leads ADD CONSTRAINT leads_converted_customer_fk
    FOREIGN KEY (converted_customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- opportunities → leads
DO $$ BEGIN
  ALTER TABLE public.opportunities ADD CONSTRAINT opp_lead_fk
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- opportunities → customers
DO $$ BEGIN
  ALTER TABLE public.opportunities ADD CONSTRAINT opp_customer_fk
    FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- crm_activities → leads
DO $$ BEGIN
  ALTER TABLE public.crm_activities ADD CONSTRAINT crm_act_lead_fk
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- crm_activities → customers
DO $$ BEGIN
  ALTER TABLE public.crm_activities ADD CONSTRAINT crm_act_customer_fk
    FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- crm_activities → opportunities
DO $$ BEGIN
  ALTER TABLE public.crm_activities ADD CONSTRAINT crm_act_opp_fk
    FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- sfa_visits → leads
DO $$ BEGIN
  ALTER TABLE public.sfa_visits ADD CONSTRAINT sfa_visit_lead_fk
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- sfa_visits → customers
DO $$ BEGIN
  ALTER TABLE public.sfa_visits ADD CONSTRAINT sfa_visit_customer_fk
    FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- orders → opportunities
DO $$ BEGIN
  ALTER TABLE public.orders ADD CONSTRAINT orders_opportunity_fk
    FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- tasks → leads
DO $$ BEGIN
  ALTER TABLE public.tasks ADD CONSTRAINT tasks_lead_fk
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- tasks → customers
DO $$ BEGIN
  ALTER TABLE public.tasks ADD CONSTRAINT tasks_customer_fk
    FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- tasks → opportunities
DO $$ BEGIN
  ALTER TABLE public.tasks ADD CONSTRAINT tasks_opportunity_fk
    FOREIGN KEY (opportunity_id) REFERENCES public.opportunities(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

----------------------------------------------------------------------
-- SECTION 4: RLS POLICIES
----------------------------------------------------------------------

-- leads
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "leads_all" ON public.leads FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- opportunities
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "opportunities_all" ON public.opportunities FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- crm_activities
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "crm_activities_all" ON public.crm_activities FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- sfa_visits
ALTER TABLE public.sfa_visits ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "sfa_visits_all" ON public.sfa_visits FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
