import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";

export const dynamic = "force-dynamic";

const LOW_SELLABLE_KG = 10;

export async function GET(request: Request) {
  const supabase = createRouteSupabase(request, NextResponse.json({}));

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!member?.org_id)
    return NextResponse.json({ error: "User không thuộc tổ chức nào" }, { status: 403 });

  // 1) All active products
  const { data: products, error: pErr } = await supabase
    .from("products")
    .select("id, name, kind, green_type_id, price, unit")
    .eq("is_active", true)
    .order("name");
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });

  // 2) Roasted stock aggregated by green_type
  const { data: stockRows } = await supabase
    .from("v_roasted_stock")
    .select("green_type_id, green_type_name, total_remaining_kg")
    .eq("org_id", member.org_id);

  const stockMap: Record<string, { name: string; remaining: number }> = {};
  for (const r of stockRows ?? []) {
    stockMap[r.green_type_id] = {
      name: r.green_type_name,
      remaining: Number(r.total_remaining_kg ?? 0),
    };
  }

  // 3) Recipe lines for blends (use product_formulas with ratio_pct)
  const blendIds = (products ?? []).filter((p: any) => p.kind === "blend").map((p: any) => p.id);
  let recipeMap: Record<string, { green_type_id: string; ratio: number }[]> = {};

  if (blendIds.length > 0) {
    const { data: recipes } = await supabase
      .from("product_formulas")
      .select("product_id, green_type_id, ratio_pct")
      .in("product_id", blendIds);
    for (const r of recipes ?? []) {
      if (!recipeMap[r.product_id]) recipeMap[r.product_id] = [];
      recipeMap[r.product_id].push({ green_type_id: r.green_type_id, ratio: Number(r.ratio_pct) / 100 });
    }
  }

  // 4) Calculate sellable_kg per product
  const result = (products ?? []).map((p: any) => {
    if (p.kind === "original") {
      const gtId = p.green_type_id;
      if (!gtId) return { product_id: p.id, product_name: p.name, kind: p.kind, price: p.price, unit: p.unit, sellable_kg: 0, limiting_factor: "no green_type_id configured", low_stock: true };
      const remaining = stockMap[gtId]?.remaining ?? 0;
      return {
        product_id: p.id,
        product_name: p.name,
        kind: p.kind,
        price: p.price,
        unit: p.unit,
        sellable_kg: Math.round(remaining * 100) / 100,
        green_type_id: gtId,
        limiting_factor: remaining < LOW_SELLABLE_KG ? (stockMap[gtId]?.name ?? gtId) : null,
        limiting_green_type_id: remaining < LOW_SELLABLE_KG ? gtId : null,
        low_stock: remaining < LOW_SELLABLE_KG,
      };
    }

    if (p.kind === "blend") {
      const lines = recipeMap[p.id];
      if (!lines || lines.length === 0) return { product_id: p.id, product_name: p.name, kind: p.kind, price: p.price, unit: p.unit, sellable_kg: 0, limiting_factor: "no recipe configured", low_stock: true };

      let minPossible = Infinity;
      let limitingGreenType: string | null = null;
      let limitingGreenTypeId: string | null = null;
      let limitingRatio = 1;

      for (const line of lines) {
        const remaining = stockMap[line.green_type_id]?.remaining ?? 0;
        const possible = line.ratio > 0 ? remaining / line.ratio : 0;
        if (possible < minPossible) {
          minPossible = possible;
          limitingGreenType = stockMap[line.green_type_id]?.name ?? line.green_type_id;
          limitingGreenTypeId = line.green_type_id;
          limitingRatio = line.ratio;
        }
      }

      const sellable = minPossible === Infinity ? 0 : Math.round(minPossible * 100) / 100;
      return {
        product_id: p.id,
        product_name: p.name,
        kind: p.kind,
        price: p.price,
        unit: p.unit,
        sellable_kg: sellable,
        limiting_factor: sellable < LOW_SELLABLE_KG ? limitingGreenType : null,
        limiting_green_type_id: sellable < LOW_SELLABLE_KG ? limitingGreenTypeId : null,
        limiting_ratio: sellable < LOW_SELLABLE_KG ? limitingRatio : null,
        low_stock: sellable < LOW_SELLABLE_KG,
      };
    }

    return { product_id: p.id, product_name: p.name, kind: p.kind, price: p.price, unit: p.unit, sellable_kg: 0, limiting_factor: "unknown kind", low_stock: true };
  });

  return NextResponse.json({ ok: true, data: result });
}
