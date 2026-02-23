import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { DevSeedButton } from "@/components/DevSeedButton";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrdersClient } from "@/components/orders/OrdersClient";
import type { Order, Customer, Product } from "@/lib/types";

export default async function OrdersPage() {
  const supabase = await createServerSupabaseClient();

  // Orders (latest 50)
  const { data: ordersRaw } = await supabase
    .from("orders")
    .select("id, order_code, customer_id, total_amount, cost_amount, profit, status, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  // Customers + products for create form
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, phone, email, address, credit_limit, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const { data: products } = await supabase
    .from("products")
    .select("id, name, sku, type, unit, cost_price, sell_price, is_active, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(200);

  // Map customer_id -> name for list
  const cMap = new Map<string, string>();
  (customers || []).forEach((c: any) => cMap.set(c.id, c.name));

  const orders: Order[] = (ordersRaw || []).map((o: any) => ({
    ...o,
    customer_name: o.customer_id ? cMap.get(o.customer_id) || null : null,
  }));

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Đơn hàng</h1>
            <p className="mt-1 text-sm text-zinc-600">Theo dõi doanh thu, giá vốn, lợi nhuận</p>
          </div>
          <div className="text-xs text-zinc-500">Supabase • Vercel</div>
        </div>

        <div className="mt-6">
          <Card>
            <div className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-base font-semibold">Danh sách đơn hàng</div>
                  <div className="text-sm text-zinc-600">MVP: hiển thị 50 đơn mới nhất</div>
                </div>
                <DevSeedButton />
              </div>

              <OrdersClient
                initial={orders}
                customers={(customers || []) as Customer[]}
                products={(products || []) as Product[]}
              />

              <div className="mt-4 text-xs text-zinc-500">
                Tiếp theo: chi tiết đơn + auto inventory OUT + công nợ.
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
