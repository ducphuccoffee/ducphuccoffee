import { TopBar } from "@/components/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Lead } from "@/lib/types";
import { LeadsClient } from "@/components/leads/LeadsClient";

export default async function Page() {
  const supabase = createServerSupabaseClient();

  const res = await supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(200);
  const leads = (res.data || []) as Lead[];

  return (
    <div>
      <TopBar title="CRM / Leads" subtitle="Lead → Đánh giá → Báo giá → Gửi mẫu → Test → Đàm phán → Chốt" />

      {res.error ? (
        <Card>
          <CardHeader>
            <CardTitle>Cần chạy SQL schema</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-700 space-y-2">
            <div>Chưa có bảng <code className="rounded bg-zinc-100 px-1">leads</code>.</div>
            <div>Hãy dán file <code className="rounded bg-zinc-100 px-1">supabase-full-schema.sql</code> vào Supabase SQL Editor rồi refresh lại trang.</div>
            <div className="text-xs text-zinc-500">Chi tiết lỗi: {res.error.message}</div>
          </CardContent>
        </Card>
      ) : (
        <LeadsClient initial={leads} />
      )}
    </div>
  );
}
