import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: m } = await supabase
    .from("org_members").select("org_id")
    .eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();
  if (!m?.org_id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("products")
    .select("id, name, sku, unit, min_stock, is_active")
    .eq("org_id", m.org_id)
    .eq("is_active", true)
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}
