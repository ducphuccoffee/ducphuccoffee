import { TopBar } from "@/components/TopBar";
import { StockClient } from "@/components/reports/StockClient";

export const dynamic = "force-dynamic";

export default function StockPage() {
  return (
    <div>
      <TopBar title="Tồn kho" subtitle="Stock Report" />
      <div className="p-4">
        <StockClient />
      </div>
    </div>
  );
}
