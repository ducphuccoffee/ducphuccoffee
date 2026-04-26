-- ============================================================
-- Migration 0022: Org-scoped RLS hardening (Đợt 9)
-- ============================================================
-- Drops every legacy `auth_all`/global-admin policy and re-creates
-- org-scoped policies. Wrapped in DO blocks so missing tables are skipped.
-- service_role bypasses RLS automatically (Supabase built-in).
-- ============================================================

-- ── 1) Helper functions ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.org_members
  WHERE user_id = auth.uid() AND is_active = true
  ORDER BY joined_at NULLS LAST
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_in_org(p_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members om
    JOIN public.profiles p ON p.id = om.user_id
    WHERE om.user_id = auth.uid()
      AND om.org_id  = p_org
      AND om.is_active = true
      AND p.role IN ('admin','manager','roastery_manager')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin_in_org(public.current_user_org_id());
$$;

-- ── 2) Drop all legacy permissive policies on every public table ──

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname='public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ── 3) Per-table block: ENABLE RLS + create policies. Skip if table missing. ──

-- Helper: regclass check
-- Each block: IF to_regclass('public.X') IS NOT NULL THEN ... END IF;

-- PROFILES
DO $$ BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (id = auth.uid() OR EXISTS (SELECT 1 FROM public.org_members om WHERE om.user_id = profiles.id AND om.org_id = public.current_user_org_id() AND om.is_active = true))';
    EXECUTE 'CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (id = auth.uid() OR public.is_admin()) WITH CHECK (id = auth.uid() OR public.is_admin())';
  END IF;
END $$;

-- ORGS
DO $$ BEGIN
  IF to_regclass('public.orgs') IS NOT NULL THEN
    ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "orgs_select" ON public.orgs FOR SELECT USING (EXISTS (SELECT 1 FROM public.org_members om WHERE om.org_id = orgs.id AND om.user_id = auth.uid() AND om.is_active = true))';
  END IF;
END $$;

-- ORG_MEMBERS
DO $$ BEGIN
  IF to_regclass('public.org_members') IS NOT NULL THEN
    ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "org_members_select" ON public.org_members FOR SELECT USING (user_id = auth.uid() OR public.is_admin_in_org(org_id))';
    EXECUTE 'CREATE POLICY "org_members_modify" ON public.org_members FOR ALL USING (public.is_admin_in_org(org_id)) WITH CHECK (public.is_admin_in_org(org_id))';
  END IF;
END $$;

-- CUSTOMERS
DO $$ BEGIN
  IF to_regclass('public.customers') IS NOT NULL THEN
    ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "customers_select" ON public.customers FOR SELECT USING (org_id = public.current_user_org_id())';
    EXECUTE 'CREATE POLICY "customers_insert" ON public.customers FOR INSERT WITH CHECK (org_id = public.current_user_org_id())';
    EXECUTE 'CREATE POLICY "customers_update" ON public.customers FOR UPDATE USING (org_id = public.current_user_org_id()) WITH CHECK (org_id = public.current_user_org_id())';
    EXECUTE 'CREATE POLICY "customers_delete" ON public.customers FOR DELETE USING (public.is_admin_in_org(org_id))';
  END IF;
END $$;

-- PRODUCTS
DO $$ BEGIN
  IF to_regclass('public.products') IS NOT NULL THEN
    ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "products_select" ON public.products FOR SELECT USING (org_id = public.current_user_org_id())';
    EXECUTE 'CREATE POLICY "products_insert" ON public.products FOR INSERT WITH CHECK (public.is_admin_in_org(org_id))';
    EXECUTE 'CREATE POLICY "products_update" ON public.products FOR UPDATE USING (public.is_admin_in_org(org_id)) WITH CHECK (public.is_admin_in_org(org_id))';
    EXECUTE 'CREATE POLICY "products_delete" ON public.products FOR DELETE USING (public.is_admin_in_org(org_id))';
  END IF;
END $$;

-- ORDERS
DO $$ BEGIN
  IF to_regclass('public.orders') IS NOT NULL THEN
    ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "orders_select" ON public.orders FOR SELECT USING (org_id = public.current_user_org_id() AND (public.is_admin_in_org(org_id) OR owner_user_id = auth.uid() OR created_by = auth.uid()))';
    EXECUTE 'CREATE POLICY "orders_insert" ON public.orders FOR INSERT WITH CHECK (org_id = public.current_user_org_id())';
    EXECUTE 'CREATE POLICY "orders_update" ON public.orders FOR UPDATE USING (org_id = public.current_user_org_id() AND (public.is_admin_in_org(org_id) OR owner_user_id = auth.uid() OR created_by = auth.uid())) WITH CHECK (org_id = public.current_user_org_id())';
    EXECUTE 'CREATE POLICY "orders_delete" ON public.orders FOR DELETE USING (public.is_admin_in_org(org_id))';
  END IF;
