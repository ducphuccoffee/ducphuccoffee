import { NextResponse } from "next/server";
import { z } from "zod";
import { createRouteSupabase } from "@/lib/supabase/route";

const ItemSchema = z.object({
  product_id: z.string().uuid(),
  qty: z.coerce.number().positive(),
  sell_price: z.coerce.number().min(0).optional(),
});

const CreateOrderSchema = z.object({
  customer_id: z.string().uuid().nullable().optional(),
  status: z.string().optional().default("draft"),
  items: z.array(ItemSchema).min(1),
});

function genCode() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${stamp}-${rand}`;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = CreateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  const supabase = createRouteSupabase(request, response);

  // Fetch products for cost/sell defaults
  const productIds = [...new Set(parsed.data.items.map((i) => i.product_id))];
  const { data: products, error: pErr } = await supabase
    .from("products")
    .select("id, cost_price, sell_price, is_active, name")
    .in("id", productIds);

  if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 400 });

  const map = new Map<string, any>();
  (products || []).forEach((p) => map.set(p.id, p));

  // Compute totals
  let total = 0;
  let cost = 0;

  const items = parsed.data.items.map((i) => {
    const p = map.get(i.product_id);
    if (!p) throw new Error("Product not found: " + i.product_id);
    const sell = typeof i.sell_price === "number" ? i.sell_price : Number(p.sell_price || 0);
    const c = Number(p.cost_price || 0);
    total += sell * i.qty;
    cost += c * i.qty;
    return {
      product_id: i.product_id,
      qty: i.qty,
      sell_price: sell,
      cost_price: c,
    };
  });

  const order_code = genCode();
  const profit = total - cost;

  // Insert order
  const { data: order, error: oErr } = await supabase
    .from("orders")
    .insert({
      order_code,
      customer_id: parsed.data.customer_id ?? null,
      total_amount: total,
      cost_amount: cost,
      profit,
      status: parsed.data.status ?? "draft",
    })
    .select("*")
    .single();

  if (oErr) return NextResponse.json({ ok: false, error: oErr.message }, { status: 400 });

  // Insert items
  const { error: iErr } = await supabase.from("order_items").insert(
    items.map((it) => ({ ...it, order_id: order.id }))
  );

  if (iErr) {
    // rollback order (best-effort)
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ ok: false, error: iErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, data: order });
}
