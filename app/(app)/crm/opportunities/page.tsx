import { TopBar } from "@/components/TopBar";
import { OpportunitiesClient } from "@/components/crm/OpportunitiesClient";

export const dynamic = "force-dynamic";

export default function OpportunitiesPage() {
  return (
    <div>
      <TopBar title="Cơ hội" subtitle="Pipeline bán hàng" section="CRM" />
      <div className="p-4">
        <OpportunitiesClient />
      </div>
    </div>
  );
}
