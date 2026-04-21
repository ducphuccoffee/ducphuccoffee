import { TopBar } from "@/components/TopBar";
import { CommissionsClient } from "@/components/crm/CommissionsClient";

export const dynamic = "force-dynamic";

export default function CommissionsPage() {
  return (
    <div>
      <TopBar title="Hoa hồng" subtitle="Commission" />
      <div className="p-4">
        <CommissionsClient />
      </div>
    </div>
  );
}
