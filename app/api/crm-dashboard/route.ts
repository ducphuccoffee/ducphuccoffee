import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";

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
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  // Parallel queries
  const ownerFilter = (q: any) => isAdmin ? q : q.eq("owner_user_id", user.id);

  const [
    leadsMonthRes, leadsConvertedRes,
    oppsRes, oppsWonRes,
    tasksRes,
    visitsRes, activitiesRes,
    ordersMonthRes,
  ] = await Promise.all([
    // Leads this month
    ownerFilter(supabase.from("leads").select("id", { count: "exact" }).eq("org_id", orgId).gte("created_at", monthStart)),
    // Converted leads this month
    ownerFilter(supabase.from("leads").select("id", { count: "exact" }).eq("org_id", orgId).eq("status", "converted").gte("updated_at", monthStart)),
    // All active opportunities
    ownerFilter(supabase.from("opportunities").select("id, stage, expected_value").eq("org_id", orgId).not("stage", "in", "(won,lost)")),
    // Won opportunities this month
    ownerFilter(supabase.from("opportunities").select("id, expected_value", { count: "exact" }).eq("org_id", orgId).eq("stage", "won").gte("updated_at", monthStart)),
    // Tasks for current user (overdue + today + upcoming)
    supabase.from("tasks").select("id, type, status, description, lead_id, customer_id, owner_user_id, due_at, created_at")
      .eq("org_id", orgId)
      .eq("owner_user_id", user.id)
      .in("status", ["todo", "in_progress"])
      .in("type", ["crm_followup", "visit", "quotation_followup", "debt_followup"])
      .order("due_at", { ascending: true })
      .limit(50),
    // Visits today
    ownerFilter(supabase.from("sfa_visits").select("id", { count: "exact" }).eq("org_id", orgId).gte("checkin_at", todayISO)),
    // Activities today
    ownerFilter(supabase.from("crm_activities").select("id, type", { count: "exact" }).eq("org_id", orgId).gte("created_at", todayISO)),
    // Revenue this month
    ownerFilter(supabase.from("orders").select("total_amount").eq("org_id", orgId).gte("created_at", monthStart).in("status", ["accepted", "delivered", "completed"])),
  ]);

  // KPIs
  const totalLeads = leadsMonthRes.count ?? 0;
  const convertedLeads = leadsConvertedRes.count ?? 0;
  const totalOpps = (oppsRes.data ?? []).length;
  const wonDeals = oppsWonRes.count ?? 0;
  const wonRevenue = (oppsWonRes.data ?? []).reduce((s: number, o: any) => s + Number(o.expected_value ?? 0), 0);
  const orderRevenue = (ordersMonthRes.data ?? []).reduce((s: number, o: any) => s + Number(o.total_amount ?? 0), 0);
  const visitsToday = visitsRes.count ?? 0;
  const callsToday = (activitiesRes.data ?? []).filter((a: any) => a.type === "call").length;

  // Pipeline
  const stages = ["new", "consulting", "demo", "quoted", "negotiating"];
  const pipeline: Record<string, { count: number; value: number }> = {};
  for (const s of stages) pipeline[s] = { count: 0, value: 0 };
  for (const opp of oppsRes.data ?? []) {
    if (pipeline[opp.stage]) {
      pipeline[opp.stage].count++;
      pipeline[opp.stage].value += Number(opp.expected_value ?? 0);
    }
  }

  // Tasks grouped
  const tasks = tasksRes.data ?? [];
  const overdue: any[] = [];
  const today: any[] = [];
  const upcoming: any[] = [];

  for (const t of tasks) {
    if (!t.due_at) {
      upcoming.push(t);
      continue;
    }
    const dueDate = new Date(t.due_at);
    if (dueDate < todayStart) overdue.push(t);
    else if (dueDate.toDateString() === now.toDateString()) today.push(t);
    else upcoming.push(t);
  }

  return NextResponse.json({
    ok: true,
    data: {
      kpi: {
        total_leads: totalLeads,
        converted_leads: convertedLeads,
        total_opportunities: totalOpps,
        won_deals: wonDeals,
        won_revenue: wonRevenue,
        order_revenue: orderRevenue,
        visits_today: visitsToday,
        calls_today: callsToday,
      },
      pipeline,
      tasks: { overdue, today, upcoming },
    },
  });
}
