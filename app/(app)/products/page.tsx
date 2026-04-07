import { TopBar } from "@/components/TopBar";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ProductsClient, type Product, type GreenType } from "@/components/products/ProductsClient";

export default async function ProductsPage() {
  const supabase = createServerSupabaseClient();

  const [productsRes, greenTypesRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, sku, kind, unit, weight_per_unit, price, note, is_active, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("green_types")
      .select("id, name")
      .order("name"),
  ]);

  const products = (productsRes.data ?? []) as Product[];
  const greenTypes = (greenTypesRes.data ?? []) as GreenType[];
  const error = productsRes.error?.message ?? null;

  // Fetch formulas separately và map vào products
  const supabase2 = createServerSupabaseClient();
  const { data: formulasData } = await supabase2
    .from("product_formulas")
    .select("id, product_id, green_type_id, ratio_pct");

  const gtMap = Object.fromEntries(greenTypes.map((g) => [g.id, g.name]));
  const formulasByProduct: Record<string, any[]> = {};
  for (const f of formulasData ?? []) {
    if (!formulasByProduct[f.product_id]) formulasByProduct[f.product_id] = [];
    formulasByProduct[f.product_id].push({
      ...f,
      green_types: { name: gtMap[f.green_type_id] ?? f.green_type_id },
    });
  }
  const productsWithFormulas = products.map((p) => ({
    ...p,
    product_formulas: formulasByProduct[p.id] ?? [],
  }));

  return (
    <div>
      <TopBar
        title="Sản phẩm"
        subtitle="Quản lý sản phẩm bán ra — nguyên chất và blend"
      />
      <ProductsClient
        initialProducts={productsWithFormulas}
        greenTypes={greenTypes}
        error={error}
      />
    </div>
  );
}
