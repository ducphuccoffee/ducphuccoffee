import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = createRouteSupabase(request, NextResponse.json({}));
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { data: member } = await supabase
    .from("org_members").select("org_id").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();
  if (!member?.org_id) return NextResponse.json({ error: "Không có tổ chức" }, { status: 403 });

  const { data, error } = await supabase
    .from("v_sales_kpi")
    .select("*")
    .eq("org_id", member.org_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Enrich with profile names
  const userIds = (data ?? []).map((r: any) => r.owner_user_id).filter(Boolean);
  let profileMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      profileMap[p.id] = p.full_name || p.id;
    }
  }

  const rows = (data ?? []).map((r: any) => ({
    user_id: r.owner_user_id,
    user_name: profileMap[r.owner_user_id] ?? r.owner_user_id,
    total_orders: Number(r.total_orders ?? 0),
    total_revenue: Number(r.total_revenue ?? 0),
    total_commission: Number(r.total_commission ?? 0),
    total_leads: Number(r.total_leads ?? 0),
    converted_leads: Number(r.converted_leads ?? 0),
    conversion_rate: Number(r.conversion_rate ?? 0),
  }));

  rows.sort((a: any, b: any) => b.total_revenue - a.total_revenue);

  return NextResponse.json({ ok: true, data: rows });
}
