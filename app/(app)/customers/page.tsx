import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CustomersClient } from "@/components/customers/CustomersClient";

export default async function CustomersPage() {
  const supabase = createServerSupabaseClient();

  const [{ data: customers }, { data: orderStats }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, phone, address, created_at")
      .order("name"),
    supabase
      .from("orders")
      .select("customer_id, total_amount, status"),
  ]);

  // build spend map keyed by customer_id (correct foreign key)
  const spendMap: Record<string, number> = {};
  const countMap: Record<string, number> = {};
  for (const o of orderStats || []) {
    if (!o.customer_id) continue;
    spendMap[o.customer_id] = (spendMap[o.customer_id] || 0) + (Number(o.total_amount) || 0);
    countMap[o.customer_id] = (countMap[o.customer_id] || 0) + 1;
  }

  const enriched = (customers || []).map((c: any) => ({
    ...c,
    total_spend: spendMap[c.id] || 0,
    order_count: countMap[c.id] || 0,
  }));

  return (
    <div className="mx-auto max-w-5xl">
      <div className="px-6 pt-6 pb-2">
        <h1 className="text-2xl font-semibold text-gray-800">Khách hàng</h1>
        <p className="text-sm text-gray-500 mt-1">Danh sách và lịch sử mua hàng</p>
      </div>
      <CustomersClient initialCustomers={enriched} />
    </div>
  );
}
