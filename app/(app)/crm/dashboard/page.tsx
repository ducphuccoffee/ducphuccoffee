import { TopBar } from "@/components/TopBar";
import { CrmDashboardClient } from "@/components/crm/CrmDashboardClient";

export const dynamic = "force-dynamic";

export default function CrmDashboardPage() {
  return (
    <div>
      <TopBar title="CRM Dashboard" subtitle="Quản lý bán hàng" />
      <div className="p-4">
        <CrmDashboardClient />
      </div>
    </div>
  );
}