END $$;

-- ORDER_ITEMS (no org_id — scope via parent order)
DO $$ BEGIN
  IF to_regclass('public.order_items') IS NOT NULL THEN
    ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "order_items_select" ON public.order_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.org_id = public.current_user_org_id()))';
    EXECUTE 'CREATE POLICY "order_items_modify" ON public.order_items FOR ALL USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.org_id = public.current_user_org_id())) WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.org_id = public.current_user_org_id()))';
  END IF;
END $$;

-- PAYMENTS
DO $$ BEGIN
  IF to_regclass('public.payments') IS NOT NULL THEN
    ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "payments_select" ON public.payments FOR SELECT USING (org_id = public.current_user_org_id())';
    EXECUTE 'CREATE POLICY "payments_insert" ON public.payments FOR INSERT WITH CHECK (org_id = public.current_user_org_id())';
    EXECUTE 'CREATE POLICY "payments_update" ON public.payments FOR UPDATE USING (org_id = public.current_user_org_id() AND public.is_admin_in_org(org_id)) WITH CHECK (org_id = public.current_user_org_id())';
    EXECUTE 'CREATE POLICY "payments_delete" ON public.payments FOR DELETE USING (public.is_admin_in_org(org_id))';
  END IF;
END $$;

-- LEADS
DO $$ BEGIN
  IF to_regclass('public.leads') IS NOT NULL THEN
    ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "leads_select" ON public.leads FOR SELECT USING (org_id = public.current_user_org_id() AND (public.is_admin_in_org(org_id) OR owner_user_id = auth.uid() OR created_by = auth.uid()))';
    EXECUTE 'CREATE POLICY "leads_insert" ON public.leads FOR INSERT WITH CHECK (org_id = public.current_user_org_id())';
    EXECUTE 'CREATE POLICY "leads_update" ON public.leads FOR UPDATE USING (org_id = public.current_user_org_id() AND (public.is_admin_in_org(org_id) OR owner_user_id = auth.uid() OR created_by = auth.uid())) WITH CHECK (org_id = public.current_user_org_id())';
    EXECUTE 'CREATE POLICY "leads_delete" ON public.leads FOR DELETE USING (public.is_admin_in_org(org_id))';
  END IF;
END $$;

-- OPPORTUNITIES
DO $$ BEGIN
  IF to_regclass('public.opportunities') IS NOT NULL THEN
    ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "opp_select" ON public.opportunities FOR SELECT USING (org_id = public.current_user_org_id() AND (public.is_admin_in_org(org_id) OR owner_user_id = auth.uid() OR created_by = auth.uid()))';
    EXECUTE 'CREATE POLICY "opp_insert" ON public.opportunities FOR INSERT WITH CHECK (org_id = public.current_user_org_id())';
    EXECUTE 'CREATE POLICY "opp_update" ON public.opportunities FOR UPDATE USING (org_id = public.current_user_org_id() AND (public.is_admin_in_org(org_id) OR owner_user_id = auth.uid() OR created_by = auth.uid())) WITH CHECK (org_id = public.current_user_org_id())';
    EXECUTE 'CREATE POLICY "opp_delete" ON public.opportunities FOR DELETE USING (public.is_admin_in_org(org_id))';
  END IF;
END $$;

-- CRM_ACTIVITIES
DO $$ BEGIN
  IF to_regclass('public.crm_activities') IS NOT NULL THEN
    ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "crm_act_select" ON public.crm_activities FOR SELECT USING (org_id = public.current_user_org_id())';
    EXECUTE 'CREATE POLICY "crm_act_insert" ON public.crm_activities FOR INSERT WITH CHECK (org_id = public.current_user_org_id())';
    EXECUTE 'CREATE POLICY "crm_act_update" ON public.crm_activities FOR UPDATE USING (org_id = public.current_user_org_id() AND (public.is_admin_in_org(org_id) OR created_by = auth.uid())) WITH CHECK (org_id = public.current_user_org_id())';
    EXECUTE 'CREATE POLICY "crm_act_delete" ON public.crm_activities FOR DELETE USING (public.is_admin_in_org(org_id))';
  END IF;
