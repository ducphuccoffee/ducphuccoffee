import { TopBar } from "@/components/TopBar";
import { CustomerDetailClient } from "@/components/crm/CustomerDetailClient";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <TopBar title="Chi tiết KH" subtitle="CRM" section="CRM" />
      <CustomerDetailClient customerId={id} />
    </div>
  );
}
