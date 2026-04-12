import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(request: Request) {
  const res = NextResponse.json({});
  const supabase = createRouteSupabase(request, res);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customer_id");

  let q = svc()
    .from("sales_visits")
    .select("id, customer_id, user_id, check_in_time, check_in_lat, check_in_lng, note, status, created_at, customers(id, name)")
    .order("check_in_time", { ascending: false })
    .limit(200);

  if (customerId) q = q.eq("customer_id", customerId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const res = NextResponse.json({});
  const supabase = createRouteSupabase(request, res);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { customer_id, check_in_lat, check_in_lng, note, status } = body;

  if (!customer_id) return NextResponse.json({ error: "customer_id required" }, { status: 400 });

  const VALID_STATUSES = ["visited", "no_answer", "follow_up"];
  const resolvedStatus = VALID_STATUSES.includes(status) ? status : "visited";

  const { data, error } = await svc()
    .from("sales_visits")
    .insert({
      customer_id,
      user_id: user.id,
      check_in_time: new Date().toISOString(),
      check_in_lat:  check_in_lat  ? Number(check_in_lat)  : null,
      check_in_lng:  check_in_lng  ? Number(check_in_lng)  : null,
      note:   note   ? String(note).trim()  : null,
      status: resolvedStatus,
    })
    .select("id, customer_id, user_id, check_in_time, check_in_lat, check_in_lng, note, status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data }, { status: 201 });
}
