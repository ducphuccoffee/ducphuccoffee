import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";

function genLotCode() {
  const d = new Date();
  const pad = (x: number) => String(x).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const rand = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `LOT-${yyyy}${mm}${dd}-${hh}${mi}-${rand}`;
}

export async function GET(request: Request) {
  const response = NextResponse.json({ ok: true });
  const supabase = createRouteSupabase(request, response);
  const { data, error } = await supabase.from("v_green_stock").select("*").order("inbound_at", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });
  const supabase = createRouteSupabase(request, response);
  const body = await request.json().catch(() => ({}));

  const inbound_at = body?.inbound_at ? String(body.inbound_at) : new Date().toISOString();
  const green_type_id = String(body?.green_type_id || "");
  const qty_kg = Number(body?.qty_kg || 0);
  const unit_cost = Number(body?.unit_cost || 0);
  const lot_code = String(body?.lot_code || "").trim() || genLotCode();

  if (!green_type_id) return NextResponse.json({ ok: false, error: "green_type_id is required" }, { status: 400 });
  if (!(qty_kg > 0)) return NextResponse.json({ ok: false, error: "qty_kg must be > 0" }, { status: 400 });
  if (!(unit_cost >= 0)) return NextResponse.json({ ok: false, error: "unit_cost must be >= 0" }, { status: 400 });

  const { data, error } = await supabase
    .from("green_inbounds")
    .insert({ inbound_at, lot_code, green_type_id, qty_kg, unit_cost })
    .select("*")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}
