import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function genCode() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `DP-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
}

const STATUS_LABELS = ["pending","confirmed","delivered","cancelled"];

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("orders")
    .select(`id, order_code, customer_name, customer_phone, status, note, total_amount, created_at,
      order_items(id, product_id, product_name, unit, qty, unit_price, subtotal)`)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const body = await req.json();
  const { customer_name, customer_phone, note, items, tax_rate } = body;
  if (!customer_name?.trim()) return NextResponse.json({ error: "Thiếu tên khách hàng" }, { status: 400 });
  if (!items?.length) return NextResponse.json({ error: "Đơn hàng cần ít nhất 1 sản phẩm" }, { status: 400 });

  const validTaxRates = [0, 0.08, 0.10];
  const resolvedTaxRate = validTaxRates.includes(Number(tax_rate)) ? Number(tax_rate) : 0;
  const subtotal = items.reduce((s: number, i: any) => s + Number(i.qty) * Number(i.unit_price), 0);
  const total = Math.round(subtotal * (1 + resolvedTaxRate));

  const { data: order, error: oErr } = await supabase
    .from("orders")
    .insert({
      order_code: genCode(),
      customer_name: customer_name.trim(),
      customer_phone: customer_phone?.trim() || null,
      note: note?.trim() || null,
      status: "pending",
      total_amount: total,
    })
    .select()
    .single();
  if (oErr) return NextResponse.json({ error: oErr.message }, { status: 400 });

  const rows = items.map((i: any) => ({
    order_id: order.id,
    product_id: i.product_id,
    product_name: i.product_name,
    unit: i.unit || "kg",
    qty: Number(i.qty),
    unit_price: Number(i.unit_price),
  }));
  const { error: iErr } = await supabase.from("order_items").insert(rows);
  if (iErr) {
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: iErr.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, data: order });
}

export async function PATCH(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });

  const body = await req.json();
  const patch: Record<string, any> = {};
  if (body.status !== undefined) {
    if (!STATUS_LABELS.includes(body.status)) return NextResponse.json({ error: "Trạng thái không hợp lệ" }, { status: 400 });
    patch.status = body.status;
  }
  if (body.note !== undefined) patch.note = body.note;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Không có field hợp lệ" }, { status: 400 });

  const { data, error } = await supabase.from("orders").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, data });
}

export async function DELETE(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
