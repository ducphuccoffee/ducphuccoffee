import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatWeekdayDateVN } from "@/lib/date";
import TaskBoard from "@/components/dashboard/TaskBoard";
import { StockAlertsCard } from "@/components/dashboard/StockAlertsCard";
import { CrmSnapshotCard } from "@/components/dashboard/CrmSnapshotCard";
import { Banknote, TrendingUp, Users, ShoppingCart, Package, Factory, TrendingDown, AlertCircle } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────
const VN_FMT = new Intl.NumberFormat("vi-VN");
const money = (n: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency", currency: "VND",
    notation: n >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: n >= 1_000_000 ? 1 : 0,
  }).format(n);

const COLOR_MAP = {
  blue:   { bg: "bg-blue-500",   ring: "ring-blue-100",   text: "text-blue-600" },
  green:  { bg: "bg-green-500",  ring: "ring-green-100",  text: "text-green-600" },
  amber:  { bg: "bg-amber-500",  ring: "ring-amber-100",  text: "text-amber-600" },
  purple: { bg: "bg-purple-500", ring: "ring-purple-100", text: "text-purple-600" },
};

function StatCard({ title, value, subtitle, icon: Icon, color }: {
  title: string; value: string | number; subtitle?: string;
  icon: React.ElementType; color: keyof typeof COLOR_MAP;
}) {
  const c = COLOR_MAP[color];
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3 hover:shadow-sm transition-shadow">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ring-4 ${c.bg} ${c.ring}`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide truncate">{title}</p>
        <p className="text-[20px] font-bold text-gray-800 leading-tight">{value}</p>
        {subtitle && <p className="text-[11px] text-gray-400 truncate">{subtitle}</p>}
      </div>
    </div>
  );
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  new: "Mới", accepted: "Tiếp nhận", preparing: "Chuẩn bị",
  ready_to_ship: "Sẵn sàng", shipping: "Đang giao",
  delivered: "Đã giao", completed: "Hoàn thành", cancelled: "Huỷ",
};
const ORDER_STATUS_COLOR: Record<string, string> = {
  new: "bg-gray-100 text-gray-500", accepted: "bg-blue-100 text-blue-700",
  preparing: "bg-amber-100 text-amber-700", ready_to_ship: "bg-purple-100 text-purple-700",
  shipping: "bg-indigo-100 text-indigo-700", delivered: "bg-green-100 text-green-700",
  completed: "bg-emerald-100 text-emerald-700", cancelled: "bg-red-100 text-red-700",
};

