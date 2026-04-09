import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CustomersClient } from "@/components/customers/CustomersClient";

export default async function CustomersPage() {
  const supabase = await createServerSupabaseClient();

  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, phone, address, created_at")
    .order("name");

  const { data: orderStats } = await supabase
    .from("orders")
    .select("customer_name, total_amount, status");

  // build spend map
  const spendMap: Record<string, number> = {};
  const countMap: Record<string, number> = {};
  for (const o of orderStats || []) {
    if (!o.customer_name) continue;
    spendMap[o.customer_name] = (spendMap[o.customer_name] || 0) + (Number(o.total_amount) || 0);
    countMap[o.customer_name] = (countMap[o.customer_name] || 0) + 1;
  }

  const enriched = (customers || []).map((c: any) => ({
    ...c,
    total_spend: spendMap[c.name] || 0,
    order_count: countMap[c.name] || 0,
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
