import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";

export async function GET(request: Request) {
  const supabase = createRouteSupabase(request, NextResponse.json({}));
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, org_id, customer_id, status, total_qty_kg, total_amount, created_by, created_at,
      customers(id, name, phone),
      order_items(id, product_id, qty, sell_price)
    `)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const response = NextResponse.json({});
  const supabase = createRouteSupabase(request, response);

  // 1) Auth
  const { data: { user } } = await supabase.auth.getUser();
  console.log("[orders POST] user.id =", user?.id ?? "null");
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  // 2) Org
  const { data: member, error: memberErr } = await supabase
    .from("org_members").select("org_id").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();
  console.log("[orders POST] org_id =", member?.org_id ?? "null", memberErr?.message ?? "");
  if (memberErr || !member?.org_id)
    return NextResponse.json({ error: "User is not assigned to any organization" }, { status: 403 });

  // 3) Body
  const body = await request.json();
  const { customer_id, customer_name, items, tax_rate } = body;

  // Need a customer_id — if not provided, look up by name within this org
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
    console.log("[orders POST] customer lookup by name →", resolvedCustomerId);
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
  const subtotal = validItems.reduce((s: number, i: any) => s + Number(i.qty) * Number(i.unit_price || i.sell_price || 0), 0);
  const totalAmount = Math.round(subtotal * (1 + resolvedTaxRate));
  const totalQtyKg  = validItems.reduce((s: number, i: any) => s + Number(i.qty), 0);

  // 4) Insert order
  const orderPayload = {
    org_id:        member.org_id,
    customer_id:   resolvedCustomerId,
    status:        "pending",
    total_qty_kg:  totalQtyKg,
    total_amount:  totalAmount,
    created_by:    user.id,
  };
  console.log("[orders POST] order payload =", JSON.stringify(orderPayload));

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert(orderPayload)
    .select("id, org_id, customer_id, status, total_qty_kg, total_amount, created_at")
    .single();

  if (orderErr) {
    console.error("[orders POST] order insert error =", orderErr.message, orderErr.details, orderErr.hint);
    return NextResponse.json({ error: orderErr.message, details: orderErr.details, hint: orderErr.hint }, { status: 400 });
  }

  // 5) Insert order_items — live schema: order_id, product_id, qty, sell_price, cost_price
  const itemRows = validItems.map((i: any) => ({
    order_id:   order.id,
    product_id: i.product_id,
    qty:        Number(i.qty),
    sell_price: Number(i.unit_price || i.sell_price || 0),
    cost_price: Number(i.cost_price || 0),
  }));
  console.log("[orders POST] order_items payload =", JSON.stringify(itemRows));

  const { error: itemsErr } = await supabase.from("order_items").insert(itemRows);
  if (itemsErr) {
    // Rollback order
    await supabase.from("orders").delete().eq("id", order.id);
    console.error("[orders POST] order_items error =", itemsErr.message, itemsErr.details);
    return NextResponse.json({ error: itemsErr.message, details: itemsErr.details }, { status: 400 });
  }

  return NextResponse.json({ ok: true, data: order });
}

export async function PATCH(request: Request) {
  const supabase = createRouteSupabase(request, NextResponse.json({}));
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
  const body = await request.json();
  const patch: Record<string, any> = {};
  const VALID_STATUSES = ["pending", "confirmed", "delivered", "cancelled"];
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status))
      return NextResponse.json({ error: "Trạng thái không hợp lệ" }, { status: 400 });
    patch.status = body.status;
  }
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
