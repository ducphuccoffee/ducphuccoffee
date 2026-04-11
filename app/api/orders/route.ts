import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";

export async function GET(request: Request) {
  const supabase = createRouteSupabase(request, NextResponse.json({}));
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, org_id, customer_id, status, total_qty_kg, total_amount, created_by, created_at,
      customers(id, name, phone),
      order_items(id, product_id, product_name, unit, qty, unit_price, subtotal)
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
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  // 2) Org — resolve from org_members, same pattern as customers route
  const { data: member, error: memberErr } = await supabase
    .from("org_members").select("org_id").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();
  if (memberErr || !member?.org_id)
    return NextResponse.json({ error: "User is not assigned to any organization" }, { status: 403 });

  // 3) Body
  const body = await request.json();
  const { customer_id, customer_name, items, tax_rate } = body;

  // Resolve customer_id — prefer explicit id, fallback to name lookup within org
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

  // 4) Insert order — live schema: org_id, customer_id, status, total_qty_kg, total_amount, created_by
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

  // 5) Insert order_items — live schema: order_id, product_id, product_name, unit, qty, unit_price
  //    subtotal is a generated column (qty * unit_price) — do NOT insert it
  const itemRows = validItems.map((i: any) => ({
    order_id:     order.id,
    product_id:   i.product_id,
    product_name: String(i.product_name || ""),
    unit:         String(i.unit || "kg"),
    qty:          Number(i.qty),
    unit_price:   Number(i.unit_price || 0),
  }));

  const { error: itemsErr } = await supabase.from("order_items").insert(itemRows);
  if (itemsErr) {
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: itemsErr.message }, { status: 400 });
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
  const VALID_STATUSES = ["draft", "confirmed", "delivered", "closed"];
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
