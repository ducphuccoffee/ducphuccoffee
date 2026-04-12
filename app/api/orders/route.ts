import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";
import { createClient } from "@supabase/supabase-js";
import { ORDER_STATUSES, PAYMENT_STATUSES, PAYMENT_METHODS } from "@/lib/order-constants";

// Service-role client — bypasses RLS for order_items insert
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

// Generate order code from UUID
function makeOrderCode(id: string) {
  return "#" + id.slice(0, 8).toUpperCase();
}

export async function GET(request: Request) {
  const supabase = createRouteSupabase(request, NextResponse.json({}));
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customer_id");

  let q = supabase
    .from("orders")
    .select(`
      id, org_id, customer_id, status, payment_status, payment_method,
      total_qty_kg, total_amount, note, order_code, created_by, created_at,
      customers(id, name, phone),
      order_items(id, product_id, product_name, unit, qty, unit_price, subtotal)
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (customerId) q = q.eq("customer_id", customerId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const response = NextResponse.json({});
  const supabase = createRouteSupabase(request, response);

  // 1) Auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  // 2) Org
  const { data: member, error: memberErr } = await supabase
    .from("org_members").select("org_id").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();
  if (memberErr || !member?.org_id)
    return NextResponse.json({ error: "User is not assigned to any organization" }, { status: 403 });

  // 3) Body
  const body = await request.json();
  const { customer_id, customer_name, items, tax_rate, payment_method, note } = body;

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

  const validTaxRates = [0, 0.08, 0.10];
  const resolvedTaxRate = validTaxRates.includes(Number(tax_rate)) ? Number(tax_rate) : 0;
  const subtotal    = validItems.reduce((s: number, i: any) => s + Number(i.qty) * Number(i.unit_price || 0), 0);
  const totalAmount = Math.round(subtotal * (1 + resolvedTaxRate));
  const totalQtyKg  = validItems.reduce((s: number, i: any) => s + Number(i.qty), 0);

  const resolvedPaymentMethod = PAYMENT_METHODS.includes(payment_method) ? payment_method : "cash";

  // 4) Insert order — default status = 'new' (Mới tạo, chờ tiếp nhận)
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      org_id:         member.org_id,
      customer_id:    resolvedCustomerId,
      status:         "new",
      payment_status: "unpaid",
      payment_method: resolvedPaymentMethod,
      total_qty_kg:   totalQtyKg,
      total_amount:   totalAmount,
      created_by:     user.id,
      note:           note?.trim() || null,
    })
    .select("id, org_id, customer_id, status, payment_status, payment_method, total_qty_kg, total_amount, note, created_at")
    .single();

  if (orderErr)
    return NextResponse.json({ error: orderErr.message }, { status: 400 });

  // Backfill order_code immediately
  const orderCode = makeOrderCode(order.id);
  await supabase.from("orders").update({ order_code: orderCode }).eq("id", order.id);

  // 5) Insert order_items via service-role (bypasses RLS)
  const svc = createServiceClient();
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
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: itemsErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, data: { ...order, order_code: orderCode } });
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
  if (body.payment_status !== undefined) {
    if (!PAYMENT_STATUSES.includes(body.payment_status))
      return NextResponse.json({ error: "Trạng thái thanh toán không hợp lệ" }, { status: 400 });
    patch.payment_status = body.payment_status;
  }
  if (body.payment_method !== undefined) {
    if (!PAYMENT_METHODS.includes(body.payment_method))
      return NextResponse.json({ error: "Phương thức thanh toán không hợp lệ" }, { status: 400 });
    patch.payment_method = body.payment_method;
  }
  if (body.note !== undefined) patch.note = body.note;

  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: "Không có field hợp lệ" }, { status: 400 });

  const { data, error } = await supabase.from("orders").update(patch).eq("id", id).select().single();
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
