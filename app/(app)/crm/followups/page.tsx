import { TopBar } from "@/components/TopBar";
import { FollowupsClient } from "@/components/crm/FollowupsClient";

export const dynamic = "force-dynamic";

export default function FollowupsPage() {
  return (
    <div>
      <TopBar title="Follow-ups" subtitle="Trung tâm theo dõi" section="CRM" />
      <div className="p-4">
        <FollowupsClient />
      </div>
    </div>
  );
}
