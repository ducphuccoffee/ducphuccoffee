-- Migration 0018: Proper RLS for CRM + ERP tables
-- Owner sees own data, admin/manager sees all
-- service_role bypasses RLS automatically

-- Helper function: check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'manager', 'roastery_manager')
  );
$$;

----------------------------------------------------------------------
-- LEADS
----------------------------------------------------------------------
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leads_all" ON public.leads;
DROP POLICY IF EXISTS "leads_select" ON public.leads;
DROP POLICY IF EXISTS "leads_insert" ON public.leads;
DROP POLICY IF EXISTS "leads_update" ON public.leads;
DROP POLICY IF EXISTS "leads_delete" ON public.leads;

CREATE POLICY "leads_select" ON public.leads FOR SELECT USING (
  owner_user_id = auth.uid() OR public.is_admin()
);
CREATE POLICY "leads_insert" ON public.leads FOR INSERT WITH CHECK (
  owner_user_id = auth.uid() OR created_by = auth.uid() OR public.is_admin()
);
CREATE POLICY "leads_update" ON public.leads FOR UPDATE USING (
  owner_user_id = auth.uid() OR public.is_admin()
);
CREATE POLICY "leads_delete" ON public.leads FOR DELETE USING (
  public.is_admin()
);

----------------------------------------------------------------------
-- OPPORTUNITIES
----------------------------------------------------------------------
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "opportunities_all" ON public.opportunities;
DROP POLICY IF EXISTS "opp_select" ON public.opportunities;
DROP POLICY IF EXISTS "opp_insert" ON public.opportunities;
DROP POLICY IF EXISTS "opp_update" ON public.opportunities;
DROP POLICY IF EXISTS "opp_delete" ON public.opportunities;

CREATE POLICY "opp_select" ON public.opportunities FOR SELECT USING (
  owner_user_id = auth.uid() OR public.is_admin()
);
CREATE POLICY "opp_insert" ON public.opportunities FOR INSERT WITH CHECK (
  owner_user_id = auth.uid() OR created_by = auth.uid() OR public.is_admin()
);
CREATE POLICY "opp_update" ON public.opportunities FOR UPDATE USING (
  owner_user_id = auth.uid() OR public.is_admin()
);
CREATE POLICY "opp_delete" ON public.opportunities FOR DELETE USING (
  public.is_admin()
);

----------------------------------------------------------------------
-- CRM_ACTIVITIES
----------------------------------------------------------------------
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_activities_all" ON public.crm_activities;
DROP POLICY IF EXISTS "crm_act_select" ON public.crm_activities;
DROP POLICY IF EXISTS "crm_act_insert" ON public.crm_activities;

CREATE POLICY "crm_act_select" ON public.crm_activities FOR SELECT USING (
  created_by = auth.uid() OR owner_user_id = auth.uid() OR public.is_admin()
);
CREATE POLICY "crm_act_insert" ON public.crm_activities FOR INSERT WITH CHECK (
  created_by = auth.uid() OR public.is_admin()
);

----------------------------------------------------------------------
-- SFA_VISITS
----------------------------------------------------------------------
ALTER TABLE public.sfa_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sfa_visits_all" ON public.sfa_visits;
DROP POLICY IF EXISTS "sfa_select" ON public.sfa_visits;
DROP POLICY IF EXISTS "sfa_insert" ON public.sfa_visits;
DROP POLICY IF EXISTS "sfa_update" ON public.sfa_visits;

CREATE POLICY "sfa_select" ON public.sfa_visits FOR SELECT USING (
  owner_user_id = auth.uid() OR public.is_admin()
);
CREATE POLICY "sfa_insert" ON public.sfa_visits FOR INSERT WITH CHECK (
  owner_user_id = auth.uid() OR created_by = auth.uid() OR public.is_admin()
);
CREATE POLICY "sfa_update" ON public.sfa_visits FOR UPDATE USING (
  owner_user_id = auth.uid() OR public.is_admin()
);

----------------------------------------------------------------------
-- TASKS (CRM + ERP shared)
----------------------------------------------------------------------
-- tasks already has RLS; drop old permissive policies if any
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
DROP POLICY IF EXISTS "tasks_all" ON public.tasks;
DROP POLICY IF EXISTS "Users can view tasks in their org" ON public.tasks;
DROP POLICY IF EXISTS "Users can insert tasks in their org" ON public.tasks;
DROP POLICY IF EXISTS "Users can update tasks in their org" ON public.tasks;

CREATE POLICY "tasks_select" ON public.tasks FOR SELECT USING (
  owner_user_id = auth.uid()
  OR created_by = auth.uid()
  OR public.is_admin()
);
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE USING (
  owner_user_id = auth.uid()
  OR created_by = auth.uid()
  OR public.is_admin()
);

----------------------------------------------------------------------
-- ORDERS
----------------------------------------------------------------------
-- orders already has RLS; replace policies
DROP POLICY IF EXISTS "orders_select" ON public.orders;
DROP POLICY IF EXISTS "orders_insert" ON public.orders;
DROP POLICY IF EXISTS "orders_update" ON public.orders;
DROP POLICY IF EXISTS "orders_all" ON public.orders;
DROP POLICY IF EXISTS "Users can view orders in their org" ON public.orders;
DROP POLICY IF EXISTS "Users can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update orders" ON public.orders;

CREATE POLICY "orders_select" ON public.orders FOR SELECT USING (
  owner_user_id = auth.uid()
  OR created_by = auth.uid()
  OR public.is_admin()
);
CREATE POLICY "orders_insert" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "orders_update" ON public.orders FOR UPDATE USING (
  owner_user_id = auth.uid()
  OR created_by = auth.uid()
  OR public.is_admin()
);

----------------------------------------------------------------------
-- COMMISSIONS
----------------------------------------------------------------------
DROP POLICY IF EXISTS "commissions_select" ON public.commissions;
DROP POLICY IF EXISTS "commissions_insert" ON public.commissions;
DROP POLICY IF EXISTS "commissions_update" ON public.commissions;
DROP POLICY IF EXISTS "commissions_all" ON public.commissions;

ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commissions_select" ON public.commissions FOR SELECT USING (
  beneficiary_user_id = auth.uid() OR public.is_admin()
);
CREATE POLICY "commissions_insert" ON public.commissions FOR INSERT WITH CHECK (true);
CREATE POLICY "commissions_update" ON public.commissions FOR UPDATE USING (
  public.is_admin()
);

----------------------------------------------------------------------
-- PAYMENTS
----------------------------------------------------------------------
DROP POLICY IF EXISTS "payments_select" ON public.payments;
DROP POLICY IF EXISTS "payments_insert" ON public.payments;
DROP POLICY IF EXISTS "payments_all" ON public.payments;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_select" ON public.payments FOR SELECT USING (
  confirmed_by = auth.uid() OR public.is_admin()
);
CREATE POLICY "payments_insert" ON public.payments FOR INSERT WITH CHECK (true);

----------------------------------------------------------------------
-- RELOAD SCHEMA CACHE
----------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
