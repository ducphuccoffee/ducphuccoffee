import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrdersClient } from "@/components/orders/OrdersClient";
import type { Product, Customer } from "@/components/orders/OrdersClient";

export default async function OrdersPage() {
  const supabase = await createServerSupabaseClient();

  const [{ data: ordersRaw }, { data: productsRaw }, { data: customersRaw }] = await Promise.all([
    supabase
      .from("orders")
      .select(`id, order_code, customer_name, customer_phone, status, note, total_amount, created_at,
        order_items(id, product_id, product_name, unit, qty, unit_price, subtotal)`)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("products").select("id, name, sku, unit, price").eq("is_active", true).order("name"),
    supabase.from("customers").select("id, name, phone, address").order("name"),
  ]);

  const products: Product[] = (productsRaw || []).map((p: any) => ({
    id: p.id, name: p.name, sku: p.sku ?? null, unit: p.unit ?? "kg", price: Number(p.price) || 0,
  }));
  const customers: Customer[] = (customersRaw || []).map((c: any) => ({
    id: c.id, name: c.name, phone: c.phone ?? null, address: c.address ?? null,
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="px-6 pt-6 pb-2">
        <h1 className="text-2xl font-semibold text-gray-800">\u0110\u01a1n h\u00e0ng</h1>
        <p className="text-sm text-gray-500 mt-1">Qu\u1ea3n l\u00fd \u0111\u01a1n h\u00e0ng v\u00e0 theo d\u00f5i tr\u1ea1ng th\u00e1i giao h\u00e0ng</p>
      </div>
      <OrdersClient
        initialOrders={(ordersRaw || []) as any}
        products={products}
        initialCustomers={customers}
      />
    </div>
  );
}