END $$;

-- SFA_VISITS
DO $$ BEGIN
  IF to_regclass('public.sfa_visits') IS NOT NULL THEN
    ALTER TABLE public.sfa_visits ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "sfa_select" ON public.sfa_visits FOR SELECT USING (org_id = public.current_user_org_id() AND (public.is_admin_in_org(org_id) OR owner_user_id = auth.uid() OR created_by = auth.uid()))';
    EXECUTE 'CREATE POLICY "sfa_insert" ON public.sfa_visits FOR INSERT WITH CHECK (org_id = public.current_user_org_id())';
    EXECUTE 'CREATE POLICY "sfa_update" ON public.sfa_visits FOR UPDATE USING (org_id = public.current_user_org_id() AND (public.is_admin_in_org(org_id) OR owner_user_id = auth.uid())) WITH CHECK (org_id = public.current_user_org_id())';
    EXECUTE 'CREATE POLICY "sfa_delete" ON public.sfa_visits FOR DELETE USING (public.is_admin_in_org(org_id))';
  END IF;
END $$;

-- TASKS
DO $$ BEGIN
  IF to_regclass('public.tasks') IS NOT NULL THEN
    ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "tasks_select" ON public.tasks FOR SELECT USING (org_id = public.current_user_org_id())';
    EXECUTE 'CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT WITH CHECK (org_id = public.current_user_org_id())';
    EXECUTE 'CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE USING (org_id = public.current_user_org_id() AND (public.is_admin_in_org(org_id) OR owner_user_id = auth.uid() OR created_by = auth.uid())) WITH CHECK (org_id = public.current_user_org_id())';
    EXECUTE 'CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE USING (public.is_admin_in_org(org_id))';
  END IF;
END $$;

-- COMMISSIONS
DO $$ BEGIN
  IF to_regclass('public.commissions') IS NOT NULL THEN
    ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "commissions_select" ON public.commissions FOR SELECT USING (org_id = public.current_user_org_id() AND (public.is_admin_in_org(org_id) OR beneficiary_user_id = auth.uid()))';
    EXECUTE 'CREATE POLICY "commissions_insert" ON public.commissions FOR INSERT WITH CHECK (org_id = public.current_user_org_id())';
    EXECUTE 'CREATE POLICY "commissions_update" ON public.commissions FOR UPDATE USING (public.is_admin_in_org(org_id)) WITH CHECK (org_id = public.current_user_org_id())';
    EXECUTE 'CREATE POLICY "commissions_delete" ON public.commissions FOR DELETE USING (public.is_admin_in_org(org_id))';
  END IF;
END $$;

-- COMMISSION_RULES
DO $$ BEGIN
  IF to_regclass('public.commission_rules') IS NOT NULL THEN
    ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "commission_rules_select" ON public.commission_rules FOR SELECT USING (org_id = public.current_user_org_id())';
    EXECUTE 'CREATE POLICY "commission_rules_modify" ON public.commission_rules FOR ALL USING (public.is_admin_in_org(org_id)) WITH CHECK (public.is_admin_in_org(org_id))';
  END IF;
END $$;

-- ROAST_BATCHES
DO $$ BEGIN
  IF to_regclass('public.roast_batches') IS NOT NULL THEN
    ALTER TABLE public.roast_batches ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "roast_batches_select" ON public.roast_batches FOR SELECT USING (org_id = public.current_user_org_id())';
    EXECUTE 'CREATE POLICY "roast_batches_modify" ON public.roast_batches FOR ALL USING (org_id = public.current_user_org_id()) WITH CHECK (org_id = public.current_user_org_id())';
  END IF;
END $$;

-- INVENTORY_LEDGER
DO $$ BEGIN
  IF to_regclass('public.inventory_ledger') IS NOT NULL THEN
    ALTER TABLE public.inventory_ledger ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "inventory_ledger_select" ON public.inventory_ledger FOR SELECT USING (org_id = public.current_user_org_id())';
    EXECUTE 'CREATE POLICY "inventory_ledger_insert" ON public.inventory_ledger FOR INSERT WITH CHECK (org_id = public.current_user_org_id())';
  END IF;
END $$;

-- GREEN_INBOUNDS
DO $$ BEGIN
  IF to_regclass('public.green_inbounds') IS NOT NULL THEN
    ALTER TABLE public.green_inbounds ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "green_inbounds_select" ON public.green_inbounds FOR SELECT USING (org_id = public.current_user_org_id())';
    EXECUTE 'CREATE POLICY "green_inbounds_modify" ON public.green_inbounds FOR ALL USING (org_id = public.current_user_org_id()) WITH CHECK (org_id = public.current_user_org_id())';
  END IF;
