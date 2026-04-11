import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// TEMP diagnostic: returns live schema for a table
// GET /api/dev/schema?table=customers
// Remove after confirmed.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const table = searchParams.get("table") ?? "customers";

  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const key        = serviceKey ?? anonKey;

  // Strategy: do a SELECT * LIMIT 0 — PostgREST returns column definitions
  // in the response headers (Content-Range) and the empty array lets us
  // inspect what Supabase accepts. For the real column list we use
  // the PostgREST OpenAPI spec which is always available.
  const specRes = await fetch(`${url}/rest/v1/`, {
    headers: {
      apikey:        anonKey,
      Authorization: `Bearer ${key}`,
      Accept:        "application/openapi+json",
    },
  });

  const spec = specRes.ok ? await specRes.json() : { error: await specRes.text() };

  // Extract just the customers table definition
  const tableDef = spec?.definitions?.[table] ?? spec?.components?.schemas?.[table] ?? null;

  // Also try a direct Supabase admin client to query the table
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: sample, error: sampleErr } = await supabase
    .from(table)
    .select("*")
    .limit(1);

  return NextResponse.json({
    table,
    schema:       tableDef,
    sample:       sample ?? null,
    sample_error: sampleErr?.message ?? null,
  });
}
