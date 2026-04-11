import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const table = searchParams.get("table") ?? "order_items";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Try to select * with limit 0 — PostgREST error reveals column info
  // Also try insert with a clearly invalid payload to get "column X does not exist"
  const { data, error } = await supabase.from(table).select("*").limit(0);

  // Get the OpenAPI spec and pull column names
  const specRes = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${key}`, Accept: "application/openapi+json" },
  });
  const spec = specRes.ok ? await specRes.json() : {};
  const def  = spec?.definitions?.[table] ?? spec?.components?.schemas?.[table] ?? null;

  return NextResponse.json({
    table,
    columns_from_openapi: def ? Object.keys(def.properties ?? {}) : null,
    select_error: error?.message ?? null,
    data,
  });
}
