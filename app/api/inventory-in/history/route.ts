import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const ORG_ID = "00000000-0000-0000-0000-000000000001";

export async function GET() {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("purchase_lines")
    .select(`
      id,
      qty_kg,
      unit_price,
      line_total,
      created_at,
      purchases:purchase_id (
        id,
        org_id,
        purchased_at,
        supplier_id,
        supplier_name,
        note
      ),
      item:item_id (
        id,
        name,
        sku,
        type
      )
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const rows = (data ?? []).filter(
    (r: any) => r?.purchases?.org_id === ORG_ID
  );

  return NextResponse.json({ data: rows });
}