import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCrmDashboardData } from "@/lib/crm";
import Link from "next/link";

export const dynamic = "force-dynamic";

const ACTIVITY_ICON: Record<string, string> = {
  order: "🛒",
  note:  "📝",
  visit: "📍",
};

export default async function CrmDashboardPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return <div className="p-8 text-red-500">Chưa đăng nhập</div>;

  const { data: member } = await supabase
    .from("org_members").select("role")
    .eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle();

  const crmUser  = { id: user.id, role: member?.role ?? "sales" };
  const isAdmin  = ["admin", "manager"].includes(crmUser.role);
  const dashData = await getCrmDashboardData(crmUser);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">CRM Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isAdmin ? "Toàn bộ dữ liệu" : "Dữ liệu của bạn"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/crm/care"
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">
            Customer Care
          </Link>
          <Link href="/crm/sfa"
            className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition">
            SFA
          </Link>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Khách phụ trách" value={dashData.myCustomers} color="blue" icon="👥" />
        <KpiCard label="Follow-up hôm nay" value={dashData.followUpToday} color="amber" icon="⏰" />
        <KpiCard label="Đơn hôm nay" value={dashData.ordersToday} color="emerald" icon="🛒" />
        <KpiCard
          label="Doanh thu hôm nay"
          value={dashData.revenueToday.toLocaleString("vi-VN") + " ₫"}
          color="purple"
          icon="💰"
          large
        />
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Hoạt động gần đây</h2>
        </div>
        {dashData.recentActivity.length === 0 ? (
          <p className="px-5 py-8 text-center text-gray-400 text-sm">Chưa có hoạt động</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {dashData.recentActivity.map((item, i) => (
              <li key={i} className="flex items-start gap-3 px-5 py-3">
                <span className="text-xl shrink-0">{ACTIVITY_ICON[item.type] ?? "•"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{item.label}</p>
                  <p className="text-xs text-gray-500 truncate">{item.sub}</p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {new Date(item.ts).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label, value, color, icon, large = false,
}: {
  label: string; value: string | number; color: string; icon: string; large?: boolean;
}) {
  const colorMap: Record<string, string> = {
    blue:   "bg-blue-50 border-blue-100",
    amber:  "bg-amber-50 border-amber-100",
    emerald:"bg-emerald-50 border-emerald-100",
    purple: "bg-purple-50 border-purple-100",
  };
  const textMap: Record<string, string> = {
    blue:   "text-blue-700",
    amber:  "text-amber-700",
    emerald:"text-emerald-700",
    purple: "text-purple-700",
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] ?? "bg-gray-50 border-gray-100"}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
      </div>
      <p className={`font-bold ${large ? "text-lg" : "text-3xl"} ${textMap[color] ?? "text-gray-700"}`}>
        {value}
      </p>
    </div>
  );
}
