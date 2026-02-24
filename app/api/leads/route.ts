import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";

export async function GET(request: Request) {
  const response = NextResponse.json({ ok: true });
  const supabase = createRouteSupabase(request, response);
  const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });
  const supabase = createRouteSupabase(request, response);
  const body = await request.json().catch(() => ({}));
  const name = String(body?.name || "").trim();
  const phone = body?.phone ? String(body.phone).trim() : null;
  const stage = String(body?.stage || "lead");
  if (!name) return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });

  const { data: userRes } = await supabase.auth.getUser();
  const owner_id = userRes?.user?.id;
  if (!owner_id) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const { data, error } = await supabase.from("leads").insert({ name, phone, stage, owner_id }).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}

export async function PUT(request: Request) {
  const response = NextResponse.json({ ok: true });
  const supabase = createRouteSupabase(request, response);
  const body = await request.json().catch(() => ({}));
  const id = String(body?.id || "");
  const stage = String(body?.stage || "");
  if (!id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
  if (!stage) return NextResponse.json({ ok: false, error: "stage is required" }, { status: 400 });

  const { error } = await supabase.from("leads").update({ stage }).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
