import { TopBar } from "@/components/TopBar";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { InventoryInHistoryRow, Item, Supplier } from "@/lib/types";
import { InventoryInClient } from "@/components/inventory/InventoryInClient";

export default async function Page() {
  const supabase = createServerSupabaseClient();

  const suppliersRes = await supabase
    .from("suppliers")
    .select("id,name,phone,address,note,is_active,created_at")
    .eq("is_active", true)
    .order("name");

  const greensRes = await supabase
    .from("items")
    .select("id,name,sku,type")
    .eq("type", "green")
    .order("name");

  // History: join purchases + purchase_items + items + suppliers
  const historyRes = await supabase
    .from("purchase_items")
    .select("id, purchase_id, qty_kg, unit_price, line_total, purchases(purchased_at, lot_code, supplier_name, suppliers(name)), items(name)")
    .order("created_at", { ascending: false })
    .limit(200);

  const suppliers = (suppliersRes.data || []) as Supplier[];
  const greenItems = (greensRes.data || []) as Item[];

  const history: InventoryInHistoryRow[] = ((historyRes.data as any[]) || []).map((r) => ({
    purchase_id: r.purchase_id,
    line_id: r.id, // purchase_items.id
    purchased_at: r.purchases?.purchased_at,
    lot_code: r.purchases?.lot_code,
    supplier_name: r.purchases?.suppliers?.name ?? r.purchases?.supplier_name ?? null,
    item_name: r.items?.name,
    qty_kg: Number(r.qty_kg || 0),
    unit_price: Number(r.unit_price || 0),
    line_total: Number(r.line_total || 0),
  }));

  const error =
    suppliersRes.error?.message ||
    greensRes.error?.message ||
    historyRes.error?.message ||
    null;

  return (
    <div>
      <TopBar title="Nhập hàng nhân xanh" subtitle="Tạo phiếu nhập theo lô • Tự cộng tồn kho" />
      <InventoryInClient
        initialSuppliers={suppliers}
        initialGreenItems={greenItems}
        initialHistory={history}
        error={error}
      />
    </div>
  );
}