import { TopBar } from "@/components/TopBar";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { RoastBatch, GreenStock } from "@/lib/batch-types";
import { BatchesClient } from "@/components/batches/BatchesClient";

export default async function BatchesPage() {
  const supabase = createServerSupabaseClient();

  // Dùng column thực tế trong DB (bảng cũ dùng roasted_at, bảng mới có roast_date)
  // Query tất cả columns để tránh lỗi nếu schema chưa đồng bộ hoàn toàn
  const [batchesRes, stockRes] = await Promise.all([
    supabase
      .from("roast_batches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("v_green_stock")
      .select("*")
      .order("inbound_at", { ascending: true }),
  ]);

  const batches = (batchesRes.data ?? []) as RoastBatch[];
  const stock = (stockRes.data ?? []) as GreenStock[];

  // Nếu v_green_stock lỗi (chưa có FK), trả stock rỗng thay vì crash
  const error = batchesRes.error?.message ?? null;

  return (
    <div>
      <TopBar
        title="Batch rang cà phê"
        subtitle="Quản lý lô rang — tính hao hụt và giá vốn/kg"
      />
      <BatchesClient
        initialBatches={batches}
        initialStock={stock}
        error={error}
      />
    </div>
  );
}
