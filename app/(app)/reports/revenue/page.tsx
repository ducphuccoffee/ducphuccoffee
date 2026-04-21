import { TopBar } from "@/components/TopBar";
import { RevenueClient } from "@/components/reports/RevenueClient";

export const dynamic = "force-dynamic";

export default function RevenuePage() {
  return (
    <div>
      <TopBar title="Doanh thu" subtitle="Revenue Report" />
      <div className="p-4">
        <RevenueClient />
      </div>
    </div>
  );
}
