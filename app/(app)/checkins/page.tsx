import { TopBar } from "@/components/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Checkin } from "@/lib/types";
import { CheckinsClient } from "@/components/sfa/CheckinsClient";

export default async function Page() {
  const supabase = createServerSupabaseClient();
  const res = await supabase.from("checkins").select("*").order("checkin_at", { ascending: false }).limit(200);
  const rows = (res.data || []) as Checkin[];

  return (
    <div>
      <TopBar title="Check-in thị trường" subtitle="Sales/CTV check-in GPS + ghi chú" />
      {res.error ? (
        <Card>
          <CardHeader><CardTitle>Cần chạy SQL schema</CardTitle></CardHeader>
          <CardContent className="text-sm text-zinc-700 space-y-2">
            <div>Chưa có bảng <code className="rounded bg-zinc-100 px-1">checkins</code>.</div>
            <div>Dán file <code className="rounded bg-zinc-100 px-1">supabase-full-schema.sql</code> vào Supabase SQL Editor rồi refresh lại trang.</div>
            <div className="text-xs text-zinc-500">Chi tiết lỗi: {res.error.message}</div>
          </CardContent>
        </Card>
      ) : (
        <CheckinsClient initial={rows} />
      )}
    </div>
  );
}
