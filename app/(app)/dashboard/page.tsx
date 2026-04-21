import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatWeekdayDateVN } from "@/lib/date";
import TaskBoard from "@/components/dashboard/TaskBoard";
import { StockDashboard } from "@/components/dashboard/StockDashboard";
import {
  Package,
  Users,
  ShoppingCart,
  Factory,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Truck,
  CheckCircle,
  Clock,
  Banknote,
} from "lucide-react";


// ── Components ───────────────────────────────────────────────────
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: "blue" | "green" | "amber" | "red" | "purple" | "slate";
  trend?: { value: number; label: string };
}

const COLOR_MAP = {
  blue:   { ring: "ring-blue-100",   bg: "bg-blue-500",   text: "text-blue-600" },
  green:  { ring: "ring-green-100",  bg: "bg-green-500",  text: "text-green-600" },
  amber:  { ring: "ring-amber-100",  bg: "bg-amber-500",  text: "text-amber-600" },
  red:    { ring: "ring-red-100",    bg: "bg-red-500",    text: "text-red-600" },
  purple: { ring: "ring-purple-100", bg: "bg-purple-500", text: "text-purple-600" },
  slate:  { ring: "ring-slate-100",  bg: "bg-slate-500",  text: "text-slate-600" },
};

function StatCard({ title, value, subtitle, icon: Icon, color, trend }: StatCardProps) {
  const c = COLOR_MAP[color];
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-4 flex items-center gap-3 hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ring-4 ${c.bg} ${c.ring}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-gray-400 truncate uppercase tracking-wide">{title}</p>
        <p className="text-[24px] font-bold text-gray-800 leading-tight mt-0.5">{value}</p>
        {trend ? (
          <div className="flex items-center gap-1 mt-0.5">
            {trend.value >= 0
              ? <TrendingUp className="h-3 w-3 text-green-500" />
              : <TrendingDown className="h-3 w-3 text-red-500" />}
            <span className={`text-[11px] font-semibold ${trend.value >= 0 ? "text-green-500" : "text-red-500"}`}>
              {trend.value >= 0 ? "+" : ""}{trend.value}%
            </span>
            <span className="text-[10px] text-gray-400">{trend.label}</span>
          </div>
        ) : subtitle ? (
          <p className="text-[11px] text-gray-400 mt-0.5 truncate">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

function OpsCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl border p-3 ${color}`}>
      <p className="text-[22px] font-bold leading-tight">{value}</p>
      <p className="text-xs font-medium mt-0.5 opacity-80">{label}</p>
    </div>
  );
}

function QuickAction({ href, label, desc, icon: Icon, color }: {
  href: string; label: string; desc: string; icon: React.ElementType; color: string;
}) {
  return (
    <a href={href}
      className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200 hover:shadow-md hover:border-blue-200 transition-all group">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">{label}</p>
        <p className="text-[11px] text-gray-400 truncate">{desc}</p>
      </div>
    </a>
  );
}

const VN_FMT = new Intl.NumberFormat("vi-VN");
const money  = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND",
    notation: n >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: n >= 1_000_000 ? 1 : 0,
  }).format(n);

// ── Page ─────────────────────────────────────────────────────────
export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();

  const today   = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  const recentOrderSelect = "id, status, total_amount, created_at, customers(name)";
  const monthOrderSelect  = "id, status, total_amount";

  const [
    { data: { user } },
    { data: recentOrdersRaw },
    { data: allOrdersThisMonth },
    { data: ordersToday },
    { count: totalCustomers },
    { count: totalProducts },
    { count: totalBatches },
  ] = await Promise.all([
    supabase.auth.getUser(),

    supabase.from("orders")
      .select(recentOrderSelect)
      .order("created_at", { ascending: false })
      .limit(5),

    supabase.from("orders")
      .select(monthOrderSelect)
      .gte("created_at", monthStart),

    supabase.from("orders")
      .select("id, status, total_amount")
      .gte("created_at", todayStart),

    supabase.from("customers").select("*", { count: "exact", head: true }),
    supabase.from("products").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("roast_batches").select("*", { count: "exact", head: true }),
  ]);

  let displayName = "bạn";
  let userRole    = "staff";
  if (user) {
    const [{ data: profile }, { data: member }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      supabase.from("org_members").select("role").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle(),
    ]);
    displayName = profile?.full_name || user.email?.split("@")[0] || "bạn";
    userRole    = member?.role ?? "staff";
  }

  // ── Financial metrics ─────────────────────────────────────────
  const monthOrders = allOrdersThisMonth || [];
  const todayOrders = ordersToday || [];

  // Revenue = delivered + closed (current DB enum values)
  const revStatuses = ["delivered", "completed"];

  const revenueThisMonth = monthOrders
    .filter((o: any) => revStatuses.includes(o.status))
    .reduce((s: number, o: any) => s + (Number(o.total_amount) || 0), 0);

  const revenueToday = todayOrders
    .filter((o: any) => revStatuses.includes(o.status))
    .reduce((s: number, o: any) => s + (Number(o.total_amount) || 0), 0);

  const ordersCountToday = todayOrders.length;
  const ordersCountMonth = monthOrders.length;

  // ── Operational metrics ───────────────────────────────────────
  const opsNew       = monthOrders.filter((o: any) => o.status === "new").length;
  const opsPreparing = monthOrders.filter((o: any) => ["accepted", "preparing", "ready_to_ship"].includes(o.status)).length;
  const opsShipping  = monthOrders.filter((o: any) => o.status === "shipping").length;
  const opsDelivered = monthOrders.filter((o: any) => ["delivered", "completed"].includes(o.status)).length;
  const opsDebt      = 0; // no payment_status column yet

  const todayStr = formatWeekdayDateVN(today);

  const recentOrders = (recentOrdersRaw || []).map((o: any) => ({
    ...o,
    order_code:    `#${o.id.slice(0, 8).toUpperCase()}`,
    customer_name: (o.customers as any)?.name || "—",
  }));

  const ORDER_STATUS_LABEL: Record<string, string> = {
    new:           "Mới",
    accepted:      "Đã tiếp nhận",
    preparing:     "Đang chuẩn bị",
    ready_to_ship: "Sẵn sàng giao",
    shipping:      "Đang giao",
    delivered:     "Đã giao",
    completed:     "Hoàn thành",
    cancelled:     "Đã huỷ",
    failed:        "Thất bại",
  };
  const ORDER_STATUS_COLOR: Record<string, string> = {
    new:           "bg-gray-100 text-gray-500",
    accepted:      "bg-blue-100 text-blue-700",
    preparing:     "bg-amber-100 text-amber-700",
    ready_to_ship: "bg-purple-100 text-purple-700",
    shipping:      "bg-indigo-100 text-indigo-700",
    delivered:     "bg-green-100 text-green-700",
    completed:     "bg-emerald-100 text-emerald-700",
    cancelled:     "bg-red-100 text-red-700",
    failed:        "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-5 pb-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Tổng quan</p>
          <h1 className="text-[20px] font-bold text-gray-800 mt-0.5">Xin chào, {displayName} 👋</h1>
        </div>
        <p className="text-[12px] text-gray-400 hidden sm:block">{todayStr}</p>
      </div>

      {/* Financial KPIs */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Tài chính</p>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <StatCard
            title="Doanh thu hôm nay"
            value={money(revenueToday)}
            subtitle={`${ordersCountToday} đơn hôm nay`}
            icon={Banknote}
            color="green"
          />
          <StatCard
            title="Doanh thu tháng này"
            value={money(revenueThisMonth)}
            subtitle={`${ordersCountMonth} đơn tháng này`}
            icon={TrendingUp}
            color="blue"
          />
          <StatCard
            title="Khách hàng"
            value={totalCustomers ?? 0}
            subtitle="Tổng khách hàng"
            icon={Users}
            color="purple"
          />
          <StatCard
            title="Batch sản xuất"
            value={totalBatches ?? 0}
            subtitle="Đã tạo"
            icon={Factory}
            color="amber"
          />
        </div>
      </div>

      {/* Operational pipeline */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Vận hành tháng này</p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          <OpsCard label="Mới tạo"        value={opsNew}       color="bg-sky-50 border-sky-200 text-sky-700" />
          <OpsCard label="Đang xử lý"     value={opsPreparing} color="bg-amber-50 border-amber-200 text-amber-700" />
          <OpsCard label="Đang giao"       value={opsShipping}  color="bg-purple-50 border-purple-200 text-purple-700" />
          <OpsCard label="Đã giao / Xong" value={opsDelivered} color="bg-emerald-50 border-emerald-200 text-emerald-700" />
          <OpsCard label="Công nợ"         value={opsDebt}      color="bg-red-50 border-red-200 text-red-700" />
        </div>
      </div>

      {/* Recent orders + quick actions */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Recent orders */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-[14px] font-bold text-gray-800">Đơn hàng gần đây</h2>
              <p className="text-[11px] text-gray-400 mt-0.5">5 đơn mới nhất</p>
            </div>
            <a href="/orders" className="text-[12px] text-blue-500 hover:underline font-medium">Xem tất cả →</a>
          </div>
          <div className="divide-y divide-gray-100">
            {recentOrders.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center gap-2">
                <AlertCircle className="h-7 w-7 text-gray-300" />
                <p className="text-[13px] text-gray-400">Chưa có đơn hàng nào</p>
                <a href="/orders" className="text-[12px] text-blue-500 hover:underline">Tạo đơn hàng đầu tiên →</a>
              </div>
            ) : (
              recentOrders.map((order: any) => (
                <a key={order.id} href="/orders"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-gray-800 truncate font-mono">
                      {order.order_code}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">{order.customer_name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-bold text-gray-800">
                      {order.total_amount
                        ? VN_FMT.format(order.total_amount) + "đ"
                        : "—"}
                    </p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ORDER_STATUS_COLOR[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {ORDER_STATUS_LABEL[order.status] ?? order.status}
                    </span>
                  </div>
                </a>
              ))
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="space-y-2">
          <h2 className="text-[14px] font-bold text-gray-800 mb-2">Thao tác nhanh</h2>
          <QuickAction href="/orders"     label="Tạo đơn hàng"    desc="Ghi đơn mới cho khách" icon={ShoppingCart} color="bg-blue-500" />
          <QuickAction href="/customers"  label="Thêm khách hàng" desc="Tạo hồ sơ khách hàng"  icon={Users}        color="bg-purple-500" />
          <QuickAction href="/batches"    label="Tạo batch rang"   desc="Ghi lại mẻ sản xuất"   icon={Factory}      color="bg-amber-500" />
          <QuickAction href="/products"   label="Thêm sản phẩm"   desc="Cập nhật danh mục"     icon={Package}      color="bg-green-500" />
        </div>
      </div>

      {/* Stock dashboard */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Tồn kho & Sản xuất</p>
        <StockDashboard />
      </div>

      {/* Task board */}
      {user && <TaskBoard userId={user.id} userRole={userRole} />}

    </div>
  );
}
