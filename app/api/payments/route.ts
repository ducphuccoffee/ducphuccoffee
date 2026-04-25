import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";
import { writeAudit } from "@/lib/audit";

export async function GET(request: Request) {
  const supabase = createRouteSupabase(request, NextResponse.json({}));
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { data: member } = await supabase
    .from("org_members").select("org_id").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();
  if (!member?.org_id) return NextResponse.json({ error: "Không có tổ chức" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("order_id");

  let q = supabase
    .from("payments")
    .select("*")
    .eq("org_id", member.org_id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (orderId) q = q.eq("order_id", orderId);

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
  if (!body.order_id) return NextResponse.json({ error: "Thiếu order_id" }, { status: 400 });
  const amount = Number(body.amount ?? 0);
  if (amount <= 0) return NextResponse.json({ error: "amount phải > 0" }, { status: 400 });

  const { data, error } = await supabase
    .from("payments")
    .insert({
      org_id:       member.org_id,
      order_id:     body.order_id,
      amount,
      method:       body.method || "cash",
      note:         body.note?.trim() || null,
      status:       "confirmed",
      confirmed_by: user.id,
      paid_at:      body.paid_at || new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Update order payment_status if fully paid
  const { data: orderPayments } = await supabase
    .from("payments")
    .select("amount")
    .eq("order_id", body.order_id)
    .eq("status", "confirmed");

  const totalPaid = (orderPayments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);

  const { data: order } = await supabase
    .from("orders")
    .select("total_amount")
    .eq("id", body.order_id)
    .single();

  if (order && totalPaid >= Number(order.total_amount)) {
    await supabase.from("orders").update({ payment_status: "paid" }).eq("id", body.order_id);
  } else if (totalPaid > 0) {
    await supabase.from("orders").update({ payment_status: "partial" }).eq("id", body.order_id);
  }

  await writeAudit({
    orgId: member.org_id,
    actorId: user.id,
    action: "payment.create",
    entityType: "order",
    entityId: body.order_id,
    meta: {
      amount,
      method: body.method || "cash",
      payment_id: data.id,
    },
  });

  return NextResponse.json({ ok: true, data });
}
