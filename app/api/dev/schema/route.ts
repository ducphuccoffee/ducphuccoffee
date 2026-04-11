import { NextResponse } from "next/server";

// TEMP diagnostic: returns live customers schema via Supabase pg_meta API
// GET /api/dev/schema?table=customers
// Remove this file after schema is confirmed.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const table = searchParams.get("table") ?? "customers";

  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const key        = serviceKey ?? anonKey;

  // Supabase exposes pg_meta at /pg-meta/default/columns
  // This requires service role key for full access
  const [colsRes, polsRes] = await Promise.all([
    fetch(`${url}/pg-meta/default/columns?table_id=${encodeURIComponent(table)}&limit=100`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    }),
    fetch(`${url}/pg-meta/default/policies?table_name=${encodeURIComponent(table)}&limit=100`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    }),
  ]);

  const cols = colsRes.ok  ? await colsRes.json()  : { error: await colsRes.text() };
  const pols = polsRes.ok  ? await polsRes.json()  : { error: await polsRes.text() };

  return NextResponse.json({ table, columns: cols, policies: pols });
}
