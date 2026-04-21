import { TopBar } from "@/components/TopBar";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { InventoryInClient } from "@/components/inventory/InventoryInClient";
import type { GreenInbound, GreenType } from "@/components/inventory/InventoryInClient";

export default async function Page() {
  const supabase = await createServerSupabaseClient();

  const [inboundsRes, typesRes] = await Promise.all([
    supabase
      .from("v_green_stock")
      .select("*")
      .order("inbound_at", { ascending: false })
      .limit(200),
    supabase
      .from("green_types")
      .select("id, name")
      .order("name"),
  ]);

  const inbounds = (inboundsRes.data ?? []).map((r: any) => ({
    id: r.green_inbound_id,
    inbound_at: r.inbound_at,
    lot_code: r.lot_code,
    green_type_id: r.green_type_id,
    green_type_name: r.green_type_name,
    qty_kg: Number(r.original_qty_kg ?? 0),
    unit_cost: Number(r.unit_cost ?? 0),
    line_total: Number(r.original_qty_kg ?? 0) * Number(r.unit_cost ?? 0),
    remaining_kg: Number(r.remaining_kg ?? 0),
  })) as GreenInbound[];

  const greenTypes = (typesRes.data ?? []) as GreenType[];

  const error = inboundsRes.error?.message ?? typesRes.error?.message ?? null;

  return (
    <div>
      <TopBar
        title="Nhập hàng nhân xanh"
        subtitle="Quản lý lô nhân — tồn kho FIFO"
      />
      <InventoryInClient
        initialInbounds={inbounds}
        initialGreenTypes={greenTypes}
        error={error}
      />
    </div>
  );
}
