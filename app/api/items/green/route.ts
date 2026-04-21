import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("items")
    .select("id,name,sku,type")
    .eq("type", "green")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const body = (await req.json().catch(() => ({}))) as { name?: string; sku?: string };
  const name = (body.name ?? "").trim();
  const sku = (body.sku ?? "").trim() || null;
  if (!name) return NextResponse.json({ error: "Thiếu tên loại nhân" }, { status: 400 });

  // Minimal insert for MVP
  const { data, error } = await supabase
    .from("items")
    .insert({ name, sku, type: "green" })
    .select("id,name,sku,type")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
