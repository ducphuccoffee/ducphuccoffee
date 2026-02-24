import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";

export async function GET(request: Request) {
  const response = NextResponse.json({ ok: true });
  const supabase = createRouteSupabase(request, response);

  const { data, error } = await supabase.from("green_types").select("*").order("created_at", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });
  const supabase = createRouteSupabase(request, response);
  const body = await request.json().catch(() => ({}));
  const name = String(body?.name || "").trim();
  if (!name) return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });

  const { data, error } = await supabase.from("green_types").insert({ name }).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}
