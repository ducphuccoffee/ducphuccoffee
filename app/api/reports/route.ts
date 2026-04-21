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

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const ownerId = searchParams.get("owner_user_id");
  const orgId = member.org_id;

  if (!type) return NextResponse.json({ error: "Thiếu ?type=" }, { status: 400 });

  switch (type) {
    case "revenue": return handleRevenue(supabase, orgId, isAdmin, user.id, from, to, ownerId);
    case "debt":    return handleDebt(supabase, orgId);
    case "sales":   return handleSales(supabase, orgId, from, to);
    case "stock":   return handleStock(supabase, orgId);
    case "crm":     return handleCrm(supabase, orgId, isAdmin, user.id, from, to);
    default: return NextResponse.json({ error: `type không hợp lệ: ${type}` }, { status: 400 });
  }
}

async function handleRevenue(supabase: any, orgId: string, isAdmin: boolean, userId: string, from: string | null, to: string | null, ownerId: string | null) {
  const VALID = ["accepted", "delivered", "completed"];

  let q = supabase
    .from("orders")
    .select("id, order_code, customer_id, total_amount, total_qty_kg, owner_user_id, status, created_at, customers(name)")
    .eq("org_id", orgId)
    .in("status", VALID)
    .order("created_at", { ascending: false });

  if (from) q = q.gte("created_at", from);
  if (to) q = q.lte("created_at", to);
  if (ownerId) q = q.eq("owner_user_id", ownerId);

  const { data: orders, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const list = orders ?? [];
  const totalRevenue = list.reduce((s: number, o: any) => s + Number(o.total_amount ?? 0), 0);
  const totalOrders = list.length;
  const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // By day
  const byDay: Record<string, { revenue: number; count: number }> = {};
  for (const o of list) {
    const day = o.created_at?.slice(0, 10) ?? "unknown";
    if (!byDay[day]) byDay[day] = { revenue: 0, count: 0 };
    byDay[day].revenue += Number(o.total_amount ?? 0);
    byDay[day].count++;
  }

  // By sale
  const bySale: Record<string, { revenue: number; count: number }> = {};
  for (const o of list) {
    const uid = o.owner_user_id ?? "unknown";
    if (!bySale[uid]) bySale[uid] = { revenue: 0, count: 0 };
    bySale[uid].revenue += Number(o.total_amount ?? 0);
    bySale[uid].count++;
  }

  // By customer
  const byCust: Record<string, { name: string; revenue: number; count: number }> = {};
  for (const o of list) {
    const cid = o.customer_id ?? "unknown";
    if (!byCust[cid]) byCust[cid] = { name: o.customers?.name ?? cid, revenue: 0, count: 0 };
    byCust[cid].revenue += Number(o.total_amount ?? 0);
    byCust[cid].count++;
  }

  // By product (order_items)
  const orderIds = list.map((o: any) => o.id);
  let byProduct: Record<string, { name: string; revenue: number; qty_kg: number }> = {};
  if (orderIds.length > 0) {
    const { data: items } = await supabase
      .from("order_items")
      .select("product_id, qty_kg, subtotal, products(name)")
      .in("order_id", orderIds.slice(0, 200));
    for (const it of items ?? []) {
      const pid = it.product_id ?? "unknown";
      if (!byProduct[pid]) byProduct[pid] = { name: it.products?.name ?? pid, revenue: 0, qty_kg: 0 };
      byProduct[pid].revenue += Number(it.subtotal ?? 0);
      byProduct[pid].qty_kg += Number(it.qty_kg ?? 0);
    }
  }

  // Enrich sale names
  const saleIds = Object.keys(bySale);
  let saleNames: Record<string, string> = {};
  if (saleIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", saleIds);
    for (const p of profiles ?? []) saleNames[p.id] = p.full_name || p.id;
  }

  return NextResponse.json({
    ok: true,
    data: {
      kpi: { total_revenue: totalRevenue, total_orders: totalOrders, avg_order: Math.round(avgOrder) },
      by_day: Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([day, v]) => ({ day, ...v })),
      by_sale: Object.entries(bySale).sort(([, a], [, b]) => b.revenue - a.revenue).map(([uid, v]) => ({ user_id: uid, name: saleNames[uid] ?? uid.slice(0, 8), ...v })),
      by_customer: Object.values(byCust).sort((a, b) => b.revenue - a.revenue).slice(0, 20),
      by_product: Object.values(byProduct).sort((a, b) => b.revenue - a.revenue).slice(0, 20),
      orders: list.slice(0, 50),
    },
  });
}

