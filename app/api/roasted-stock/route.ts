import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";

export const dynamic = "force-dynamic";

const LOW_STOCK_THRESHOLD_KG = 10;

export async function GET(request: Request) {
  const supabase = createRouteSupabase(request, NextResponse.json({}));

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!member?.org_id)
    return NextResponse.json({ error: "User không thuộc tổ chức nào" }, { status: 403 });

  const { data, error } = await supabase
    .from("v_roasted_stock")
    .select("*")
    .eq("org_id", member.org_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const rows = (data ?? []).map((r: any) => ({
    green_type_id: r.green_type_id,
    green_type_name: r.green_type_name,
    total_remaining_kg: Number(r.total_remaining_kg ?? 0),
    avg_cost_per_kg: Number(r.avg_cost_per_kg ?? 0),
    lot_count: Number(r.lot_count ?? 0),
    low_stock: Number(r.total_remaining_kg ?? 0) < LOW_STOCK_THRESHOLD_KG,
  }));

  return NextResponse.json({ ok: true, data: rows });
}
