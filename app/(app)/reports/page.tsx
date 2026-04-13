import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ReportsClient } from "@/components/reports/ReportsClient";

export const dynamic = "force-dynamic";

// Revenue statuses in current DB (order_status enum: draft, confirmed, delivered, closed)
const REVENUE_STATUSES = ["delivered", "closed"];
// Orders that count toward order count (confirmed and above)
const COUNT_STATUSES = ["confirmed", "delivered", "closed"];

export default async function ReportsPage() {
  const supabase = await createServerSupabaseClient();

  const now = new Date();
  const months: { label: string; from: string; to: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const from = d.toISOString();
    const to   = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();
    months.push({ label: `${d.getMonth() + 1}/${d.getFullYear()}`, from, to });
  }

  // Fetch revenue orders
  const { data: revenueOrders } = await supabase
    .from("orders")
    .select("id, total_amount, status, created_at, customers(name)")
    .in("status", REVENUE_STATUSES)
    .order("created_at", { ascending: false });

  // Fetch count orders
  const { data: countOrders } = await supabase
    .from("orders")
    .select("id, status, created_at")
    .in("status", COUNT_STATUSES)
    .order("created_at", { ascending: false });

  // Fetch all revenue orders for customer aggregation
  const { data: allActiveOrders } = await supabase
    .from("orders")
    .select("id, total_amount, status, customers(name)")
    .in("status", REVENUE_STATUSES);

  const { data: topItems } = await supabase
    .from("order_items")
    .select("product_name, qty, subtotal, order_id");

  const revenueOrderIds = new Set((revenueOrders || []).map((o: any) => o.id));
  const filteredItems = (topItems || []).filter((it: any) => revenueOrderIds.has(it.order_id));

  // Group revenue by month
  const revenueByMonth: Record<string, number>    = {};
  const orderCountByMonth: Record<string, number> = {};
  for (const m of months) {
    revenueByMonth[m.label]    = 0;
    orderCountByMonth[m.label] = 0;
  }

  for (const o of revenueOrders || []) {
    const d   = new Date(o.created_at);
    const key = `${d.getMonth() + 1}/${d.getFullYear()}`;
    if (key in revenueByMonth) {
      revenueByMonth[key] += Number(o.total_amount) || 0;
    }
  }

  for (const o of countOrders || []) {
    const d   = new Date(o.created_at);
    const key = `${d.getMonth() + 1}/${d.getFullYear()}`;
    if (key in orderCountByMonth) {
      orderCountByMonth[key] += 1;
    }
  }

  // Top products by revenue
  const prodRevMap: Record<string, number> = {};
  const prodQtyMap: Record<string, number> = {};
  for (const it of filteredItems) {
    const k = it.product_name || "Khác";
    prodRevMap[k] = (prodRevMap[k] || 0) + (Number(it.subtotal) || 0);
    prodQtyMap[k] = (prodQtyMap[k] || 0) + (Number(it.qty)     || 0);
  }
  const topProducts = Object.entries(prodRevMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, revenue]) => ({ name, revenue, qty: prodQtyMap[name] || 0 }));

  // Top customers by revenue
  const custMap: Record<string, number> = {};
  for (const o of allActiveOrders || []) {
    const k = (o.customers as any)?.name || "Không rõ";
    custMap[k] = (custMap[k] || 0) + (Number(o.total_amount) || 0);
  }
  const topCustomers = Object.entries(custMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, total]) => ({ name, total }));

  const totalRevenue = Object.values(revenueByMonth).reduce((s, v) => s + v, 0);
  const totalOrders  = (countOrders || []).length;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="px-4 pt-5 pb-2">
        <h1 className="text-xl font-bold text-gray-800">Báo cáo</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Doanh thu: tính từ đơn <strong>Đã giao + Đã đóng</strong> · Số đơn: tính từ đơn đã xác nhận trở lên
        </p>
      </div>
      <ReportsClient
        revenueByMonth={revenueByMonth}
        orderCountByMonth={orderCountByMonth}
        topProducts={topProducts}
        topCustomers={topCustomers}
        totalRevenue={totalRevenue}
        totalOrders={totalOrders}
      />
    </div>
  );
}
