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

  // 1) One real row (if exists)
  const { data: sample, error: sampleErr } = await supabase
    .from(table).select("*").limit(1);

  // 2) OpenAPI spec → column definitions (works even on empty tables)
  const specRes = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${key}`, Accept: "application/openapi+json" },
  });
  const spec   = specRes.ok ? await specRes.json() : null;
  const schema = spec?.definitions?.[table]
              ?? spec?.components?.schemas?.[table]
              ?? null;

  // 3) For orders, also get order_items columns
  let itemsSchema = null;
  if (table === "orders") {
    itemsSchema = spec?.definitions?.["order_items"]
               ?? spec?.components?.schemas?.["order_items"]
               ?? null;
  }

  return NextResponse.json({
    table,
    columns:       schema?.properties   ? Object.keys(schema.properties) : null,
    required:      schema?.required     ?? null,
    properties:    schema?.properties   ?? null,
    sample:        sample               ?? null,
    sample_error:  sampleErr?.message   ?? null,
    order_items_columns:  itemsSchema?.properties ? Object.keys(itemsSchema.properties) : null,
    order_items_required: itemsSchema?.required   ?? null,
    order_items_props:    itemsSchema?.properties ?? null,
  });
}
