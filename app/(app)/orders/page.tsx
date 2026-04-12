import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OrdersClient } from "@/components/orders/OrdersClient";
import type { Product, Customer } from "@/components/orders/OrdersClient";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const supabase = await createServerSupabaseClient();

  const [{ data: ordersRaw }, { data: productsRaw }, { data: customersRaw }] = await Promise.all([
    supabase
      .from("orders")
      .select(`
        id, org_id, customer_id, status, payment_status, payment_method,
        total_qty_kg, total_amount, note, order_code, created_by, created_at,
        customers(id, name, phone),
        order_items(id, product_id, product_name, unit, qty, unit_price, subtotal)
      `)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("products").select("id, name, sku, unit, price").eq("is_active", true).order("name"),
    supabase.from("customers").select("id, name, phone, address").order("name"),
  ]);

  const products: Product[] = (productsRaw || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    sku: p.sku ?? null,
    unit: p.unit ?? "kg",
    price: Number(p.price) || 0,
  }));

  const customers: Customer[] = (customersRaw || []).map((c: any) => ({
    id: c.id, name: c.name, phone: c.phone ?? null, address: c.address ?? null,
  }));

  const orders = (ordersRaw || []).map((o: any) => ({
    id:             o.id,
    // Use stored order_code if available, otherwise derive from id
    order_code:     o.order_code || `#${o.id.slice(0, 8).toUpperCase()}`,
    customer_id:    o.customer_id,
    customer_name:  o.customers?.name ?? (o.customer_name ?? "—"),
    customer_phone: o.customers?.phone ?? null,
    status:         o.status ?? "new",
    payment_status: o.payment_status ?? "unpaid",
    payment_method: o.payment_method ?? "cash",
    total_amount:   o.total_amount,
    total_qty_kg:   o.total_qty_kg,
    note:           o.note ?? null,
    created_at:     o.created_at,
    order_items:    (o.order_items || []).map((it: any) => ({
      id:           it.id,
      product_id:   it.product_id,
      product_name: it.product_name ?? "",
      unit:         it.unit ?? "kg",
      qty:          it.qty,
      unit_price:   it.unit_price,
      subtotal:     it.subtotal,
    })),
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="px-4 pt-5 pb-2">
        <h1 className="text-xl font-bold text-gray-800">Đơn hàng</h1>
        <p className="text-sm text-gray-500 mt-0.5">Quản lý đơn hàng và theo dõi trạng thái giao hàng</p>
      </div>
      <OrdersClient
        initialOrders={orders as any}
        products={products}
        initialCustomers={customers}
      />
    </div>
  );
}
