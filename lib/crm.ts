import { createClient } from "@supabase/supabase-js";
import {
  computeAttentionStatus,
  computeCrmSegment,
  daysSince,
  overdueDays,
  type AttentionStatus,
  type CrmSegment,
  CRM_THRESHOLDS,
} from "./crm-automation";

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

export interface CrmUser {
  id: string;
  role: string;
}

export interface ActivityItem {
  type: "order" | "note" | "visit";
  label: string;
  sub: string;
  ts: string;
}

export interface RiskCustomer {
  customer_id: string;
  customer_name: string;
  phone: string | null;
  assigned_user_id: string | null;
  attention_status: AttentionStatus;
  days_since_last_order: number | null;
  last_order_date: string | null;
  total_orders: number;
  total_revenue: number;
  next_follow_up_at: string | null;
  overdue_days: number | null;
}

export interface CrmDashboardData {
  // KPIs
  myCustomers:    number;
  followUpToday:  number;
  overdueFollowUp: number;
  ordersToday:    number;
  revenueToday:   number;
  // Alerts
  atRiskCustomers:   RiskCustomer[];
  overdueCustomers:  RiskCustomer[];
  dueFollowUps:      RiskCustomer[];
  // Activity feed
  recentActivity: ActivityItem[];
}

function isAdmin(user: CrmUser) {
  return user.role === "admin" || user.role === "manager";
}

export async function getCrmDashboardData(user: CrmUser): Promise<CrmDashboardData> {
  const db    = svc();
  const admin = isAdmin(user);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();
  const now = new Date().toISOString();

  // ── Fetch customers with CRM fields ────────────────────────────────────
  let custQ = db
    .from("customers")
    .select("id, name, phone, assigned_user_id, next_follow_up_at, crm_status");
  if (!admin) custQ = custQ.eq("assigned_user_id", user.id);
  const { data: customers } = await custQ;

  // ── Fetch all orders for these customers ──────────────────────────────
  const customerIds = (customers ?? []).map((c: any) => c.id);
  let ordersAll: any[] = [];
  if (customerIds.length > 0) {
    const { data } = await db
      .from("orders")
      .select("id, customer_id, total_amount, created_at")
      .in("customer_id", customerIds);
    ordersAll = data ?? [];
  }

  // Build per-customer metrics map
  const metricsMap: Record<string, { count: number; revenue: number; lastOrder: string | null }> = {};
  for (const o of ordersAll) {
    const cid = o.customer_id;
    if (!cid) continue;
    if (!metricsMap[cid]) metricsMap[cid] = { count: 0, revenue: 0, lastOrder: null };
    metricsMap[cid].count++;
    metricsMap[cid].revenue += Number(o.total_amount) || 0;
    if (!metricsMap[cid].lastOrder || o.created_at > metricsMap[cid].lastOrder!) {
      metricsMap[cid].lastOrder = o.created_at;
    }
  }

  // ── Build risk items from customers ────────────────────────────────────
  const riskItems: RiskCustomer[] = (customers ?? []).map((c: any) => {
    const m = metricsMap[c.id] ?? { count: 0, revenue: 0, lastOrder: null };
    const dslOrder = daysSince(m.lastOrder);
    return {
      customer_id:         c.id,
      customer_name:       c.name,
      phone:               c.phone,
      assigned_user_id:    c.assigned_user_id,
      attention_status:    computeAttentionStatus(dslOrder, c.next_follow_up_at, m.count),
      days_since_last_order: dslOrder,
      last_order_date:     m.lastOrder,
      total_orders:        m.count,
      total_revenue:       m.revenue,
      next_follow_up_at:   c.next_follow_up_at,
      overdue_days:        overdueDays(c.next_follow_up_at),
    };
  });

  // ── KPI counts ─────────────────────────────────────────────────────────
  const myCustomers     = customers?.length ?? 0;
  const followUpToday   = riskItems.filter(
    r => r.next_follow_up_at && r.next_follow_up_at <= now
  ).length;
  const overdueFollowUp = riskItems.filter(r => r.overdue_days !== null).length;

  // ── Alert lists ────────────────────────────────────────────────────────
  const atRiskCustomers = riskItems
    .filter(r => r.attention_status === "at_risk" || r.attention_status === "churn_risk")
    .sort((a, b) => (b.days_since_last_order ?? 0) - (a.days_since_last_order ?? 0))
    .slice(0, 10);

  const overdueCustomers = riskItems
    .filter(r => r.attention_status === "overdue_followup")
    .sort((a, b) => (b.overdue_days ?? 0) - (a.overdue_days ?? 0))
    .slice(0, 10);

  const dueFollowUps = riskItems
    .filter(r => r.next_follow_up_at && r.next_follow_up_at >= todayISO && r.next_follow_up_at <= now)
    .slice(0, 10);

  // ── Orders today (with revenue) ────────────────────────────────────────
  let ordTodayQ = db
    .from("orders")
    .select("id, total_amount", { count: "exact" })
    .gte("created_at", todayISO);
  if (!admin) ordTodayQ = ordTodayQ.eq("owner_user_id", user.id);
  const { data: todayOrders, count: ordersToday } = await ordTodayQ;
  const revenueToday = (todayOrders ?? []).reduce(
    (s: number, o: any) => s + (Number(o.total_amount) || 0), 0
  );

  // ── Recent activity ────────────────────────────────────────────────────
  const [ordRes, noteRes, visitRes] = await Promise.all([
    (() => {
      let q = db
        .from("orders")
        .select("id, total_amount, created_at, customers(name)")
        .order("created_at", { ascending: false })
        .limit(5);
      if (!admin) q = q.eq("owner_user_id", user.id);
      return q;
    })(),
    (() => {
      let q = db
        .from("customer_notes")
        .select("id, content, created_at, customers(name)")
        .order("created_at", { ascending: false })
        .limit(5);
      if (!admin) q = q.eq("created_by", user.id);
      return q;
    })(),
    (() => {
      let q = db
        .from("sales_visits")
        .select("id, note, check_in_time, status, customers(name)")
        .order("check_in_time", { ascending: false })
        .limit(5);
      if (!admin) q = q.eq("user_id", user.id);
      return q;
    })(),
  ]);

  const recentActivity: ActivityItem[] = [
    ...(ordRes.data ?? []).map((o: any) => ({
      type:  "order" as const,
      label: `Đơn hàng – ${(o.customers as any)?.name ?? "—"}`,
      sub:   `${Number(o.total_amount).toLocaleString("vi-VN")} ₫`,
      ts:    o.created_at,
    })),
    ...(noteRes.data ?? []).map((n: any) => ({
      type:  "note" as const,
      label: `Ghi chú – ${(n.customers as any)?.name ?? "—"}`,
      sub:   String(n.content).slice(0, 60),
      ts:    n.created_at,
    })),
    ...(visitRes.data ?? []).map((v: any) => ({
      type:  "visit" as const,
      label: `Visit – ${(v.customers as any)?.name ?? "—"}`,
      sub:   v.status,
      ts:    v.check_in_time,
    })),
  ]
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    .slice(0, 10);

  return {
    myCustomers,
    followUpToday,
    overdueFollowUp,
    ordersToday:    ordersToday ?? 0,
    revenueToday,
    atRiskCustomers,
    overdueCustomers,
    dueFollowUps,
    recentActivity,
  };
}
