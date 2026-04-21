import { TopBar } from "@/components/TopBar";
import { LeadsClient } from "@/components/crm/LeadsClient";

export const dynamic = "force-dynamic";

export default function LeadsPage() {
  return (
    <div>
      <TopBar title="Leads" subtitle="Quản lý khách hàng tiềm năng" section="CRM" />
      <div className="p-4">
        <LeadsClient />
      </div>
    </div>
  );
}
