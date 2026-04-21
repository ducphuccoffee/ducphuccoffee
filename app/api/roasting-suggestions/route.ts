import { NextResponse } from "next/server";
import { createRouteSupabase } from "@/lib/supabase/route";

const TARGET_SELLABLE_KG = 50;
const LOW_THRESHOLD_KG = 10;

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

  // 1) Products
  const { data: products } = await supabase
    .from("products")
    .select("id, name, kind, green_type_id")
    .eq("is_active", true);

  // 2) Roasted stock
  const { data: stockRows } = await supabase
    .from("v_roasted_stock")
    .select("green_type_id, green_type_name, total_remaining_kg")
    .eq("org_id", member.org_id);

  const stockMap: Record<string, { name: string; remaining: number }> = {};
  for (const r of stockRows ?? []) {
    stockMap[r.green_type_id] = { name: r.green_type_name, remaining: Number(r.total_remaining_kg ?? 0) };
  }

  // 3) Green stock (available to roast)
  const { data: greenRows } = await supabase
    .from("v_green_stock")
    .select("green_type_id, green_type_name, remaining_kg")
    .gt("remaining_kg", 0);

  const greenMap: Record<string, { name: string; remaining: number }> = {};
  for (const r of greenRows ?? []) {
    if (!greenMap[r.green_type_id]) greenMap[r.green_type_id] = { name: r.green_type_name, remaining: 0 };
    greenMap[r.green_type_id].remaining += Number(r.remaining_kg ?? 0);
  }

  // 4) Formulas for blends
  const blendIds = (products ?? []).filter((p: any) => p.kind === "blend").map((p: any) => p.id);
  const formulaMap: Record<string, { green_type_id: string; ratio: number }[]> = {};
  if (blendIds.length > 0) {
    const { data: formulas } = await supabase
      .from("product_formulas")
      .select("product_id, green_type_id, ratio_pct")
      .in("product_id", blendIds);
    for (const f of formulas ?? []) {
      if (!formulaMap[f.product_id]) formulaMap[f.product_id] = [];
      formulaMap[f.product_id].push({ green_type_id: f.green_type_id, ratio: Number(f.ratio_pct) / 100 });
    }
  }

  // 5) Build suggestions
  const suggestions: any[] = [];

  for (const p of products ?? []) {
    if (p.kind === "original") {
      const gtId = p.green_type_id;
      if (!gtId) continue;
      const roasted = stockMap[gtId]?.remaining ?? 0;
      const greenAvail = greenMap[gtId]?.remaining ?? 0;
      const gtName = stockMap[gtId]?.name ?? greenMap[gtId]?.name ?? gtId;
      const deficit = TARGET_SELLABLE_KG - roasted;

      if (roasted >= TARGET_SELLABLE_KG) {
        suggestions.push({
          product_name: p.name,
          kind: p.kind,
          current_sellable_kg: round2(roasted),
          limiting_green_type: null,
          suggestion: "Đủ tồn kho",
          needed_roast_kg: 0,
          green_available_kg: round2(greenAvail),
          can_fulfill: true,
        });
      } else {
        const canFulfill = greenAvail >= deficit;
        suggestions.push({
          product_name: p.name,
          kind: p.kind,
          current_sellable_kg: round2(roasted),
          limiting_green_type: gtName,
          suggestion: `Rang thêm ${round2(deficit)}kg ${gtName}`,
          needed_roast_kg: round2(deficit),
          green_available_kg: round2(greenAvail),
          can_fulfill: canFulfill,
        });
      }
    }

    if (p.kind === "blend") {
      const lines = formulaMap[p.id];
      if (!lines || lines.length === 0) continue;

      let minSellable = Infinity;
      let limitingGt: string | null = null;
      let limitingGtId: string | null = null;

      for (const line of lines) {
        const roasted = stockMap[line.green_type_id]?.remaining ?? 0;
        const possible = line.ratio > 0 ? roasted / line.ratio : 0;
        if (possible < minSellable) {
          minSellable = possible;
          limitingGt = stockMap[line.green_type_id]?.name ?? greenMap[line.green_type_id]?.name ?? line.green_type_id;
          limitingGtId = line.green_type_id;
        }
      }

      const sellable = minSellable === Infinity ? 0 : minSellable;

      if (sellable >= TARGET_SELLABLE_KG) {
        suggestions.push({
          product_name: p.name,
          kind: p.kind,
          current_sellable_kg: round2(sellable),
          limiting_green_type: null,
          suggestion: "Đủ tồn kho",
          needed_roast_kg: 0,
          green_available_kg: null,
          can_fulfill: true,
        });
      } else {
        const deficit = TARGET_SELLABLE_KG - sellable;
        const limitingLine = lines.find(l => l.green_type_id === limitingGtId);
        const neededRoast = limitingLine ? deficit * limitingLine.ratio : deficit;
        const greenAvail = limitingGtId ? (greenMap[limitingGtId]?.remaining ?? 0) : 0;

        suggestions.push({
          product_name: p.name,
          kind: p.kind,
          current_sellable_kg: round2(sellable),
          limiting_green_type: limitingGt,
          suggestion: `Rang thêm ${round2(neededRoast)}kg ${limitingGt}`,
          needed_roast_kg: round2(neededRoast),
          green_available_kg: round2(greenAvail),
          can_fulfill: greenAvail >= neededRoast,
        });
      }
    }
  }

  // Sort: urgent first
  suggestions.sort((a, b) => a.current_sellable_kg - b.current_sellable_kg);

  return NextResponse.json({ ok: true, target_kg: TARGET_SELLABLE_KG, data: suggestions });
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
