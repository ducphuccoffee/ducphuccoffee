import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";

export async function GET(request: Request) {
  const response = NextResponse.json({});
  const supabase = createRouteSupabase(request, response);
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, phone, address")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const response = NextResponse.json({});
  const supabase = createRouteSupabase(request, response);
  const body = await request.json();
  const { name, phone, address } = body;
  if (!name?.trim()) return NextResponse.json({ error: "Thiếu tên khách hàng" }, { status: 400 });
  const { data, error } = await supabase
    .from("customers")
    .insert({ name: name.trim(), phone: phone?.trim() || null, address: address?.trim() || null })
    .select("id, name, phone, address")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function PATCH(request: Request) {
  const response = NextResponse.json({});
  const supabase = createRouteSupabase(request, response);
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
  const body = await request.json();
  const { name, phone, address } = body;
  if (!name?.trim()) return NextResponse.json({ error: "Thiếu tên khách hàng" }, { status: 400 });
  const { data, error } = await supabase
    .from("customers")
    .update({ name: name.trim(), phone: phone?.trim() || null, address: address?.trim() || null })
    .eq("id", id)
    .select("id, name, phone, address")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function DELETE(request: Request) {
  const response = NextResponse.json({});
  const supabase = createRouteSupabase(request, response);
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