END $$;

-- SUPPLIERS
DO $$ BEGIN
  IF to_regclass('public.suppliers') IS NOT NULL THEN
    ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "suppliers_select" ON public.suppliers FOR SELECT USING (org_id = public.current_user_org_id())';
    EXECUTE 'CREATE POLICY "suppliers_modify" ON public.suppliers FOR ALL USING (public.is_admin_in_org(org_id)) WITH CHECK (public.is_admin_in_org(org_id))';
  END IF;
END $$;

-- USER_TARGETS
DO $$ BEGIN
  IF to_regclass('public.user_targets') IS NOT NULL THEN
    ALTER TABLE public.user_targets ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "user_targets_select" ON public.user_targets FOR SELECT USING (org_id = public.current_user_org_id() AND (public.is_admin_in_org(org_id) OR user_id = auth.uid()))';
    EXECUTE 'CREATE POLICY "user_targets_modify" ON public.user_targets FOR ALL USING (public.is_admin_in_org(org_id)) WITH CHECK (public.is_admin_in_org(org_id))';
  END IF;
END $$;

-- AUDIT_LOG
DO $$ BEGIN
  IF to_regclass('public.audit_log') IS NOT NULL THEN
    ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "audit_log_select" ON public.audit_log FOR SELECT USING (public.is_admin_in_org(org_id))';
    EXECUTE 'CREATE POLICY "audit_log_insert" ON public.audit_log FOR INSERT WITH CHECK (org_id = public.current_user_org_id())';
  END IF;
END $$;

-- PRODUCT_FORMULAS (parent: products)
DO $$ BEGIN
  IF to_regclass('public.product_formulas') IS NOT NULL THEN
    ALTER TABLE public.product_formulas ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "product_formulas_select" ON public.product_formulas FOR SELECT USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_formulas.product_id AND p.org_id = public.current_user_org_id()))';
    EXECUTE 'CREATE POLICY "product_formulas_modify" ON public.product_formulas FOR ALL USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_formulas.product_id AND public.is_admin_in_org(p.org_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_formulas.product_id AND public.is_admin_in_org(p.org_id)))';
  END IF;
END $$;

-- PRODUCT_RECIPE_LINES (parent: products)
DO $$ BEGIN
  IF to_regclass('public.product_recipe_lines') IS NOT NULL THEN
    ALTER TABLE public.product_recipe_lines ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "product_recipe_lines_select" ON public.product_recipe_lines FOR SELECT USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_recipe_lines.product_id AND p.org_id = public.current_user_org_id()))';
    EXECUTE 'CREATE POLICY "product_recipe_lines_modify" ON public.product_recipe_lines FOR ALL USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_recipe_lines.product_id AND public.is_admin_in_org(p.org_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_recipe_lines.product_id AND public.is_admin_in_org(p.org_id)))';
  END IF;
END $$;

-- CUSTOMER_NOTES (parent: customers)
DO $$ BEGIN
  IF to_regclass('public.customer_notes') IS NOT NULL THEN
    ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "customer_notes_select" ON public.customer_notes FOR SELECT USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_notes.customer_id AND c.org_id = public.current_user_org_id()))';
    EXECUTE 'CREATE POLICY "customer_notes_modify" ON public.customer_notes FOR ALL USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_notes.customer_id AND c.org_id = public.current_user_org_id())) WITH CHECK (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = customer_notes.customer_id AND c.org_id = public.current_user_org_id()))';
  END IF;
END $$;

-- SALES_VISITS (parent: customers)
DO $$ BEGIN
  IF to_regclass('public.sales_visits') IS NOT NULL THEN
    ALTER TABLE public.sales_visits ENABLE ROW LEVEL SECURITY;
    EXECUTE 'CREATE POLICY "sales_visits_select" ON public.sales_visits FOR SELECT USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = sales_visits.customer_id AND c.org_id = public.current_user_org_id()))';
    EXECUTE 'CREATE POLICY "sales_visits_modify" ON public.sales_visits FOR ALL USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = sales_visits.customer_id AND c.org_id = public.current_user_org_id())) WITH CHECK (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = sales_visits.customer_id AND c.org_id = public.current_user_org_id()))';
  END IF;
END $$;

-- ── 4) Reload PostgREST schema cache ────────────────────────
NOTIFY pgrst, 'reload schema';
