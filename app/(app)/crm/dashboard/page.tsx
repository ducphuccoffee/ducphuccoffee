import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCrmDashboardData, type RiskCustomer } from "@/lib/crm";
import { ATTENTION_CONFIG, CRM_THRESHOLDS } from "@/lib/crm-automation";
import Link from "next/link";

export const dynamic = "force-dynamic";

const ACTIVITY_ICON: Record<string, string> = {
  order: "🛒",
  note: "📝",
  visit: "📍",
};

export default async function CrmDashboardPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <div className="p-8 text-red-500">Chưa đăng nhập</div>;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const crmUser = { id: user.id, role: profile?.role ?? "sales" };
  const isAdmin = ["admin", "manager", "roastery_manager"].includes(crmUser.role);
  const d = await getCrmDashboardData(crmUser);

  const hasCritical =
    d.overdueCustomers.length > 0 || d.atRiskCustomers.length > 0;

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-800">CRM Dashboard</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {isAdmin ? "Toàn bộ dữ liệu" : "Dữ liệu của bạn"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/crm/care"
            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition"
          >
            Customer Care
          </Link>
          <Link
            href="/crm/sfa"
            className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition"
          >
            SFA
          </Link>
        </div>
      </div>

      {/* Critical alert banner */}
      {hasCritical && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-2xl shrink-0">🚨</span>
          <div>
            <p className="text-sm font-semibold text-red-700">Cần xử lý ngay</p>
            <p className="text-xs text-red-600 mt-0.5">
              {d.overdueCustomers.length > 0 &&
                `${d.overdueCustomers.length} khách follow-up quá hạn. `}
              {d.atRiskCustomers.length > 0 &&
                `${d.atRiskCustomers.length} khách có nguy cơ rời đi (${CRM_THRESHOLDS.DAYS_AT_RISK}+ ngày chưa mua).`}
            </p>
          </div>
        </div>
      )}

      {/* KPI cards — 2×2 on mobile, 3+1 on desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Khách phụ trách" value={d.myCustomers} color="blue" icon="👥" />
        <KpiCard
          label="Follow-up hôm nay"
          value={d.followUpToday}
          color={d.followUpToday > 0 ? "amber" : "gray"}
          icon="⏰"
          badge={d.overdueFollowUp > 0 ? `${d.overdueFollowUp} trễ` : undefined}
          badgeColor="red"
        />
        <KpiCard label="Đơn hôm nay" value={d.ordersToday} color="emerald" icon="🛒" />
        <KpiCard
          label="Doanh thu hôm nay"
          value={d.revenueToday.toLocaleString("vi-VN") + "₫"}
          color="purple"
          icon="💰"
          large
        />
      </div>

      {/* Two-column alerts section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Overdue follow-ups */}
        <AlertPanel
          title="Follow-up quá hạn"
          icon="⏰"
          color="purple"
          items={d.overdueCustomers}
          emptyText="Không có follow-up quá hạn"
          renderSub={(r) =>
            r.overdue_days != null
              ? `Trễ ${r.overdue_days} ngày`
              : "Quá hạn"
          }
        />

        {/* At-risk customers */}
        <AlertPanel
          title={`Khách sắp rớt (${CRM_THRESHOLDS.DAYS_AT_RISK}+ ngày)`}
          icon="⚠"
          color="red"
          items={d.atRiskCustomers}
          emptyText="Không có khách nguy cơ rời đi"
          renderSub={(r) =>
            r.days_since_last_order != null
              ? `${r.days_since_last_order} ngày chưa mua`
              : "Chưa có đơn"
          }
        />
      </div>

      {/* Due today */}
      {d.dueFollowUps.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-100">
            <h2 className="text-sm font-semibold text-amber-800">
              📅 Follow-up hôm nay ({d.dueFollowUps.length})
            </h2>
          </div>
          <ul className="divide-y divide-amber-50">
            {d.dueFollowUps.map((r) => (
              <li key={r.customer_id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{r.customer_name}</p>
                  {r.phone && <p className="text-xs text-gray-400">{r.phone}</p>}
                </div>
                {r.next_follow_up_at && (
                  <span className="text-xs text-amber-600 shrink-0">
                    {new Date(r.next_follow_up_at).toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent activity */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Hoạt động gần đây</h2>
          <Link href="/crm/care" className="text-xs text-blue-600 hover:underline">
            Xem tất cả →
          </Link>
        </div>
        {d.recentActivity.length === 0 ? (
          <p className="px-5 py-8 text-center text-gray-400 text-sm">Chưa có hoạt động</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {d.recentActivity.map((item, i) => (
              <li key={i} className="flex items-start gap-3 px-4 py-3">
                <span className="text-lg shrink-0 mt-0.5">
                  {ACTIVITY_ICON[item.type] ?? "•"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{item.label}</p>
                  <p className="text-xs text-gray-500 truncate">{item.sub}</p>
                </div>
                <span className="text-xs text-gray-400 shrink-0 mt-0.5">
                  {new Date(item.ts).toLocaleString("vi-VN", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  color,
  icon,
  large = false,
  badge,
  badgeColor = "gray",
}: {
  label: string;
  value: string | number;
  color: string;
  icon: string;
  large?: boolean;
  badge?: string;
  badgeColor?: string;
}) {
  const bg: Record<string, string> = {
    blue:    "bg-blue-50 border-blue-100",
    amber:   "bg-amber-50 border-amber-100",
    emerald: "bg-emerald-50 border-emerald-100",
    purple:  "bg-purple-50 border-purple-100",
    red:     "bg-red-50 border-red-100",
    gray:    "bg-gray-50 border-gray-100",
  };
  const text: Record<string, string> = {
    blue:    "text-blue-700",
    amber:   "text-amber-700",
    emerald: "text-emerald-700",
    purple:  "text-purple-700",
    red:     "text-red-700",
    gray:    "text-gray-600",
  };
  const bdgBg: Record<string, string> = {
    red:  "bg-red-500 text-white",
    gray: "bg-gray-200 text-gray-600",
  };
  return (
    <div className={`rounded-xl border p-3 relative ${bg[color] ?? bg.gray}`}>
      {badge && (
        <span
          className={`absolute top-2 right-2 text-xs font-bold px-1.5 py-0.5 rounded-full ${bdgBg[badgeColor] ?? bdgBg.gray}`}
        >
          {badge}
        </span>
      )}
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-base">{icon}</span>
        <p className="text-xs text-gray-500 font-medium leading-tight">{label}</p>
      </div>
      <p
        className={`font-bold leading-tight ${large ? "text-base" : "text-2xl"} ${text[color] ?? text.gray}`}
      >
        {value}
      </p>
    </div>
  );
}

function AlertPanel({
  title,
  icon,
  color,
  items,
  emptyText,
  renderSub,
}: {
  title: string;
  icon: string;
  color: "red" | "purple" | "amber";
  items: RiskCustomer[];
  emptyText: string;
  renderSub: (r: RiskCustomer) => string;
}) {
  const border: Record<string, string> = {
    red:    "border-red-200 bg-red-50",
    purple: "border-purple-200 bg-purple-50",
    amber:  "border-amber-200 bg-amber-50",
  };
  const hdr: Record<string, string> = {
    red:    "text-red-800 border-red-100",
    purple: "text-purple-800 border-purple-100",
    amber:  "text-amber-800 border-amber-100",
  };
  const sub: Record<string, string> = {
    red:    "text-red-600",
    purple: "text-purple-600",
    amber:  "text-amber-600",
  };

  return (
    <div className={`rounded-xl border overflow-hidden ${border[color]}`}>
      <div className={`px-4 py-3 border-b ${hdr[color]}`}>
        <h2 className="text-sm font-semibold">
          {icon} {title} ({items.length})
        </h2>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-gray-400 text-xs">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-white/60 max-h-56 overflow-y-auto">
          {items.map((r) => (
            <li key={r.customer_id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{r.customer_name}</p>
                <p className={`text-xs ${sub[color]} truncate`}>{renderSub(r)}</p>
              </div>
              {r.phone && (
                <a
                  href={`tel:${r.phone}`}
                  className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1 text-gray-600 hover:bg-gray-50 shrink-0"
                >
                  📞
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
