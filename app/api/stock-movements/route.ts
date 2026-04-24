import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";

export const dynamic = "force-dynamic";

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

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("order_id");
  const greenTypeId = searchParams.get("green_type_id");
  const movementType = searchParams.get("type"); // production_in | sale_out

  let q = supabase
    .from("stock_movements")
    .select(`
      id, org_id, green_type_id, roasted_lot_id, order_id,
      movement_type, qty_kg, created_at,
      green_types(id, name)
    `)
    .eq("org_id", member.org_id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (orderId) q = q.eq("order_id", orderId);
  if (greenTypeId) q = q.eq("green_type_id", greenTypeId);
  if (movementType) q = q.eq("movement_type", movementType);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const rows = (data ?? []).map((r: any) => ({
    id: r.id,
    order_id: r.order_id,
    green_type_id: r.green_type_id,
    green_type_name: r.green_types?.name ?? null,
    roasted_lot_id: r.roasted_lot_id,
    movement_type: r.movement_type,
    qty_kg: Number(r.qty_kg),
    created_at: r.created_at,
  }));

  return NextResponse.json({ ok: true, data: rows });
}
