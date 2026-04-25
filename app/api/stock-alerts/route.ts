import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Lists items / sellable products whose on-hand stock is at or below their
// configured min_stock (or the org default if not set).
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!member?.org_id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: org } = await supabase
    .from("orgs").select("settings").eq("id", member.org_id).maybeSingle();
  const defaultMin = Number((org?.settings as any)?.stock?.default_min_stock_kg ?? 5);

  // Items with on-hand stock joined to v_onhand_by_item.
  const [{ data: items }, { data: onhandItems }] = await Promise.all([
    supabase.from("items")
      .select("id, name, sku, uom, type, min_stock")
      .eq("org_id", member.org_id)
      .eq("is_active", true),
    supabase.from("v_onhand_by_item")
      .select("item_id, qty_onhand_kg")
      .eq("org_id", member.org_id),
  ]);

  const onhandMap: Record<string, number> = {};
  for (const r of onhandItems ?? [])
    onhandMap[(r as any).item_id] = Number((r as any).qty_onhand_kg) || 0;

  const itemAlerts = (items ?? [])
    .map((it: any) => {
      const threshold = it.min_stock != null ? Number(it.min_stock) : defaultMin;
      const onhand = onhandMap[it.id] ?? 0;
      return {
        kind: "item" as const,
        id: it.id,
        name: it.name,
        sku: it.sku,
        uom: it.uom ?? "kg",
        type: it.type,
        onhand,
        min_stock: threshold,
        is_default_threshold: it.min_stock == null,
        deficit: Math.max(0, threshold - onhand),
      };
    })
    .filter(r => r.onhand <= r.min_stock);

  // Sellable products (roasted SKUs with a min_stock configured).
  const { data: products } = await supabase
    .from("products")
    .select("id, name, sku, unit, min_stock, is_active")
    .eq("org_id", member.org_id)
    .eq("is_active", true)
    .not("min_stock", "is", null);

  const productAlerts = (products ?? []).map((p: any) => ({
    kind: "product" as const,
    id: p.id,
    name: p.name,
    sku: p.sku,
    uom: p.unit ?? "kg",
    type: "sellable",
    onhand: 0, // products stock not tracked in v_onhand_by_item; UI will note this
    min_stock: Number(p.min_stock),
    is_default_threshold: false,
    deficit: Number(p.min_stock),
  }));

  const all = [...itemAlerts, ...productAlerts].sort(
    (a, b) => b.deficit - a.deficit,
  );

  return NextResponse.json({
    ok: true,
    data: {
      default_min_stock_kg: defaultMin,
      alerts: all,
      counts: {
        items: itemAlerts.length,
        products: productAlerts.length,
        total: all.length,
      },
    },
  });
}