async function handleDebt(supabase: any, orgId: string) {
  const { data, error } = await supabase.from("v_customer_debt").select("*").eq("org_id", orgId).order("debt_amount", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const now = Date.now();
  const DAY = 86_400_000;
  const rows = (data ?? []).map((r: any) => {
    const debtAmt = Number(r.debt_amount ?? 0);
    const daysSince = r.last_order_at ? Math.floor((now - new Date(r.last_order_at).getTime()) / DAY) : 999;
    let bucket: string;
    if (daysSince <= 7) bucket = "0-7";
    else if (daysSince <= 30) bucket = "8-30";
    else if (daysSince <= 60) bucket = "31-60";
    else bucket = ">60";
    return {
      customer_id: r.customer_id,
      customer_name: r.customer_name,
      customer_phone: r.customer_phone,
      total_ordered: Number(r.total_ordered ?? 0),
      total_paid: Number(r.total_paid ?? 0),
      debt_amount: debtAmt,
      order_count: Number(r.order_count ?? 0),
      last_order_at: r.last_order_at,
      days_since_last_order: daysSince,
      bucket,
      is_overdue: daysSince > 30 && debtAmt > 0,
      is_high_debt: debtAmt >= 10_000_000,
    };
  });

  const totalDebt = rows.reduce((s: number, r: any) => s + r.debt_amount, 0);
  const buckets: Record<string, number> = { "0-7": 0, "8-30": 0, "31-60": 0, ">60": 0 };
  for (const r of rows) buckets[r.bucket] = (buckets[r.bucket] ?? 0) + r.debt_amount;

  return NextResponse.json({
    ok: true,
    data: {
      kpi: { total_debt: totalDebt, total_customers: rows.length, overdue_count: rows.filter((r: any) => r.is_overdue).length, high_debt_count: rows.filter((r: any) => r.is_high_debt).length },
      buckets,
      rows,
    },
  });
}

async function handleSales(supabase: any, orgId: string, from: string | null, to: string | null) {
  // Orders
  let oq = supabase.from("orders").select("owner_user_id, total_amount").eq("org_id", orgId).in("status", ["accepted", "delivered", "completed"]);
  if (from) oq = oq.gte("created_at", from);
  if (to) oq = oq.lte("created_at", to);
  const { data: orders } = await oq;

  // Commissions
  let cq = supabase.from("commissions").select("beneficiary_user_id, amount, status").eq("org_id", orgId);
  if (from) cq = cq.gte("created_at", from);
  if (to) cq = cq.lte("created_at", to);
  const { data: comms } = await cq;

  // Leads
  let lq = supabase.from("leads").select("owner_user_id, status").eq("org_id", orgId);
  if (from) lq = lq.gte("created_at", from);
  if (to) lq = lq.lte("created_at", to);
  const { data: leads } = await lq;

  // Opportunities
  let opq = supabase.from("opportunities").select("owner_user_id, stage, expected_value").eq("org_id", orgId);
  if (from) opq = opq.gte("created_at", from);
  if (to) opq = opq.lte("created_at", to);
  const { data: opps } = await opq;

  // Aggregate per user
  const users: Record<string, { revenue: number; orders: number; comm_total: number; comm_pending: number; comm_paid: number; leads: number; converted: number; opps: number; opp_value: number }> = {};
  const ensure = (uid: string) => { if (!users[uid]) users[uid] = { revenue: 0, orders: 0, comm_total: 0, comm_pending: 0, comm_paid: 0, leads: 0, converted: 0, opps: 0, opp_value: 0 }; };

  for (const o of orders ?? []) { const u = o.owner_user_id; if (!u) continue; ensure(u); users[u].revenue += Number(o.total_amount ?? 0); users[u].orders++; }
  for (const c of comms ?? []) { const u = c.beneficiary_user_id; if (!u) continue; ensure(u); users[u].comm_total += Number(c.amount ?? 0); if (c.status === "pending") users[u].comm_pending += Number(c.amount ?? 0); else users[u].comm_paid += Number(c.amount ?? 0); }
  for (const l of leads ?? []) { const u = l.owner_user_id; if (!u) continue; ensure(u); users[u].leads++; if (l.status === "converted") users[u].converted++; }
  for (const op of opps ?? []) { const u = op.owner_user_id; if (!u) continue; ensure(u); users[u].opps++; users[u].opp_value += Number(op.expected_value ?? 0); }

  // Names
  const uids = Object.keys(users);
  let names: Record<string, string> = {};
  if (uids.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", uids);
    for (const p of profiles ?? []) names[p.id] = p.full_name || p.id;
  }

  const rows = Object.entries(users)
    .map(([uid, v]) => ({ user_id: uid, name: names[uid] ?? uid.slice(0, 8), ...v, conversion_rate: v.leads > 0 ? Math.round(v.converted / v.leads * 100) : 0 }))
    .sort((a, b) => b.revenue - a.revenue);

  return NextResponse.json({ ok: true, data: { rows } });
}

async function handleStock(supabase: any, orgId: string) {
  // Green stock
  const { data: green } = await supabase.from("v_green_stock").select("*").eq("org_id", orgId).order("remaining_kg", { ascending: false });

  // Product (roasted) stock from v_onhand_by_lot_ui
  const { data: roasted } = await supabase.from("v_onhand_by_lot_ui").select("*").eq("org_id", orgId).order("qty_onhand_kg", { ascending: false });

  // Recent ledger
  const { data: ledger } = await supabase.from("inventory_ledger").select("*").eq("org_id", orgId).order("occurred_at", { ascending: false }).limit(30);

  // Products for reference
  const { data: products } = await supabase.from("products").select("id, name").eq("org_id", orgId);
  const prodMap: Record<string, string> = {};
  for (const p of products ?? []) prodMap[p.id] = p.name;

  // Aggregate green by type
  const greenByType: Record<string, { name: string; total_kg: number; lots: number }> = {};
  for (const g of green ?? []) {
    const tid = g.green_type_id ?? "unknown";
    if (!greenByType[tid]) greenByType[tid] = { name: g.green_type_name ?? tid, total_kg: 0, lots: 0 };
    greenByType[tid].total_kg += Number(g.remaining_kg ?? 0);
    greenByType[tid].lots++;
  }

  // Aggregate roasted by product
  const roastedByProduct: Record<string, { name: string; total_kg: number; lots: number }> = {};
  for (const r of roasted ?? []) {
    const pid = r.item_id ?? "unknown";
    if (!roastedByProduct[pid]) roastedByProduct[pid] = { name: r.item_name ?? prodMap[pid] ?? pid, total_kg: 0, lots: 0 };
    roastedByProduct[pid].total_kg += Number(r.qty_onhand_kg ?? 0);
    roastedByProduct[pid].lots++;
  }

  const LOW_STOCK_KG = 5;
  const totalGreenKg = Object.values(greenByType).reduce((s, g) => s + g.total_kg, 0);
  const totalRoastedKg = Object.values(roastedByProduct).reduce((s, r) => s + r.total_kg, 0);
  const lowStockProducts = Object.values(roastedByProduct).filter(r => r.total_kg < LOW_STOCK_KG && r.total_kg > 0);

  return NextResponse.json({
    ok: true,
    data: {
      kpi: { total_green_kg: totalGreenKg, total_roasted_kg: totalRoastedKg, low_stock_count: lowStockProducts.length },
      green: Object.values(greenByType).sort((a, b) => b.total_kg - a.total_kg),
      roasted: Object.values(roastedByProduct).sort((a, b) => b.total_kg - a.total_kg),
      low_stock: lowStockProducts,
      recent_movements: (ledger ?? []).map((l: any) => ({ ...l, item_name: prodMap[l.item_id] ?? l.item_id })),
    },
  });
}

async function handleCrm(supabase: any, orgId: string, isAdmin: boolean, userId: string, from: string | null, to: string | null) {
  const ownerFilter = (q: any) => isAdmin ? q : q.eq("owner_user_id", userId);

  // Leads
  let lq = ownerFilter(supabase.from("leads").select("id, status, temperature, created_at").eq("org_id", orgId));
  if (from) lq = lq.gte("created_at", from);
  if (to) lq = lq.lte("created_at", to);
  const { data: leads } = await lq;

  const leadsByStatus: Record<string, number> = {};
  const leadsByTemp: Record<string, number> = {};
  for (const l of leads ?? []) {
    leadsByStatus[l.status] = (leadsByStatus[l.status] ?? 0) + 1;
    leadsByTemp[l.temperature] = (leadsByTemp[l.temperature] ?? 0) + 1;
  }

  // Opportunities
  let oq = ownerFilter(supabase.from("opportunities").select("id, stage, expected_value").eq("org_id", orgId));
  if (from) oq = oq.gte("created_at", from);
  if (to) oq = oq.lte("created_at", to);
  const { data: opps } = await oq;

  const oppsByStage: Record<string, { count: number; value: number }> = {};
  for (const o of opps ?? []) {
    if (!oppsByStage[o.stage]) oppsByStage[o.stage] = { count: 0, value: 0 };
    oppsByStage[o.stage].count++;
    oppsByStage[o.stage].value += Number(o.expected_value ?? 0);
  }

  // Overdue follow-ups
  const now = new Date();
  const todayISO = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const { data: overdueTasks, count: overdueCount } = await supabase
    .from("tasks").select("id", { count: "exact" })
    .eq("org_id", orgId).eq("owner_user_id", userId)
    .in("type", ["crm_followup", "visit", "quotation_followup", "debt_followup"])
    .in("status", ["todo", "in_progress"])
    .lt("due_at", todayISO);

  // Visits
  let vq = ownerFilter(supabase.from("sfa_visits").select("id", { count: "exact" }).eq("org_id", orgId));
  if (from) vq = vq.gte("checkin_at", from);
  if (to) vq = vq.lte("checkin_at", to);
  const { count: visitCount } = await vq;

  // Activities
  let aq = ownerFilter(supabase.from("crm_activities").select("id, type, content, created_at").eq("org_id", orgId));
  if (from) aq = aq.gte("created_at", from);
  if (to) aq = aq.lte("created_at", to);
  const { data: activities } = await aq.order("created_at", { ascending: false }).limit(20);

  return NextResponse.json({
    ok: true,
    data: {
      kpi: { total_leads: (leads ?? []).length, total_opps: (opps ?? []).length, overdue_followups: overdueCount ?? 0, visits: visitCount ?? 0 },
      leads_by_status: leadsByStatus,
      leads_by_temperature: leadsByTemp,
      opps_by_stage: oppsByStage,
      recent_activities: activities ?? [],
    },
  });
}
