import { createClient } from "@supabase/supabase-js";

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

export interface CrmUser {
  id: string;
  role: string; // "admin" | "manager" | "sales" | ...
}

export interface CrmDashboardData {
  myCustomers: number;
  followUpToday: number;
  ordersToday: number;
  revenueToday: number;
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  type: "order" | "note" | "visit";
  label: string;
  sub: string;
  ts: string;
}

function isAdmin(user: CrmUser) {
  return user.role === "admin" || user.role === "manager";
}

export async function getCrmDashboardData(user: CrmUser): Promise<CrmDashboardData> {
  const db = svc();
  const admin = isAdmin(user);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();

  // 1) My customers (or all if admin)
  let custQ = db.from("customers").select("id", { count: "exact", head: true });
  if (!admin) custQ = custQ.eq("assigned_user_id", user.id);
  const { count: myCustomers } = await custQ;

  // 2) Follow-ups due today
  let fuQ = db.from("customers").select("id", { count: "exact", head: true })
    .lte("next_follow_up_at", new Date().toISOString())
    .not("next_follow_up_at", "is", null);
  if (!admin) fuQ = fuQ.eq("assigned_user_id", user.id);
  const { count: followUpToday } = await fuQ;

  // 3) Orders today
  let ordQ = db.from("orders").select("id,total_amount", { count: "exact" })
    .gte("created_at", todayISO);
  if (!admin) ordQ = ordQ.eq("owner_user_id", user.id);
  const { data: todayOrders, count: ordersToday } = await ordQ;

  const revenueToday = (todayOrders || []).reduce(
    (s, o) => s + (Number(o.total_amount) || 0), 0
  );

  // 4) Recent activity (last 10 combined orders + notes + visits)
  const [ordRes, noteRes, visitRes] = await Promise.all([
    (() => {
      let q = db.from("orders")
        .select("id, total_amount, created_at, customers(name)")
        .order("created_at", { ascending: false }).limit(5);
      if (!admin) q = q.eq("owner_user_id", user.id);
      return q;
    })(),
    (() => {
      let q = db.from("customer_notes")
        .select("id, content, created_at, customers(name)")
        .order("created_at", { ascending: false }).limit(5);
      if (!admin) q = q.eq("created_by", user.id);
      return q;
    })(),
    (() => {
      let q = db.from("sales_visits")
        .select("id, note, check_in_time, status, customers(name)")
        .order("check_in_time", { ascending: false }).limit(5);
      if (!admin) q = q.eq("user_id", user.id);
      return q;
    })(),
  ]);

  const activity: ActivityItem[] = [
    ...(ordRes.data || []).map((o: any) => ({
      type: "order" as const,
      label: `Đơn hàng – ${(o.customers as any)?.name ?? "—"}`,
      sub: `${Number(o.total_amount).toLocaleString("vi-VN")} ₫`,
      ts: o.created_at,
    })),
    ...(noteRes.data || []).map((n: any) => ({
      type: "note" as const,
      label: `Ghi chú – ${(n.customers as any)?.name ?? "—"}`,
      sub: String(n.content).slice(0, 60),
      ts: n.created_at,
    })),
    ...(visitRes.data || []).map((v: any) => ({
      type: "visit" as const,
      label: `Visit – ${(v.customers as any)?.name ?? "—"}`,
      sub: v.status,
      ts: v.check_in_time,
    })),
  ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, 10);

  return {
    myCustomers:  myCustomers  ?? 0,
    followUpToday: followUpToday ?? 0,
    ordersToday:  ordersToday  ?? 0,
    revenueToday,
    recentActivity: activity,
  };
}
