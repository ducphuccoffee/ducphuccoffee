import { TopBar } from "@/components/TopBar";
import { PipelineClient } from "@/components/crm/PipelineClient";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function PipelinePage() {
  return (
    <div>
      <TopBar title="Pipeline" subtitle="Leads · Cơ hội bán hàng" section="CRM" />
      <div className="p-4">
        <Suspense>
          <PipelineClient />
        </Suspense>
      </div>
    </div>
  );
}
