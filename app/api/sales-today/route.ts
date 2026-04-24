import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";

export const dynamic = "force-dynamic";

/**
 * Aggregated "Today" view for sales reps.
 *
 * NOTE ON DATA SOURCES:
 *   The public.tasks table is reserved for the order workflow
 *   (confirm_order / prepare_order / deliver_order) and its CHECK constraint
 *   rejects CRM/SFA types. Therefore this endpoint never reads CRM work from
 *   tasks. Planned visits and follow-ups live on sfa_visits:
 *     - planned visit:    result IS NULL AND checkout_at IS NULL, checkin_at = scheduled time
 *     - followup needed:  result = 'followup_needed'
 *
 * Scoped to current user unless admin/manager — matches /api/crm-dashboard logic.
 */
export async function GET(request: Request) {
  const supabase = createRouteSupabase(request, NextResponse.json({}));
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { data: member } = await supabase
    .from("org_members").select("org_id").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();
  if (!member?.org_id) return NextResponse.json({ error: "Không có tổ chức" }, { status: 403 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isAdmin = ["admin", "manager", "roastery_manager"].includes(profile?.role ?? "");
  const orgId = member.org_id;

  // Load org-configured CRM thresholds (with safe defaults).
  const { data: orgRow } = await supabase.from("orgs").select("settings").eq("id", orgId).maybeSingle();
  const crmCfg = (orgRow?.settings as any)?.crm ?? {};
  const staleLeadDays       = Math.max(1, Number(crmCfg.stale_lead_days)       || 7);
  const stuckOppDays        = Math.max(1, Number(crmCfg.stuck_opp_days)        || 5);
  const dormantCustomerDays = Math.max(1, Number(crmCfg.dormant_customer_days) || 60);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);
  const sevenDaysAgo = new Date(now.getTime() - staleLeadDays * 86_400_000);
  const fiveDaysAgo = new Date(now.getTime() - stuckOppDays * 86_400_000);
  const sixtyDaysAgo = new Date(now.getTime() - dormantCustomerDays * 86_400_000);

  const todayISO = todayStart.toISOString();
  const tomorrowISO = tomorrowStart.toISOString();
  const nowISO = now.toISOString();

  // Planned visits (not yet checked-in): result IS NULL AND checkout_at IS NULL.
  // checkin_at holds the scheduled time.
  let plannedVisitsQuery = supabase
    .from("sfa_visits")
    .select("id, customer_id, lead_id, owner_user_id, checkin_at, note, customers(name), leads(name)")
    .eq("org_id", orgId)
    .is("result", null)
    .is("checkout_at", null)
    .lt("checkin_at", tomorrowISO)
    .order("checkin_at", { ascending: true })
    .limit(100);
  if (!isAdmin) plannedVisitsQuery = plannedVisitsQuery.eq("owner_user_id", user.id);

  // Visits done today (actual check-ins — have a result and happened today).
  let visitsDoneQuery = supabase
    .from("sfa_visits")
    .select("id, customer_id, lead_id, owner_user_id, checkin_at, result, note, customers(name), leads(name)")
    .eq("org_id", orgId)
    .not("result", "is", null)
    .gte("checkin_at", todayISO)
    .lte("checkin_at", nowISO)
    .order("checkin_at", { ascending: false })
    .limit(50);
  if (!isAdmin) visitsDoneQuery = visitsDoneQuery.eq("owner_user_id", user.id);

  // Follow-ups needed: visits where result = followup_needed.
  let followupsQuery = supabase
    .from("sfa_visits")
    .select("id, customer_id, lead_id, owner_user_id, checkin_at, note, customers(name), leads(name)")
    .eq("org_id", orgId)
    .eq("result", "followup_needed")
    .order("checkin_at", { ascending: false })
    .limit(50);
  if (!isAdmin) followupsQuery = followupsQuery.eq("owner_user_id", user.id);

  // Stale leads — active pipeline, no update > 7 days.
  let staleLeadsQuery = supabase
    .from("leads")
    .select("id, name, phone, status, temperature, updated_at, owner_user_id")
    .eq("org_id", orgId)
    .in("status", ["new", "contacted", "meeting_scheduled", "quoted"])
    .lt("updated_at", sevenDaysAgo.toISOString())
    .order("updated_at", { ascending: true })
    .limit(20);
  if (!isAdmin) staleLeadsQuery = staleLeadsQuery.eq("owner_user_id", user.id);

  // Opportunities needing action — quoted/negotiating stuck > 5d OR expected_close_date <= today.
  let oppsStuckQuery = supabase
    .from("opportunities")
    .select("id, title, stage, expected_value, expected_close_date, updated_at, customer_id, lead_id, owner_user_id, customers(name), leads(name)")
    .eq("org_id", orgId)
    .in("stage", ["quoted", "negotiating", "demo"])
    .or(`updated_at.lt.${fiveDaysAgo.toISOString()},expected_close_date.lte.${todayStart.toISOString().slice(0, 10)}`)
    .order("expected_value", { ascending: false })
    .limit(20);
  if (!isAdmin) oppsStuckQuery = oppsStuckQuery.eq("owner_user_id", user.id);

  // Customers overdue for follow-up.
  let customersOverdueQuery = supabase
    .from("customers")
    .select("id, name, phone, next_follow_up_at, assigned_user_id")
    .not("next_follow_up_at", "is", null)
    .lt("next_follow_up_at", nowISO)
    .order("next_follow_up_at", { ascending: true })
    .limit(20);
  if (!isAdmin) customersOverdueQuery = customersOverdueQuery.eq("assigned_user_id", user.id);

  // Customers no order > 60 days (churn watch)
  let dormantQuery = supabase
    .from("customers")
    .select("id, name, phone, assigned_user_id")
    .limit(50);
  if (!isAdmin) dormantQuery = dormantQuery.eq("assigned_user_id", user.id);

  const [
    plannedVisitsRes,
    visitsDoneRes,
    followupsRes,
    staleLeadsRes,
    oppsStuckRes,
    customersOverdueRes,
    dormantCustomersRes,
  ] = await Promise.all([
    plannedVisitsQuery,
    visitsDoneQuery,
    followupsQuery,
    staleLeadsQuery,
    oppsStuckQuery,
    customersOverdueQuery,
    dormantQuery,
  ]);

  // Compute dormant customers (no order > 60 days) using a second round-trip.
  const dormantIds = (dormantCustomersRes.data ?? []).map((c: any) => c.id);
  let dormant: any[] = [];
  if (dormantIds.length > 0) {
    const { data: recentOrders } = await supabase
      .from("orders")
      .select("customer_id, created_at")
      .in("customer_id", dormantIds)
      .gte("created_at", sixtyDaysAgo.toISOString());

    const withRecent = new Set((recentOrders ?? []).map((o: any) => o.customer_id));

    const stillDormant = (dormantCustomersRes.data ?? []).filter((c: any) => !withRecent.has(c.id));
    if (stillDormant.length > 0) {
      const { data: lastOrders } = await supabase
        .from("orders")
        .select("customer_id, created_at")
        .in("customer_id", stillDormant.map((c: any) => c.id))
        .order("created_at", { ascending: false });

      const lastOrderMap: Record<string, string> = {};
      for (const o of lastOrders ?? []) {
        if (!lastOrderMap[o.customer_id]) lastOrderMap[o.customer_id] = o.created_at;
      }

      dormant = stillDormant
        .map((c: any) => {
          const lastOrder = lastOrderMap[c.id] ?? null;
          const daysSince = lastOrder ? Math.floor((now.getTime() - new Date(lastOrder).getTime()) / 86_400_000) : null;
          return { ...c, last_order_at: lastOrder, days_since_last_order: daysSince };
        })
        .filter((c) => c.days_since_last_order == null || c.days_since_last_order >= dormantCustomerDays)
        .sort((a, b) => (b.days_since_last_order ?? 999) - (a.days_since_last_order ?? 999))
        .slice(0, 10);
    }
  }

  // Split planned visits by overdue/today.
  const plannedVisits = plannedVisitsRes.data ?? [];
  const visitsPlannedOverdue: any[] = [];
  const visitsPlannedToday: any[] = [];
  for (const v of plannedVisits) {
    const scheduled = v.checkin_at ? new Date(v.checkin_at) : null;
    const item = {
      ...v,
      display_name: (v.customers as any)?.name ?? (v.leads as any)?.name ?? "—",
    };
    if (!scheduled || scheduled < todayStart) visitsPlannedOverdue.push(item);
    else visitsPlannedToday.push(item);
  }

  const visits = (visitsDoneRes.data ?? []).map((v: any) => ({
    ...v,
    display_name: v.customers?.name ?? v.leads?.name ?? "—",
  }));

  const followupsNeeded = (followupsRes.data ?? []).map((v: any) => ({
    ...v,
    display_name: v.customers?.name ?? v.leads?.name ?? "—",
    days_since: v.checkin_at ? Math.floor((now.getTime() - new Date(v.checkin_at).getTime()) / 86_400_000) : null,
  }));

  const stuckOpps = (oppsStuckRes.data ?? []).map((o: any) => ({
    ...o,
    contact_name: o.customers?.name ?? o.leads?.name ?? "—",
    days_stuck: o.updated_at ? Math.floor((now.getTime() - new Date(o.updated_at).getTime()) / 86_400_000) : null,
    is_past_due: o.expected_close_date ? new Date(o.expected_close_date) <= now : false,
  }));

  const staleLeads = (staleLeadsRes.data ?? []).map((l: any) => ({
    ...l,
    days_since_update: l.updated_at ? Math.floor((now.getTime() - new Date(l.updated_at).getTime()) / 86_400_000) : null,
  }));

  const customersOverdue = (customersOverdueRes.data ?? []).map((c: any) => ({
    ...c,
    overdue_days: c.next_follow_up_at ? Math.floor((now.getTime() - new Date(c.next_follow_up_at).getTime()) / 86_400_000) : null,
  }));

  const summary = {
    visits_planned: visitsPlannedOverdue.length + visitsPlannedToday.length,
    visits_overdue: visitsPlannedOverdue.length,
    visits_done_today: visits.length,
    followups_needed: followupsNeeded.length,
    stale_leads: staleLeads.length,
    stuck_opps: stuckOpps.length,
    customers_overdue: customersOverdue.length,
    dormant_customers: dormant.length,
  };

  return NextResponse.json({
    ok: true,
    data: {
      summary,
      visits: {
        planned_overdue: visitsPlannedOverdue,
        planned_today: visitsPlannedToday,
        done_today: visits,
        followup_needed: followupsNeeded,
      },
      stale_leads: staleLeads,
      stuck_opportunities: stuckOpps,
      customers_overdue: customersOverdue,
      dormant_customers: dormant,
    },
  });
}
