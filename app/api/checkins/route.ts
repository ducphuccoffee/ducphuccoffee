import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";

export async function GET(request: Request) {
  const response = NextResponse.json({ ok: true });
  const supabase = createRouteSupabase(request, response);
  const { data, error } = await supabase.from("checkins").select("*").order("checkin_at", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });
  const supabase = createRouteSupabase(request, response);
  const body = await request.json().catch(() => ({}));

  const checkin_at = body?.checkin_at ? String(body.checkin_at) : new Date().toISOString();
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  const place_name = body?.place_name ? String(body.place_name) : null;
  const note = body?.note ? String(body.note) : null;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ ok: false, error: "lat/lng is required" }, { status: 400 });
  }

  const { data: userRes } = await supabase.auth.getUser();
  const owner_id = userRes?.user?.id;
  if (!owner_id) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const { data, error } = await supabase
    .from("checkins")
    .insert({ checkin_at, lat, lng, place_name, note, owner_id })
    .select("*")
    .single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}
