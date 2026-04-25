import { TopBar } from "@/components/TopBar";
import { ActivityHubClient } from "@/components/crm/ActivityHubClient";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function ActivitiesPage() {
  return (
    <div>
      <TopBar title="Hoạt động" subtitle="Ghi nhận · Follow-up · Chăm sóc KH" section="CRM" />
      <div className="p-4">
        <Suspense>
          <ActivityHubClient />
        </Suspense>
      </div>
    </div>
  );
}
