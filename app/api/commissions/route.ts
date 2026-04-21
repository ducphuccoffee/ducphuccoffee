import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";

export async function GET(request: Request) {
  const supabase = createRouteSupabase(request, NextResponse.json({}));
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { data: member } = await supabase
    .from("org_members").select("org_id").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();
  if (!member?.org_id) return NextResponse.json({ error: "Không có tổ chức" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");
  const status = searchParams.get("status");

  let q = supabase
    .from("commissions")
    .select("*, orders(order_code, customer_id, total_amount)")
    .eq("org_id", member.org_id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (userId) q = q.eq("beneficiary_user_id", userId);
  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}

export async function POST(request: Request) {
  const supabase = createRouteSupabase(request, NextResponse.json({}));
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { data: member } = await supabase
    .from("org_members").select("org_id").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();
  if (!member?.org_id) return NextResponse.json({ error: "Không có tổ chức" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const orderId = body.order_id;
  if (!orderId) return NextResponse.json({ error: "Thiếu order_id" }, { status: 400 });

  // Get order
  const { data: order } = await supabase
    .from("orders")
    .select("id, owner_user_id, total_amount, total_qty_kg, org_id")
    .eq("id", orderId)
    .single();
  if (!order) return NextResponse.json({ error: "Order không tìm thấy" }, { status: 404 });

  // Check duplicate
  const { data: existing } = await supabase
    .from("commissions")
    .select("id")
    .eq("order_id", orderId)
    .limit(1)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: false, duplicate: true, message: "Đã tính commission cho đơn này" }, { status: 409 });

  // Get commission rules
  const commissionType = body.commission_type || "coffee";
  const { data: rule } = await supabase
    .from("commission_rules")
    .select("fixed_amount, collaborator_rate_per_kg")
    .eq("org_id", member.org_id)
    .eq("commission_type", commissionType)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  let amount = 0;
  const qtyKg = Number(order.total_qty_kg ?? 0);
  const fixedAmount = Number(rule?.fixed_amount ?? 0);
  const ratePerKg = Number(rule?.collaborator_rate_per_kg ?? 0);

  if (fixedAmount > 0) {
    amount = fixedAmount;
  } else if (ratePerKg > 0 && qtyKg > 0) {
    amount = ratePerKg * qtyKg;
  }

  if (amount <= 0) return NextResponse.json({ error: "Không tính được commission (rule = 0)" }, { status: 400 });

  const { data: commission, error } = await supabase
    .from("commissions")
    .insert({
      org_id:               member.org_id,
      order_id:             orderId,
      beneficiary_user_id:  order.owner_user_id,
      amount,
      qty_kg:               qtyKg,
      rate_per_kg:          ratePerKg,
      commission_type:      commissionType,
      status:               "pending",
      created_by:           user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data: commission });
}

export async function PATCH(request: Request) {
  const supabase = createRouteSupabase(request, NextResponse.json({}));
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  if (body.status !== "paid") return NextResponse.json({ error: "Chỉ có thể cập nhật status = paid" }, { status: 400 });

  const { data, error } = await supabase
    .from("commissions").update({ status: "paid" }).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}
