import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// TEMP: inspect order_items RLS policies + check if service-role insert works
export async function GET() {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const svcKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // 1) Read policies via service-role (bypasses RLS) using PostgREST OpenAPI
  const specRes = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${svcKey ?? anonKey}`, Accept: "application/openapi+json" },
  });
  const spec = specRes.ok ? await specRes.json() : null;

  // 2) Probe pg_policies view (readable by authenticated users in Supabase)
  const svc = createClient(url, svcKey ?? anonKey, { auth: { persistSession: false } });

  const { data: policies, error: polErr } = await svc
    .from("pg_policies")
    .select("policyname, cmd, roles, qual, with_check")
    .eq("schemaname", "public")
    .eq("tablename", "order_items");

  // 3) Test: can service role insert a fake row? (will fail FK, not RLS)
  const { error: insertErr } = await svc
    .from("order_items")
    .insert({
      order_id:     "00000000-0000-0000-0000-000000000000",
      product_id:   "00000000-0000-0000-0000-000000000000",
      product_name: "test",
      unit:         "kg",
      qty:          1,
      unit_price:   0,
    });

  return NextResponse.json({
    policies:        policies ?? null,
    policies_error:  polErr?.message ?? null,
    svc_insert_error: insertErr?.message ?? null,
    has_service_key: !!svcKey,
  });
}
