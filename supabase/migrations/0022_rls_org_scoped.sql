-- ============================================================
-- Migration 0022: Org-scoped RLS hardening (Đợt 9)
-- ============================================================
-- PROBLEM with prior state:
--   * 0002 created permissive `auth_all` policies on customers, products,
--     orders, order_items, payments, etc. → any authenticated user can see
--     ALL orgs' data.
--   * 0018 added owner_user_id filters but used GLOBAL `is_admin()` —
--     admin in org A could see/edit data of org B.
--
-- THIS MIGRATION:
--   1. Drops every legacy permissive `auth_all` policy.
--   2. Replaces `is_admin()` with an org-scoped `is_admin_in_org(org_id)`.
--   3. Adds `current_user_org_id()` for the user's active org.
--   4. Sets new policies for every transactional + config table:
--      - SELECT/INSERT/UPDATE require org_id matches the user's active org.
--      - Sales-owned entities (leads/opps/visits) restrict SELECT/UPDATE
--        to owner_user_id (admin sees all in same org).
--      - DELETE restricted to org admins only.
--   5. service_role still bypasses RLS automatically (Supabase built-in).
-- ============================================================

-- ── 1) Helper functions ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.org_members
  WHERE user_id = auth.uid() AND is_active = true
  ORDER BY joined_at NULLS LAST
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_in_org(p_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_members om
    JOIN public.profiles p ON p.id = om.user_id
    WHERE om.user_id = auth.uid()
      AND om.org_id  = p_org
      AND om.is_active = true
      AND p.role IN ('admin','manager','roastery_manager')
  );
$$;

-- Keep is_admin() for backward compat — true if admin in user's active org.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_in_org(public.current_user_org_id());
$$;

-- ── 2) Drop all legacy permissive policies ──────────────────

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname IN (
        'auth_all','allow_all','public_all',
        'leads_select','leads_insert','leads_update','leads_delete','leads_all',
        'opp_select','opp_insert','opp_update','opp_delete','opportunities_all',
        'crm_act_select','crm_act_insert','crm_activities_all',
        'sfa_select','sfa_insert','sfa_update','sfa_visits_all',
        'tasks_select','tasks_insert','tasks_update','tasks_all',
        'orders_select','orders_insert','orders_update','orders_all',
        'commissions_select','commissions_insert','commissions_update','commissions_all',
        'payments_select','payments_insert','payments_all',
        'Users can view tasks in their org','Users can insert tasks in their org','Users can update tasks in their org',
        'Users can view orders in their org','Users can insert orders','Users can update orders'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                   r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ── 3) Enable RLS on all transactional + config tables ──────

ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sfa_visits       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roast_batches    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.green_inbounds   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_targets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log        ENABLE ROW LEVEL SECURITY;

-- Tables without org_id (use parent FK)
ALTER TABLE public.product_formulas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_recipe_lines  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_notes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_visits          ENABLE ROW LEVEL SECURITY;
-- green_types is shared global config — leave authenticated read

-- ── 4) PROFILES (per-user own row + same-org siblings readable) ──

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.org_members om
    WHERE om.user_id = profiles.id
      AND om.org_id = public.current_user_org_id()
      AND om.is_active = true
  )
);

CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE
USING (id = auth.uid() OR public.is_admin())
WITH CHECK (id = auth.uid() OR public.is_admin());

-- ── 5) ORGS + ORG_MEMBERS ──

DROP POLICY IF EXISTS "orgs_select" ON public.orgs;
CREATE POLICY "orgs_select" ON public.orgs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.org_members om
    WHERE om.org_id = orgs.id
      AND om.user_id = auth.uid()
      AND om.is_active = true
  )
);

DROP POLICY IF EXISTS "org_members_select" ON public.org_members;
CREATE POLICY "org_members_select" ON public.org_members FOR SELECT
USING (
  user_id = auth.uid()
  OR public.is_admin_in_org(org_id)
);

DROP POLICY IF EXISTS "org_members_modify" ON public.org_members;
CREATE POLICY "org_members_modify" ON public.org_members FOR ALL
USING (public.is_admin_in_org(org_id))
WITH CHECK (public.is_admin_in_org(org_id));

-- ── 6) Helper macro: org-scoped CRUD policies ──
-- Pattern used below for every org-scoped table.

-- CUSTOMERS
DROP POLICY IF EXISTS "customers_select" ON public.customers;
DROP POLICY IF EXISTS "customers_insert" ON public.customers;
DROP POLICY IF EXISTS "customers_update" ON public.customers;
DROP POLICY IF EXISTS "customers_delete" ON public.customers;
CREATE POLICY "customers_select" ON public.customers FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "customers_insert" ON public.customers FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "customers_update" ON public.customers FOR UPDATE USING (org_id = public.current_user_org_id()) WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "customers_delete" ON public.customers FOR DELETE USING (public.is_admin_in_org(org_id));

