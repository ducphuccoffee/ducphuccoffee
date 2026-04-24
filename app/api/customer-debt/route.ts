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
    .from("v_customer_debt")
    .select("*")
    .eq("org_id", member.org_id)
    .order("debt_amount", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const OVERDUE_THRESHOLD = 30 * 86_400_000;
  const HIGH_DEBT = 10_000_000;
  const now = Date.now();

  const rows = (data ?? []).map((r: any) => {
    const daysSinceOrder = r.last_order_at ? Math.floor((now - new Date(r.last_order_at).getTime()) / 86_400_000) : 999;
    return {
      ...r,
      debt_amount: Number(r.debt_amount ?? 0),
      total_ordered: Number(r.total_ordered ?? 0),
      total_paid: Number(r.total_paid ?? 0),
      is_overdue: daysSinceOrder > 30,
      is_high_debt: Number(r.debt_amount ?? 0) >= HIGH_DEBT,
      days_since_last_order: daysSinceOrder,
    };
  });

  return NextResponse.json({ ok: true, data: rows });
}
