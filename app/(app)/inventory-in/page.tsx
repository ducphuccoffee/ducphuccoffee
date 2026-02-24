<h1 style={{ color: "red" }}>TEST INVENTORY PAGE</h1>
import { TopBar } from "@/components/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { GreenInbound, GreenType } from "@/lib/types";
import { InventoryInClient } from "@/components/inventory/InventoryInClient";

export default async function Page() {
  const supabase = createServerSupabaseClient();

  const typesRes = await supabase.from("green_types").select("*").order("created_at", { ascending: true });
  const inboundsRes = await supabase
    .from("v_green_inbounds")
    .select("*")
    .order("inbound_at", { ascending: false })
    .limit(200);

  const types = (typesRes.data || []) as GreenType[];
  const inbounds = (inboundsRes.data || []) as GreenInbound[];

  const error = typesRes.error?.message || inboundsRes.error?.message || null;

  return (
    <div>
      <TopBar title="Nhập hàng nhân xanh" subtitle="Tạo phiếu nhập theo lô • Tự cộng tồn kho" />

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>Cần chạy SQL schema</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-700 space-y-2">
            <div>Hệ thống chưa có bảng <code className="rounded bg-zinc-100 px-1">green_types</code> / <code className="rounded bg-zinc-100 px-1">green_inbounds</code>.</div>
            <div>Hãy dán file <code className="rounded bg-zinc-100 px-1">supabase-full-schema.sql</code> vào Supabase SQL Editor rồi refresh lại trang.</div>
            <div className="text-xs text-zinc-500">Chi tiết lỗi: {error}</div>
          </CardContent>
        </Card>
      ) : (
        <InventoryInClient initialTypes={types} initialInbounds={inbounds} />
      )}
    </div>
  );
}