-- PRODUCTS
DROP POLICY IF EXISTS "products_select" ON public.products;
DROP POLICY IF EXISTS "products_insert" ON public.products;
DROP POLICY IF EXISTS "products_update" ON public.products;
DROP POLICY IF EXISTS "products_delete" ON public.products;
CREATE POLICY "products_select" ON public.products FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "products_insert" ON public.products FOR INSERT WITH CHECK (public.is_admin_in_org(org_id));
CREATE POLICY "products_update" ON public.products FOR UPDATE USING (public.is_admin_in_org(org_id)) WITH CHECK (public.is_admin_in_org(org_id));
CREATE POLICY "products_delete" ON public.products FOR DELETE USING (public.is_admin_in_org(org_id));

-- ORDERS (sales sees own; admin sees all in org)
DROP POLICY IF EXISTS "orders_select" ON public.orders;
DROP POLICY IF EXISTS "orders_insert" ON public.orders;
DROP POLICY IF EXISTS "orders_update" ON public.orders;
DROP POLICY IF EXISTS "orders_delete" ON public.orders;
CREATE POLICY "orders_select" ON public.orders FOR SELECT
USING (org_id = public.current_user_org_id()
       AND (public.is_admin_in_org(org_id) OR owner_user_id = auth.uid() OR created_by = auth.uid()));
CREATE POLICY "orders_insert" ON public.orders FOR INSERT
WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "orders_update" ON public.orders FOR UPDATE
USING (org_id = public.current_user_org_id()
       AND (public.is_admin_in_org(org_id) OR owner_user_id = auth.uid() OR created_by = auth.uid()))
WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "orders_delete" ON public.orders FOR DELETE USING (public.is_admin_in_org(org_id));

-- ORDER_ITEMS (no org_id — use parent order)
DROP POLICY IF EXISTS "order_items_select" ON public.order_items;
DROP POLICY IF EXISTS "order_items_modify" ON public.order_items;
CREATE POLICY "order_items_select" ON public.order_items FOR SELECT
USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.org_id = public.current_user_org_id()));
CREATE POLICY "order_items_modify" ON public.order_items FOR ALL
USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.org_id = public.current_user_org_id()))
WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.org_id = public.current_user_org_id()));

-- PAYMENTS
DROP POLICY IF EXISTS "payments_select" ON public.payments;
DROP POLICY IF EXISTS "payments_insert" ON public.payments;
DROP POLICY IF EXISTS "payments_update" ON public.payments;
DROP POLICY IF EXISTS "payments_delete" ON public.payments;
CREATE POLICY "payments_select" ON public.payments FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "payments_insert" ON public.payments FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "payments_update" ON public.payments FOR UPDATE USING (org_id = public.current_user_org_id() AND (public.is_admin_in_org(org_id) OR confirmed_by = auth.uid()));
CREATE POLICY "payments_delete" ON public.payments FOR DELETE USING (public.is_admin_in_org(org_id));

-- LEADS
DROP POLICY IF EXISTS "leads_select" ON public.leads;
DROP POLICY IF EXISTS "leads_insert" ON public.leads;
DROP POLICY IF EXISTS "leads_update" ON public.leads;
DROP POLICY IF EXISTS "leads_delete" ON public.leads;
CREATE POLICY "leads_select" ON public.leads FOR SELECT
USING (org_id = public.current_user_org_id()
       AND (public.is_admin_in_org(org_id) OR owner_user_id = auth.uid() OR created_by = auth.uid()));
CREATE POLICY "leads_insert" ON public.leads FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "leads_update" ON public.leads FOR UPDATE
USING (org_id = public.current_user_org_id()
       AND (public.is_admin_in_org(org_id) OR owner_user_id = auth.uid() OR created_by = auth.uid()))
WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "leads_delete" ON public.leads FOR DELETE USING (public.is_admin_in_org(org_id));

-- OPPORTUNITIES
DROP POLICY IF EXISTS "opp_select" ON public.opportunities;
DROP POLICY IF EXISTS "opp_insert" ON public.opportunities;
DROP POLICY IF EXISTS "opp_update" ON public.opportunities;
DROP POLICY IF EXISTS "opp_delete" ON public.opportunities;
CREATE POLICY "opp_select" ON public.opportunities FOR SELECT
USING (org_id = public.current_user_org_id()
       AND (public.is_admin_in_org(org_id) OR owner_user_id = auth.uid() OR created_by = auth.uid()));
CREATE POLICY "opp_insert" ON public.opportunities FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "opp_update" ON public.opportunities FOR UPDATE
USING (org_id = public.current_user_org_id()
       AND (public.is_admin_in_org(org_id) OR owner_user_id = auth.uid() OR created_by = auth.uid()))
WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "opp_delete" ON public.opportunities FOR DELETE USING (public.is_admin_in_org(org_id));

-- CRM_ACTIVITIES (whole team can see — log of customer touchpoints)
DROP POLICY IF EXISTS "crm_act_select" ON public.crm_activities;
DROP POLICY IF EXISTS "crm_act_insert" ON public.crm_activities;
DROP POLICY IF EXISTS "crm_act_update" ON public.crm_activities;
DROP POLICY IF EXISTS "crm_act_delete" ON public.crm_activities;
CREATE POLICY "crm_act_select" ON public.crm_activities FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "crm_act_insert" ON public.crm_activities FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "crm_act_update" ON public.crm_activities FOR UPDATE
USING (org_id = public.current_user_org_id() AND (public.is_admin_in_org(org_id) OR created_by = auth.uid()))
WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "crm_act_delete" ON public.crm_activities FOR DELETE USING (public.is_admin_in_org(org_id));

-- SFA_VISITS (sale check-in — own visits)
DROP POLICY IF EXISTS "sfa_select" ON public.sfa_visits;
DROP POLICY IF EXISTS "sfa_insert" ON public.sfa_visits;
DROP POLICY IF EXISTS "sfa_update" ON public.sfa_visits;
DROP POLICY IF EXISTS "sfa_delete" ON public.sfa_visits;
CREATE POLICY "sfa_select" ON public.sfa_visits FOR SELECT
USING (org_id = public.current_user_org_id()
       AND (public.is_admin_in_org(org_id) OR owner_user_id = auth.uid() OR created_by = auth.uid()));
CREATE POLICY "sfa_insert" ON public.sfa_visits FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "sfa_update" ON public.sfa_visits FOR UPDATE
USING (org_id = public.current_user_org_id()
       AND (public.is_admin_in_org(org_id) OR owner_user_id = auth.uid()))
WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "sfa_delete" ON public.sfa_visits FOR DELETE USING (public.is_admin_in_org(org_id));

-- TASKS
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT
USING (org_id = public.current_user_org_id());
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE
USING (org_id = public.current_user_org_id()
       AND (public.is_admin_in_org(org_id) OR owner_user_id = auth.uid() OR created_by = auth.uid()))
WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE USING (public.is_admin_in_org(org_id));

-- COMMISSIONS (beneficiary + admin only)
DROP POLICY IF EXISTS "commissions_select" ON public.commissions;
DROP POLICY IF EXISTS "commissions_insert" ON public.commissions;
DROP POLICY IF EXISTS "commissions_update" ON public.commissions;
DROP POLICY IF EXISTS "commissions_delete" ON public.commissions;
CREATE POLICY "commissions_select" ON public.commissions FOR SELECT
USING (org_id = public.current_user_org_id()
       AND (public.is_admin_in_org(org_id) OR beneficiary_user_id = auth.uid()));
CREATE POLICY "commissions_insert" ON public.commissions FOR INSERT WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "commissions_update" ON public.commissions FOR UPDATE USING (public.is_admin_in_org(org_id)) WITH CHECK (org_id = public.current_user_org_id());
CREATE POLICY "commissions_delete" ON public.commissions FOR DELETE USING (public.is_admin_in_org(org_id));

-- COMMISSION_RULES (admin-managed config; everyone can read)
DROP POLICY IF EXISTS "commission_rules_select" ON public.commission_rules;
DROP POLICY IF EXISTS "commission_rules_modify" ON public.commission_rules;
CREATE POLICY "commission_rules_select" ON public.commission_rules FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "commission_rules_modify" ON public.commission_rules FOR ALL USING (public.is_admin_in_org(org_id)) WITH CHECK (public.is_admin_in_org(org_id));

-- ROAST_BATCHES
DROP POLICY IF EXISTS "roast_batches_select" ON public.roast_batches;
DROP POLICY IF EXISTS "roast_batches_modify" ON public.roast_batches;
CREATE POLICY "roast_batches_select" ON public.roast_batches FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "roast_batches_modify" ON public.roast_batches FOR ALL USING (org_id = public.current_user_org_id()) WITH CHECK (org_id = public.current_user_org_id());

-- INVENTORY_LEDGER (read-only audit; insert via app)
DROP POLICY IF EXISTS "inventory_ledger_select" ON public.inventory_ledger;
DROP POLICY IF EXISTS "inventory_ledger_insert" ON public.inventory_ledger;
CREATE POLICY "inventory_ledger_select" ON public.inventory_ledger FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "inventory_ledger_insert" ON public.inventory_ledger FOR INSERT WITH CHECK (org_id = public.current_user_org_id());

