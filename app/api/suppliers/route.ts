import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// NOTE: demo org fixed for MVP
const ORG_ID = "00000000-0000-0000-0000-000000000001" as const;

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("id,name,phone,address,note,is_active,created_at")
    .eq("org_id", ORG_ID)
    .eq("is_active", true)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient();
  const body = (await req.json().catch(() => ({}))) as { name?: string; phone?: string };
  const name = (body.name ?? "").trim();
  const phone = (body.phone ?? "").trim() || null;
  if (!name) return NextResponse.json({ error: "Thiếu tên nhà cung cấp" }, { status: 400 });

  const { data, error } = await supabase
    .from("suppliers")
    .insert({ org_id: ORG_ID, name, phone, is_active: true })
    .select("id,name,phone,address,note,is_active,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
