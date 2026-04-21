import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("purchase_items")
    .select("id, qty_kg, unit_price, line_total, purchases(purchased_at, lot_code, supplier_name, suppliers(name)), items(name)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const rows = ((data as any[]) || []).map((r) => ({
    id: r.id,
    purchased_at: r.purchases?.purchased_at,
    lot_code: r.purchases?.lot_code,
    supplier_name: r.purchases?.suppliers?.name ?? r.purchases?.supplier_name ?? null,
    item_name: r.items?.name,
    qty_kg: Number(r.qty_kg || 0),
    unit_price: Number(r.unit_price || 0),
    line_total: Number(r.line_total || 0),
  }));

  return NextResponse.json({ data: rows });
}
