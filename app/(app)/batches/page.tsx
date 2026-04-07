import { TopBar } from "@/components/TopBar";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { RoastBatch, GreenStock } from "@/lib/batch-types";
import { BatchesClient } from "@/components/batches/BatchesClient";

export default async function BatchesPage() {
  const supabase = createServerSupabaseClient();

  const [batchesRes, stockRes] = await Promise.all([
    supabase
      .from("roast_batches")
      .select("*")
      .order("roast_date", { ascending: false })
      .limit(200),
    supabase
      .from("v_green_stock")
      .select("*")
      .gte("remaining_kg", 0)
      .order("inbound_at", { ascending: true }),
  ]);

  const batches = (batchesRes.data ?? []) as RoastBatch[];
  const stock = (stockRes.data ?? []) as GreenStock[];
  const error = batchesRes.error?.message ?? stockRes.error?.message ?? null;

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
