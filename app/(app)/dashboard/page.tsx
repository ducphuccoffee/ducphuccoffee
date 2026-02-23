import { TopBar } from "@/components/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient();

  const [{ count: products }, { count: customers }, { count: orders }] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("customers").select("*", { count: "exact", head: true }),
    supabase.from("orders").select("*", { count: "exact", head: true }),
  ]);

  return (
    <div>
      <TopBar title="Dashboard" subtitle="Tổng quan vận hành hôm nay" />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Sản phẩm</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{products ?? 0}</div>
            <div className="mt-1 text-sm text-zinc-600">Đang hoạt động trong hệ thống</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Khách hàng</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{customers ?? 0}</div>
            <div className="mt-1 text-sm text-zinc-600">Có lịch sử mua hàng / công nợ</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Đơn hàng</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{orders ?? 0}</div>
            <div className="mt-1 text-sm text-zinc-600">Tổng số đơn đã tạo</div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Gợi ý tiếp theo</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-zinc-700">
            <div>• Tạo danh mục sản phẩm (raw/finished)</div>
            <div>• Tạo khách hàng + credit limit</div>
            <div>• Tạo batch rang để tính giá vốn theo mẻ</div>
            <div>• Tạo đơn hàng để theo dõi công nợ</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Kiểm tra kết nối</CardTitle></CardHeader>
          <CardContent className="text-sm text-zinc-700">
            Nếu bạn thấy số liệu ở trên = 0 nhưng không lỗi, nghĩa là app đã connect Supabase OK. 
            Nếu lỗi, hãy kiểm tra <code className="rounded bg-zinc-100 px-1">.env.local</code> và RLS/policies.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
