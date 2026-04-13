import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";
import { createClient } from "@supabase/supabase-js";
import { ORDER_STATUSES } from "@/lib/order-constants";

// Service-role client — bypasses RLS for order_items insert
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

// Generate order code from UUID (used in response since DB doesn't store it yet)
function makeOrderCode(id: string) {
  return "#" + id.slice(0, 8).toUpperCase();
}

// Actual orders columns in current DB:
//   id, org_id, customer_id, status, total_qty_kg, total_amount,
//   delivered_by, created_by, created_at, owner_user_id
// order_items columns:
//   id, order_id, product_id, product_name, unit, qty, unit_price, subtotal

const SELECT_ORDERS = `
  id, org_id, customer_id, status, total_qty_kg, total_amount, created_by, created_at,
  customers(id, name, phone),
  order_items(id, product_id, product_name, unit, qty, unit_price, subtotal)
`.trim();

export async function GET(request: Request) {
  const supabase = createRouteSupabase(request, NextResponse.json({}));
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customer_id");

  let q = supabase
    .from("orders")
    .select(SELECT_ORDERS)
    .order("created_at", { ascending: false })
    .limit(200);

  if (customerId) q = q.eq("customer_id", customerId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const normalized = (data || []).map((o: any) => ({
    ...o,
    order_code:     makeOrderCode(o.id),
    note:           null,
    payment_status: "unpaid",
    payment_method: "cash",
  }));

  return NextResponse.json({ data: normalized });
}

export async function POST(request: Request) {
  const response = NextResponse.json({});
  const supabase = createRouteSupabase(request, response);
  const svc = createServiceClient();

  // 1) Auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  // 2) Org — look up user's active org
  const { data: member, error: memberErr } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (memberErr || !member?.org_id)
    return NextResponse.json({ error: "User không thuộc tổ chức nào" }, { status: 403 });

  // 3) Body
  const body = await request.json();
  const { customer_id, customer_name, items } = body;

  // Resolve customer_id
  let resolvedCustomerId: string | null = customer_id ?? null;
  if (!resolvedCustomerId && customer_name?.trim()) {
    const { data: found } = await supabase
      .from("customers")
      .select("id")
      .eq("org_id", member.org_id)
      .ilike("name", customer_name.trim())
      .limit(1)
      .maybeSingle();
    resolvedCustomerId = found?.id ?? null;
  }
  if (!resolvedCustomerId)
    return NextResponse.json({ error: "Vui lòng chọn khách hàng hợp lệ" }, { status: 400 });

  if (!items?.length)
    return NextResponse.json({ error: "Đơn hàng cần ít nhất 1 sản phẩm" }, { status: 400 });

  const validItems = items.filter((i: any) => i.product_id && Number(i.qty) > 0);
  if (!validItems.length)
    return NextResponse.json({ error: "Cần ít nhất 1 sản phẩm hợp lệ" }, { status: 400 });

  const totalAmount = Math.round(
    validItems.reduce((s: number, i: any) => s + Number(i.qty) * Number(i.unit_price || 0), 0)
  );
  const totalQtyKg = validItems.reduce((s: number, i: any) => s + Number(i.qty), 0);

  // 4) Insert order — only use columns that exist in the DB
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      org_id:       member.org_id,
      customer_id:  resolvedCustomerId,
      status:       "draft",
      total_qty_kg: totalQtyKg,
      total_amount: totalAmount,
      created_by:   user.id,
    })
    .select("id, org_id, customer_id, status, total_qty_kg, total_amount, created_at")
    .single();

  if (orderErr)
    return NextResponse.json({ error: orderErr.message }, { status: 400 });

  // 5) Insert order_items via service-role (bypasses RLS)
  const itemRows = validItems.map((i: any) => ({
    order_id:     order.id,
    product_id:   i.product_id,
    product_name: String(i.product_name || ""),
    unit:         String(i.unit || "kg"),
    qty:          Number(i.qty),
    unit_price:   Number(i.unit_price || 0),
  }));

  const { error: itemsErr } = await svc.from("order_items").insert(itemRows);
  if (itemsErr) {
    // Rollback order
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: itemsErr.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    data: {
      ...order,
      order_code:     makeOrderCode(order.id),
      note:           null,
      payment_status: "unpaid",
      payment_method: "cash",
    },
  });
}

export async function PATCH(request: Request) {
  const supabase = createRouteSupabase(request, NextResponse.json({}));
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });

  const body = await request.json();
  const patch: Record<string, any> = {};

  if (body.status !== undefined) {
    if (!ORDER_STATUSES.includes(body.status))
      return NextResponse.json({ error: "Trạng thái đơn không hợp lệ" }, { status: 400 });
    patch.status = body.status;
  }

  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: "Không có field hợp lệ để cập nhật" }, { status: 400 });

  const { data, error } = await supabase
    .from("orders")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}

export async function DELETE(request: Request) {
  const supabase = createRouteSupabase(request, NextResponse.json({}));
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
