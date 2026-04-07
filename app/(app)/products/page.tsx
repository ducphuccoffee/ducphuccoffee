import { TopBar } from "@/components/TopBar";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ProductsClient, type Product, type GreenType } from "@/components/products/ProductsClient";

export default async function ProductsPage() {
  const supabase = createServerSupabaseClient();

  const [productsRes, greenTypesRes] = await Promise.all([
    supabase
      .from("products")
      .select(`
        id, name, sku, kind, unit, weight_per_unit, price, note, is_active, created_at,
        product_formulas (
          id, green_type_id, ratio_pct,
          green_types ( name )
        )
      `)
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

  return (
    <div>
      <TopBar
        title="Sản phẩm"
        subtitle="Quản lý sản phẩm bán ra — nguyên chất và blend"
      />
      <ProductsClient
        initialProducts={products}
        greenTypes={greenTypes}
        error={error}
      />
    </div>
  );
}
