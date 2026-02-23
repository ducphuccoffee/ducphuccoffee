import { TopBar } from "@/components/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DevSeedButton } from "@/components/DevSeedButton";
import { CustomersClient } from "@/components/customers/CustomersClient";
import type { Customer } from "@/lib/types";

export default async function CustomersPage() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id,name,phone,email,address,credit_limit,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <TopBar title="Khách hàng" subtitle="CRM cơ bản + credit limit" />
      <Card>
        <CardHeader>
          <CardTitle>Danh sách khách hàng</CardTitle>
          <p className="mt-1 text-sm text-zinc-600">MVP: hiển thị 50 khách hàng mới nhất</p>
            <div className="mt-3"><DevSeedButton /></div>
        </CardHeader>
        <CardContent>
          {error ? <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error.message}</div> : null}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-zinc-500">
                <tr>
                  <th className="py-2 pr-3">Tên</th>
                  <th className="py-2 pr-3">Điện thoại</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Credit limit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(data ?? []).map((c: any) => (
                  <tr key={c.id} className="hover:bg-zinc-50">
                    <td className="py-2 pr-3 font-medium">{c.name}</td>
                    <td className="py-2 pr-3 text-zinc-600">{c.phone}</td>
                    <td className="py-2 pr-3 text-zinc-600">{c.email}</td>
                    <td className="py-2 pr-3">{c.credit_limit ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-xs text-zinc-500">Tiếp theo: màn chi tiết khách + lịch sử đơn hàng + công nợ.</div>
        </CardContent>
      </Card>
    </div>
  );
}
