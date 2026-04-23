import { TopBar } from "@/components/TopBar";
import { SalesTodayClient } from "@/components/crm/SalesTodayClient";

export const dynamic = "force-dynamic";

export default function SalesTodayPage() {
  const today = new Date().toLocaleDateString("vi-VN", {
    weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
  });
  return (
    <div>
      <TopBar title="Việc hôm nay" subtitle={today} section="CRM" />
      <div className="p-4">
        <SalesTodayClient />
      </div>
    </div>
  );
}
