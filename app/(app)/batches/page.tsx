import { TopBar } from "@/components/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function Page() {
  const supabase = createServerSupabaseClient();
  // NOTE: hiện chưa dùng supabase ở page này, để sẵn cho bước build flow batch
  void supabase;

  return (
    <div>
      <TopBar title="Batch rang" subtitle="Tạo batch + tính giá vốn/kg + ghi kho" />
      <Card>
        <CardHeader>
          <CardTitle>MVP</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-zinc-700">
          <div>
            Trang này đã có route + layout. Mình sẽ build UI & flow chi tiết theo quy trình xưởng rang của bạn.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}