// ── Page ─────────────────────────────────────────────────────────
export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();

  const today      = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  const [
    { data: { user } },
    { data: recentOrdersRaw },
    { data: monthOrders },
    { data: todayOrders },
    { count: totalCustomers },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("orders")
      .select("id, status, total_amount, created_at, customers(name)")
      .order("created_at", { ascending: false }).limit(5),
    supabase.from("orders").select("id, status, total_amount").gte("created_at", monthStart),
    supabase.from("orders").select("id, status, total_amount").gte("created_at", todayStart),
    supabase.from("customers").select("*", { count: "exact", head: true }),
  ]);

  let displayName = "bạn";
  let userRole    = "staff";
  let isManager   = false;
  if (user) {
    const [{ data: profile }, { data: member }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      supabase.from("org_members").select("role").eq("user_id", user.id).eq("is_active", true).limit(1).maybeSingle(),
    ]);
    displayName = profile?.full_name || user.email?.split("@")[0] || "bạn";
    userRole    = member?.role ?? "staff";
    isManager   = ["admin", "manager", "roastery_manager"].includes(userRole);
  }

  const revStatuses = ["delivered", "completed"];
  const mo = monthOrders ?? [];
  const to = todayOrders ?? [];

  const revenueMonth = mo.filter((o: any) => revStatuses.includes(o.status))
    .reduce((s: number, o: any) => s + (Number(o.total_amount) || 0), 0);
  const revenueToday = to.filter((o: any) => revStatuses.includes(o.status))
    .reduce((s: number, o: any) => s + (Number(o.total_amount) || 0), 0);

  // Pipeline counts (month)
  const pipeNew  = mo.filter((o: any) => o.status === "new").length;
  const pipeProg = mo.filter((o: any) => ["accepted","preparing","ready_to_ship"].includes(o.status)).length;
  const pipeShip = mo.filter((o: any) => o.status === "shipping").length;
  const pipeDone = mo.filter((o: any) => revStatuses.includes(o.status)).length;

  const recentOrders = (recentOrdersRaw ?? []).map((o: any) => ({
    ...o,
    order_code:    `#${o.id.slice(0, 8).toUpperCase()}`,
    customer_name: o.customers?.name || "—",
  }));

  const todayStr = formatWeekdayDateVN(today);

  return (
    <div className="space-y-4 pb-6">

      {/* Header — hero card on mobile */}
      <div className="md:bg-transparent bg-gradient-to-br from-blue-600 to-indigo-700 md:p-0 -mx-4 px-4 pt-2 pb-5 md:m-0 md:pb-0 text-white md:text-gray-800">
        <p className="text-[11px] md:hidden opacity-80">{todayStr}</p>
        <h1 className="text-[20px] md:text-[18px] font-bold mt-0.5 md:mt-0 md:text-gray-800">
          Xin chào, {displayName} <span className="md:hidden">👋</span>
        </h1>
        <p className="hidden md:block text-[12px] text-gray-400">{todayStr}</p>
        {/* Mobile inline KPI strip */}
        <div className="md:hidden flex items-center gap-3 mt-3 text-[12px]">
          <div>
            <p className="opacity-75 text-[10px]">Hôm nay</p>
            <p className="font-bold text-[15px]">{money(revenueToday)}</p>
          </div>
          <div className="w-px h-7 bg-white/30" />
          <div>
            <p className="opacity-75 text-[10px]">Tháng này</p>
            <p className="font-bold text-[15px]">{money(revenueMonth)}</p>
          </div>
        </div>
      </div>

      {/* KPI row — 4 cards (hidden on mobile, shown sm+) */}
      <div className="hidden sm:grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard title="Doanh thu hôm nay"  value={money(revenueToday)}  subtitle={`${to.length} đơn hôm nay`}      icon={Banknote}    color="green" />
        <StatCard title="Doanh thu tháng"    value={money(revenueMonth)}  subtitle={`${mo.length} đơn tháng này`}     icon={TrendingUp}  color="blue" />
        <StatCard title="Khách hàng"         value={totalCustomers ?? 0}  subtitle="Tổng trong hệ thống"              icon={Users}       color="purple" />
        <StatCard title="Pipeline tháng"
          value={`${pipeNew + pipeProg + pipeShip}`}
          subtitle={`${pipeDone} đã giao · ${pipeShip} đang giao`}
          icon={ShoppingCart} color="amber" />
      </div>

      {/* Mobile-only: secondary KPIs as compact pills */}
      <div className="sm:hidden grid grid-cols-2 gap-2">
        <div className="bg-white rounded-2xl border border-gray-200 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center">
              <Users className="h-4 w-4 text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Khách hàng</p>
              <p className="text-[15px] font-bold text-gray-800 leading-tight">{totalCustomers ?? 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center">
              <ShoppingCart className="h-4 w-4 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Pipeline</p>
              <p className="text-[15px] font-bold text-gray-800 leading-tight">{pipeNew + pipeProg + pipeShip}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-col: orders + CRM snapshot (admin) or stock alert (staff) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Recent orders — 2/3 width */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-[14px] font-bold text-gray-800">Đơn hàng gần đây</h2>
              <div className="flex gap-3 mt-1 text-[11px]">
                <span className="text-sky-700 font-medium">{pipeNew} mới</span>
                <span className="text-amber-700 font-medium">{pipeProg} đang xử lý</span>
                <span className="text-indigo-700 font-medium">{pipeShip} đang giao</span>
                <span className="text-emerald-700 font-medium">{pipeDone} xong</span>
              </div>
            </div>
            <a href="/orders" className="text-[12px] text-blue-500 hover:underline font-medium shrink-0">Xem tất cả →</a>
          </div>
          <div className="divide-y divide-gray-100">
            {recentOrders.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center gap-2">
                <AlertCircle className="h-7 w-7 text-gray-300" />
                <p className="text-sm text-gray-400">Chưa có đơn hàng nào</p>
                <a href="/orders" className="text-sm text-blue-500 hover:underline">Tạo đơn hàng đầu tiên →</a>
              </div>
            ) : (
              recentOrders.map((order: any) => (
                <a key={order.id} href="/orders"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-gray-800 font-mono">{order.order_code}</p>
                    <p className="text-[11px] text-gray-400 truncate">{order.customer_name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-bold text-gray-800">
                      {order.total_amount ? VN_FMT.format(order.total_amount) + "đ" : "—"}
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

        {/* Right col: CRM snapshot (admin) or quick nav (staff) */}
        <div className="space-y-3">
          {isManager ? (
            /* Admin sees CRM lead-by-sale snapshot */
            <CrmSnapshotCard />
          ) : (
            /* Staff sees quick actions */
            <>
              <h2 className="text-[14px] font-bold text-gray-800">Thao tác nhanh</h2>
              {[
                { href: "/orders",    label: "Tạo đơn hàng",  icon: ShoppingCart, color: "bg-blue-500" },
                { href: "/customers", label: "Thêm khách hàng", icon: Users,       color: "bg-purple-500" },
                { href: "/batches",   label: "Tạo batch rang",  icon: Factory,     color: "bg-amber-500" },
                { href: "/products",  label: "Thêm sản phẩm",  icon: Package,     color: "bg-green-500" },
              ].map(({ href, label, icon: Icon, color }) => (
                <a key={href} href={href}
                  className="flex items-center gap-3 p-3 bg-white rounded-xl border hover:shadow-sm hover:border-blue-200 transition-all group">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <p className="text-[13px] font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">{label}</p>
                </a>
              ))}
            </>
          )}

          {/* Stock alert — always visible but compact */}
          <StockAlertsCard />
        </div>
      </div>

      {/* Task board — full width, below */}
      {user && <TaskBoard userId={user.id} userRole={userRole} />}

    </div>
  );
}
