import { TopBar } from "@/components/TopBar";
import { SalesKpiClient } from "@/components/reports/SalesKpiClient";

export const dynamic = "force-dynamic";

export default function SalesPage() {
  return (
    <div>
      <TopBar title="KPI Bán hàng" subtitle="Sales Performance" />
      <div className="p-4">
        <SalesKpiClient />
      </div>
    </div>
  );
}
