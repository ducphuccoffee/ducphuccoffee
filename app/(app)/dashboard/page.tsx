import { TopBar } from "@/components/TopBar";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  Package,
  Users,
  ShoppingCart,
  Factory,
  TrendingUp,
  TrendingDown,
  AlertCircle,
} from "lucide-react";

// ── Stats Card ───────────────────────────────────────────────────
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: "blue" | "green" | "amber" | "red" | "purple";
  trend?: { value: number; label: string };
}

const COLOR_MAP = {
  blue:   { ring: "ring-blue-100",   bg: "bg-blue-500",   badge: "bg-blue-50 text-blue-600" },
  green:  { ring: "ring-green-100",  bg: "bg-green-500",  badge: "bg-green-50 text-green-600" },
  amber:  { ring: "ring-amber-100",  bg: "bg-amber-500",  badge: "bg-amber-50 text-amber-600" },
  red:    { ring: "ring-red-100",    bg: "bg-red-500",    badge: "bg-red-50 text-red-600" },
  purple: { ring: "ring-purple-100", bg: "bg-purple-500", badge: "bg-purple-50 text-purple-600" },
};

function StatCard({ title, value, subtitle, icon: Icon, color, trend }: StatCardProps) {
  const c = COLOR_MAP[color];
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-5 flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ring-4 ${c.bg} ${c.ring}`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-gray-400 truncate">{title}</p>
        <p className="text-[28px] font-bold text-gray-800 leading-tight mt-0.5">{value}</p>
        {trend ? (
          <div className="flex items-center gap-1 mt-1">
            {trend.value >= 0
              ? <TrendingUp className="h-3.5 w-3.5 text-green-500" />
              : <TrendingDown className="h-3.5 w-3.5 text-red-500" />
            }
            <span className={`text-[12px] font-semibold ${trend.value >= 0 ? "text-green-500" : "text-red-500"}`}>
              {trend.value >= 0 ? "+" : ""}{trend.value}%
            </span>
            <span className="text-[11px] text-gray-400">{trend.label}</span>
          </div>
        ) : subtitle ? (
          <p className="text-[12px] text-gray-400 mt-1 truncate">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

// ── Quick action ─────────────────────────────────────────────────
function QuickAction({ href, label, desc, icon: Icon, color }: {
  href: string; label: string; desc: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md hover:border-blue-200 transition-all group"
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">{label}</p>
        <p className="text-[11px] text-gray-400 truncate">{desc}</p>
      </div>
    </a>
  );
}

// ── Page ─────────────────────────────────────────────────────────
export default async function DashboardPage() {
  const supabase = createServerSupabaseClient();

  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  const [
    { count: products },
    { count: customers },
    { count: orders },
    { count: batches },
    { count: ordersThisMonth },
    { data: recentOrders },
  ] = await Promise.all([
    supabase.from("products").select("*", { count: "exact", head: true }),
    supabase.from("customers").select("*", { count: "exact", head: true }),
    supabase.from("orders").select("*", { count: "exact", head: true }),
    supabase.from("roast_batches").select("*", { count: "exact", head: true }),
    supabase.from("orders").select("*", { count: "exact", head: true }).gte("created_at", startOfMonth),
    supabase.from("orders")
      .select("id, order_code, customer_name, total_amount, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const todayStr = today.toLocaleDateString("vi-VN", {
    weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
  });

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Tổng quan</p>
          <h1 className="text-[20px] font-bold text-gray-800 mt-0.5">
            Xin chào, Huỳnh Tài 👋
          </h1>
        </div>
        <p className="text-[12px] text-gray-400 hidden sm:block">{todayStr}</p>
      </div>

      {/* ── Stats grid ─────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Sản phẩm"
          value={products ?? 0}
          subtitle="Đang hoạt động"
          icon={Package}
          color="blue"
        />
        <StatCard
          title="Khách hàng"
          value={customers ?? 0}
          subtitle="Có lịch sử giao dịch"
          icon={Users}
          color="purple"
        />
        <StatCard
          title="Đơn hàng tháng này"
          value={ordersThisMonth ?? 0}
          subtitle={`Tổng: ${orders ?? 0} đơn`}
          icon={ShoppingCart}
          color="green"
        />
        <StatCard
          title="Batch sản xuất"
          value={batches ?? 0}
          subtitle="Đã tạo trong hệ thống"
          icon={Factory}
          color="amber"
        />
      </div>

      {/* ── Recent orders + Quick actions ─ */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Recent orders */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-[14px] font-bold text-gray-800">Đơn hàng gần đây</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">5 đơn hàng mới nhất</p>
            </div>
            <a href="/orders" className="text-[12px] text-blue-500 hover:underline font-medium">
              Xem tất cả →
            </a>
          </div>
          <div className="divide-y divide-gray-100">
            {(!recentOrders || recentOrders.length === 0) ? (
              <div className="flex flex-col items-center py-10 text-center gap-2">
                <AlertCircle className="h-8 w-8 text-gray-300" />
                <p className="text-[13px] text-gray-400">Chưa có đơn hàng nào</p>
                <a href="/orders" className="text-[12px] text-blue-500 hover:underline">
                  Tạo đơn hàng đầu tiên →
                </a>
              </div>
            ) : (
              recentOrders.map((order: any) => (
                <a
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-gray-800 truncate">
                      {order.order_code || `#${order.id.slice(0, 8)}`}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">{order.customer_name || "—"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-bold text-gray-800">
                      {order.total_amount
                        ? new Intl.NumberFormat("vi-VN").format(order.total_amount) + "đ"
                        : "—"
                      }
                    </p>
                    <span className={[
                      "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                      order.status === "completed" ? "bg-green-100 text-green-700" :
                      order.status === "pending"   ? "bg-amber-100 text-amber-700" :
                      "bg-gray-100 text-gray-600"
                    ].join(" ")}>
                      {order.status || "draft"}
                    </span>
                  </div>
                </a>
              ))
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="space-y-3">
          <h2 className="text-[14px] font-bold text-gray-800">Thao tác nhanh</h2>
          <QuickAction href="/orders"    label="Tạo đơn hàng"   desc="Ghi đơn mới cho khách" icon={ShoppingCart} color="bg-blue-500" />
          <QuickAction href="/customers" label="Thêm khách hàng" desc="Tạo hồ sơ khách hàng"  icon={Users}        color="bg-purple-500" />
          <QuickAction href="/batches"   label="Tạo batch rang"  desc="Ghi lại mẻ sản xuất"   icon={Factory}      color="bg-amber-500" />
          <QuickAction href="/products"  label="Thêm sản phẩm"   desc="Cập nhật danh mục"     icon={Package}      color="bg-green-500" />
        </div>

      </div>
    </div>
  );
}
