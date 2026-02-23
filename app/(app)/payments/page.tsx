import { TopBar } from "@/components/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function Page() {
  const supabase = createServerSupabaseClient();
  // NOTE: chưa dùng supabase ở page này, để sẵn cho bước build flow thu tiền
  void supabase;

  return (
    <div>
      <TopBar title="Thu tiền" subtitle="Ghi nhận thanh toán, theo dõi công nợ" />
      <Card>
        <CardHeader>
          <CardTitle>MVP</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-zinc-700">
          <div>
            Trang Thu tiền đã có route. Bước tiếp theo: form tạo payment + list payments + công nợ theo khách.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}