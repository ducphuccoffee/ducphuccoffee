import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const table = searchParams.get("table") ?? "order_items";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Try selecting specific column sets to discover which exist
  const tests: Record<string, string> = {
    sell_price:  "id, sell_price",
    unit_price:  "id, unit_price",
    price:       "id, price",
    cost_price:  "id, cost_price",
    subtotal:    "id, subtotal",
    product_name:"id, product_name",
    unit:        "id, unit",
  };

  const results: Record<string, string> = {};
  for (const [col, sel] of Object.entries(tests)) {
    const { error } = await supabase.from(table).select(sel).limit(0);
    results[col] = error ? "MISSING: " + error.message : "EXISTS";
  }

  // Also try select *
  const { data: all } = await supabase.from(table).select("*").limit(1);

  return NextResponse.json({ table, column_probe: results, sample: all });
}
