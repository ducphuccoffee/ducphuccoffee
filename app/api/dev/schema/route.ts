import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// TEMP diagnostic — remove after schema confirmed
// GET /api/dev/schema?table=orders
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const table = searchParams.get("table") ?? "orders";

  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const svcKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const key     = svcKey ?? anonKey;

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Fetch one real row so we see every column name and value
  const { data: sample, error: sampleErr } = await supabase
    .from(table)
    .select("*")
    .limit(1);

  // Also fetch order_items sample if table=orders
  let items = null, itemsErr = null;
  if (table === "orders") {
    const r = await supabase.from("order_items").select("*").limit(1);
    items    = r.data;
    itemsErr = r.error?.message ?? null;
  }

  return NextResponse.json({
    table,
    sample:       sample ?? null,
    sample_error: sampleErr?.message ?? null,
    order_items_sample:  items,
    order_items_error:   itemsErr,
  });
}
