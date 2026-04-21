import { TopBar } from "@/components/TopBar";
import { ActivitiesClient } from "@/components/crm/ActivitiesClient";

export const dynamic = "force-dynamic";

export default function ActivitiesPage() {
  return (
    <div>
      <TopBar title="Hoạt động" subtitle="CRM Activities" section="CRM" />
      <div className="p-4">
        <ActivitiesClient />
      </div>
    </div>
  );
}
