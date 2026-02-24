import { TopBar } from "@/components/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CommissionRow } from "@/lib/types";

function money(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(n || 0));
}

export default async function Page() {
  const supabase = createServerSupabaseClient();
  const res = await supabase.from("v_commissions_my").select("*").order("created_at", { ascending: false }).limit(200);
  const rows = (res.data || []) as CommissionRow[];

  return (
    <div>
      <TopBar title="Hoa hồng" subtitle="Tự tính khi thanh toán thành công • Hoàn trả sẽ trừ" />

      {res.error ? (
        <Card>
          <CardHeader><CardTitle>Cần chạy SQL schema</CardTitle></CardHeader>
          <CardContent className="text-sm text-zinc-700 space-y-2">
            <div>Chưa có view <code className="rounded bg-zinc-100 px-1">v_commissions_my</code>.</div>
            <div>Dán file <code className="rounded bg-zinc-100 px-1">supabase-full-schema.sql</code> vào Supabase SQL Editor rồi refresh lại trang.</div>
            <div className="text-xs text-zinc-500">Chi tiết lỗi: {res.error.message}</div>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-600">
              <tr>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3">Đơn</th>
                <th className="px-4 py-3">Số tiền</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Lý do</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3 text-zinc-600">{new Date(r.created_at).toLocaleString("vi-VN")}</td>
                  <td className="px-4 py-3 font-medium">{r.order_id}</td>
                  <td className="px-4 py-3">{money(Number(r.amount || 0))}</td>
                  <td className="px-4 py-3 text-zinc-600">{r.status}</td>
                  <td className="px-4 py-3 text-zinc-600">{r.reason}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-zinc-500">Chưa có hoa hồng</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
