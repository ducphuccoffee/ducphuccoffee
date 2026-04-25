import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";

const ALLOWED_PATCH = [
  "name", "sku", "kind", "unit", "weight_per_unit",
  "price", "note", "is_active", "green_type_id",
  "packaging_cost", "min_stock",
];

export async function GET() {
  const supabase = await createServerSupabaseClient();

  const [{ data: products, error }, { data: formulas }, { data: greenTypes }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, sku, kind, unit, weight_per_unit, price, note, is_active, green_type_id, packaging_cost, created_at")
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
  const data = (products ?? []).map((p: any) => ({
    ...p,
    green_type_name: p.green_type_id ? (gtMap[p.green_type_id] ?? null) : null,
    product_formulas: formulasByProduct[p.id] ?? [],
  }));

  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const body = await req.json();

  const { name, sku, kind, unit, weight_per_unit, price, note, formulas, green_type_id, packaging_cost } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Thiếu tên sản phẩm" }, { status: 400 });
  if (!["original", "blend"].includes(kind)) return NextResponse.json({ error: "Loại không hợp lệ" }, { status: 400 });

  if (kind === "blend") {
    if (!formulas?.length) return NextResponse.json({ error: "Blend cần ít nhất 1 nguyên liệu" }, { status: 400 });
    const total = formulas.reduce((s: number, f: any) => s + Number(f.ratio_pct), 0);
    if (Math.abs(total - 100) > 0.01)
      return NextResponse.json({ error: `Tổng tỉ lệ phải = 100% (hiện: ${total}%)` }, { status: 400 });
  }

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
      green_type_id: kind === "original" ? (green_type_id || null) : null,
      packaging_cost: Number(packaging_cost) || 0,
    })
    .select()
    .single();

  if (productErr) return NextResponse.json({ error: productErr.message }, { status: 400 });

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

export async function PATCH(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });

  const body = await req.json();

  const patch: Record<string, any> = {};
  for (const key of ALLOWED_PATCH) {
    if (!(key in body)) continue;
    if (key === "green_type_id") {
      patch.green_type_id = body.green_type_id || null;
    } else if (key === "packaging_cost") {
      const v = body.packaging_cost;
      if (v === null || v === undefined || v === "") {
        patch.packaging_cost = 0;
      } else {
        const n = Number(v);
        if (isNaN(n)) return NextResponse.json({ error: "packaging_cost không hợp lệ" }, { status: 400 });
        patch.packaging_cost = n;
      }
    } else if (key === "min_stock") {
      const v = body.min_stock;
      if (v === null || v === undefined || v === "") {
        patch.min_stock = null;
      } else {
        const n = Number(v);
        if (isNaN(n) || n < 0) return NextResponse.json({ error: "min_stock không hợp lệ" }, { status: 400 });
        patch.min_stock = n;
      }
    } else {
      patch[key] = body[key];
    }
  }

  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: "Không có field hợp lệ để update" }, { status: 400 });

  // Snapshot prior price for audit (price/min_stock changes are sensitive)
  const { data: prior } = await supabase
    .from("products").select("org_id, price, min_stock, name").eq("id", id).maybeSingle();

  const { data, error } = await supabase
    .from("products")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (data && prior?.org_id) {
    const interesting: Record<string, any> = {};
    if ("price" in patch && Number(prior.price) !== Number(patch.price))
      interesting.price = { from: prior.price, to: patch.price };
    if ("min_stock" in patch && Number(prior.min_stock ?? 0) !== Number(patch.min_stock ?? 0))
      interesting.min_stock = { from: prior.min_stock, to: patch.min_stock };
    if (Object.keys(interesting).length > 0) {
      const { data: { user: actor } } = await supabase.auth.getUser();
      if (actor) {
        await writeAudit({
          orgId: prior.org_id,
          actorId: actor.id,
          action: "product.update",
          entityType: "product",
          entityId: id,
          meta: { name: prior.name, ...interesting },
        });
      }
    }
  }

  return NextResponse.json({ ok: true, data });
}

export async function DELETE(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
