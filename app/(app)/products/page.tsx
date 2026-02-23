import { TopBar } from "@/components/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { DevSeedButton } from "@/components/DevSeedButton";
import { ProductsClient } from "@/components/products/ProductsClient";
import type { Product } from "@/lib/types";

export default async function ProductsPage() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select("id,name,sku,type,unit,sell_price,cost_price,is_active,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <TopBar title="Sản phẩm" subtitle="Quản lý nguyên liệu & thành phẩm" />
      <Card>
        <CardHeader>
          <CardTitle>Danh sách sản phẩm</CardTitle>
          <p className="mt-1 text-sm text-zinc-600">MVP: hiển thị 50 sản phẩm mới nhất</p>
            <div className="mt-3"><DevSeedButton /></div>
        </CardHeader>
        <CardContent>
          {error ? <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error.message}</div> : null}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-zinc-500">
                <tr>
                  <th className="py-2 pr-3">Tên</th>
                  <th className="py-2 pr-3">SKU</th>
                  <th className="py-2 pr-3">Loại</th>
                  <th className="py-2 pr-3">ĐVT</th>
                  <th className="py-2 pr-3">Giá bán</th>
                  <th className="py-2 pr-3">Giá vốn</th>
                  <th className="py-2 pr-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(data ?? []).map((p: any) => (
                  <tr key={p.id} className="hover:bg-zinc-50">
                    <td className="py-2 pr-3 font-medium">{p.name}</td>
                    <td className="py-2 pr-3 text-zinc-600">{p.sku}</td>
                    <td className="py-2 pr-3"><Badge>{p.type}</Badge></td>
                    <td className="py-2 pr-3 text-zinc-600">{p.unit}</td>
                    <td className="py-2 pr-3">{p.sell_price ?? 0}</td>
                    <td className="py-2 pr-3">{p.cost_price ?? 0}</td>
                    <td className="py-2 pr-3">{p.is_active ? <Badge className="bg-emerald-100 text-emerald-700">active</Badge> : <Badge>inactive</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-xs text-zinc-500">Tiếp theo: mình sẽ thêm form tạo/sửa/xóa + search/filter.</div>
        </CardContent>
      </Card>
    </div>
  );
}
