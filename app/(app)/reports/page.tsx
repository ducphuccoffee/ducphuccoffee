import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ReportsClient } from "@/components/reports/ReportsClient";

export default async function ReportsPage() {
  const supabase = await createServerSupabaseClient();

  const now = new Date();
  const months: { label: string; from: string; to: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const from = d.toISOString();
    const to = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();
    months.push({
      label: `${d.getMonth() + 1}/${d.getFullYear()}`,
      from,
      to,
    });
  }

  const { data: allOrders } = await supabase
    .from("orders")
    .select("id, total_amount, status, created_at, customer_name")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });

  const { data: allProducts } = await supabase
    .from("products")
    .select("id, name, price, unit")
    .eq("is_active", true);

  const { data: topItems } = await supabase
    .from("order_items")
    .select("product_name, qty, subtotal");

  // Group revenue by month
  const revenueByMonth: Record<string, number> = {};
  const orderCountByMonth: Record<string, number> = {};
  for (const m of months) {
    revenueByMonth[m.label] = 0;
    orderCountByMonth[m.label] = 0;
  }
  for (const o of allOrders || []) {
    const d = new Date(o.created_at);
    const key = `${d.getMonth() + 1}/${d.getFullYear()}`;
    if (key in revenueByMonth) {
      revenueByMonth[key] += Number(o.total_amount) || 0;
      orderCountByMonth[key] += 1;
    }
  }

  // Top products by revenue
  const prodRevMap: Record<string, number> = {};
  const prodQtyMap: Record<string, number> = {};
  for (const it of topItems || []) {
    const k = it.product_name || "Khác";
    prodRevMap[k] = (prodRevMap[k] || 0) + (Number(it.subtotal) || 0);
    prodQtyMap[k] = (prodQtyMap[k] || 0) + (Number(it.qty) || 0);
  }
  const topProducts = Object.entries(prodRevMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, revenue]) => ({ name, revenue, qty: prodQtyMap[name] || 0 }));

  // Top customers
  const custMap: Record<string, number> = {};
  for (const o of allOrders || []) {
    const k = o.customer_name || "Không rõ";
    custMap[k] = (custMap[k] || 0) + (Number(o.total_amount) || 0);
  }
  const topCustomers = Object.entries(custMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, total]) => ({ name, total }));

  const totalRevenue = Object.values(revenueByMonth).reduce((s, v) => s + v, 0);
  const totalOrders = (allOrders || []).length;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="px-6 pt-6 pb-2">
        <h1 className="text-2xl font-semibold text-gray-800">Báo cáo</h1>
        <p className="text-sm text-gray-500 mt-1">Tổng quan doanh thu 6 tháng gần nhất</p>
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
