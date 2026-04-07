// app/api/products/route.ts
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerSupabaseClient();

  const [{ data: products, error }, { data: formulas }, { data: greenTypes }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, sku, kind, unit, weight_per_unit, price, note, is_active, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("product_formulas").select("id, product_id, green_type_id, ratio_pct"),
    supabase.from("green_types").select("id, name"),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const gtMap = Object.fromEntries((greenTypes ?? []).map((g: any) => [g.id, g.name]));
  const formulasByProduct: Record<string, any[]> = {};
  for (const f of formulas ?? []) {
    if (!formulasByProduct[f.product_id]) formulasByProduct[f.product_id] = [];
    formulasByProduct[f.product_id].push({ ...f, green_types: { name: gtMap[f.green_type_id] ?? f.green_type_id } });
  }
  const data = (products ?? []).map((p: any) => ({ ...p, product_formulas: formulasByProduct[p.id] ?? [] }));

  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const supabase = createServerSupabaseClient();
  const body = await req.json();

  const { name, sku, kind, unit, weight_per_unit, price, note, formulas } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Thiếu tên sản phẩm" }, { status: 400 });
  if (!["original", "blend"].includes(kind)) return NextResponse.json({ error: "Loại không hợp lệ" }, { status: 400 });

  // Validate blend formulas
  if (kind === "blend") {
    if (!formulas?.length) return NextResponse.json({ error: "Blend cần ít nhất 1 nguyên liệu" }, { status: 400 });
    const total = formulas.reduce((s: number, f: any) => s + Number(f.ratio_pct), 0);
    if (Math.abs(total - 100) > 0.01) return NextResponse.json({ error: `Tổng tỉ lệ phải = 100% (hiện: ${total}%)` }, { status: 400 });
  }

  // Insert product
  const { data: product, error: productErr } = await supabase
    .from("products")
    .insert({
      name: name.trim(),
      sku: sku?.trim() || null,
      kind,
      unit: unit || "kg",
      weight_per_unit: weight_per_unit ? Number(weight_per_unit) : null,
      price: Number(price) || 0,
      note: note?.trim() || null,
    })
    .select()
    .single();

  if (productErr) return NextResponse.json({ error: productErr.message }, { status: 400 });

  // Insert formulas nếu blend
  if (kind === "blend" && formulas?.length) {
    const rows = formulas.map((f: any) => ({
      product_id: product.id,
      green_type_id: f.green_type_id,
      ratio_pct: Number(f.ratio_pct),
    }));
    const { error: fErr } = await supabase.from("product_formulas").insert(rows);
    if (fErr) return NextResponse.json({ error: fErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, data: product });
}

export async function DELETE(req: Request) {
  const supabase = createServerSupabaseClient();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
