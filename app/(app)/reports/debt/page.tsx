import { TopBar } from "@/components/TopBar";
import { DebtClient } from "@/components/reports/DebtClient";

export const dynamic = "force-dynamic";

export default function DebtPage() {
  return (
    <div>
      <TopBar title="Công nợ" subtitle="Customer Debt" />
      <div className="p-4">
        <DebtClient />
      </div>
    </div>
  );
}