-- GREEN_INBOUNDS
DROP POLICY IF EXISTS "green_inbounds_select" ON public.green_inbounds;
DROP POLICY IF EXISTS "green_inbounds_modify" ON public.green_inbounds;
CREATE POLICY "green_inbounds_select" ON public.green_inbounds FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "green_inbounds_modify" ON public.green_inbounds FOR ALL USING (org_id = public.current_user_org_id()) WITH CHECK (org_id = public.current_user_org_id());

-- SUPPLIERS
DROP POLICY IF EXISTS "suppliers_select" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_modify" ON public.suppliers;
CREATE POLICY "suppliers_select" ON public.suppliers FOR SELECT USING (org_id = public.current_user_org_id());
CREATE POLICY "suppliers_modify" ON public.suppliers FOR ALL USING (public.is_admin_in_org(org_id)) WITH CHECK (public.is_admin_in_org(org_id));

-- USER_TARGETS (own targets + admin)
DROP POLICY IF EXISTS "user_targets_select" ON public.user_targets;
DROP POLICY IF EXISTS "user_targets_modify" ON public.user_targets;
CREATE POLICY "user_targets_select" ON public.user_targets FOR SELECT
USING (org_id = public.current_user_org_id()
       AND (public.is_admin_in_org(org_id) OR user_id = auth.uid()));
CREATE POLICY "user_targets_modify" ON public.user_targets FOR ALL USING (public.is_admin_in_org(org_id)) WITH CHECK (public.is_admin_in_org(org_id));

-- AUDIT_LOG (admin-only read; insert allowed for any org member)
DROP POLICY IF EXISTS "audit_log_select" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_insert" ON public.audit_log;
CREATE POLICY "audit_log_select" ON public.audit_log FOR SELECT USING (public.is_admin_in_org(org_id));
CREATE POLICY "audit_log_insert" ON public.audit_log FOR INSERT WITH CHECK (org_id = public.current_user_org_id());

-- ── 7) Tables without org_id — scope via parent FK ──

-- PRODUCT_FORMULAS (parent: products)
DROP POLICY IF EXISTS "product_formulas_select" ON public.product_formulas;
DROP POLICY IF EXISTS "product_formulas_modify" ON public.product_formulas;
CREATE POLICY "product_formulas_select" ON public.product_formulas FOR SELECT
USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_formulas.product_id AND p.org_id = public.current_user_org_id()));
CREATE POLICY "product_formulas_modify" ON public.product_formulas FOR ALL
USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_formulas.product_id AND public.is_admin_in_org(p.org_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_formulas.product_id AND public.is_admin_in_org(p.org_id)));

-- PRODUCT_RECIPE_LINES (parent: products)
DROP POLICY IF EXISTS "product_recipe_lines_select" ON public.product_recipe_lines;
DROP POLICY IF EXISTS "product_recipe_lines_modify" ON public.product_recipe_lines;
CREATE POLICY "product_recipe_lines_select" ON public.product_recipe_lines FOR SELECT
USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_recipe_lines.product_id AND p.org_id = public.current_user_org_id()));
CREATE POLICY "product_recipe_lines_modify" ON public.product_recipe_lines FOR ALL
USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_recipe_lines.product_id AND public.is_admin_in_org(p.org_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_recipe_lines.product_id AND public.is_admin_in_org(p.org_id)));

-- CUSTOMER_NOTES (parent: customers)
DROP POLICY IF EXISTS "customer_notes_select" ON public.customer_notes;
DROP POLICY IF EXISTS "customer_notes_modify" ON public.customer_notes;
CREATE POLICY "customer_notes_select" ON public.customer_notes FOR SELECT
USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_notes.customer_id AND c.org_id = public.current_user_org_id()));
CREATE POLICY "customer_notes_modify" ON public.customer_notes FOR ALL
USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_notes.customer_id AND c.org_id = public.current_user_org_id()))
WITH CHECK (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_notes.customer_id AND c.org_id = public.current_user_org_id()));

-- SALES_VISITS (parent: customers) — older table; treat like sfa_visits
DROP POLICY IF EXISTS "sales_visits_select" ON public.sales_visits;
DROP POLICY IF EXISTS "sales_visits_modify" ON public.sales_visits;
CREATE POLICY "sales_visits_select" ON public.sales_visits FOR SELECT
USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = sales_visits.customer_id AND c.org_id = public.current_user_org_id()));
CREATE POLICY "sales_visits_modify" ON public.sales_visits FOR ALL
USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = sales_visits.customer_id AND c.org_id = public.current_user_org_id()))
WITH CHECK (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = sales_visits.customer_id AND c.org_id = public.current_user_org_id()));

-- ── 8) Reload PostgREST schema cache ────────────────────────
NOTIFY pgrst, 'reload schema';
