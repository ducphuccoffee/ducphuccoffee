import { TopBar } from "@/components/TopBar";
import { CrmReportClient } from "@/components/reports/CrmReportClient";

export const dynamic = "force-dynamic";

export default function CrmReportPage() {
  return (
    <div>
      <TopBar title="Báo cáo CRM" subtitle="CRM Report" />
      <div className="p-4">
        <CrmReportClient />
      </div>
    </div>
  );
}
