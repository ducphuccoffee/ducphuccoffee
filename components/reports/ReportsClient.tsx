"use client";

const money = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(n) || 0);

type Props = {
  revenueByMonth: Record<string, number>;
  orderCountByMonth: Record<string, number>;
  topProducts: { name: string; revenue: number; qty: number }[];
  topCustomers: { name: string; total: number }[];
  totalRevenue: number;
  totalOrders: number;
};

export function ReportsClient({
  revenueByMonth,
  orderCountByMonth,
  topProducts,
  topCustomers,
  totalRevenue,
  totalOrders,
}: Props) {
  const months = Object.keys(revenueByMonth);
  const maxRev = Math.max(...Object.values(revenueByMonth), 1);
  const maxProd = Math.max(...topProducts.map((p) => p.revenue), 1);

  return (
    <div className="p-6 space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-4">
          <p className="text-xs text-gray-400">Doanh thu 6 tháng</p>
          <p className="text-xl font-bold text-blue-700 mt-1">{money(totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-4">
          <p className="text-xs text-gray-400">Tổng đơn hàng</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{totalOrders}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-4">
          <p className="text-xs text-gray-400">TB / đơn</p>
          <p className="text-xl font-bold text-gray-800 mt-1">
            {totalOrders > 0 ? money(totalRevenue / totalOrders) : "—"}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-4">
          <p className="text-xs text-gray-400">Tháng tốt nhất</p>
          <p className="text-sm font-bold text-green-700 mt-1">
            {months.reduce((best, m) =>
              (revenueByMonth[m] || 0) > (revenueByMonth[best] || 0) ? m : best
            , months[0] || "—")}
          </p>
          <p className="text-xs text-gray-500">
            {money(Math.max(...Object.values(revenueByMonth)))}
          </p>
        </div>
      </div>

      {/* Revenue bar chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Doanh thu theo tháng</h2>
        <div className="flex items-end gap-3 h-40">
          {months.map((m) => {
            const val = revenueByMonth[m] || 0;
            const heightPct = val > 0 ? Math.max((val / maxRev) * 100, 4) : 0;
            return (
              <div key={m} className="flex-1 flex flex-col items-center gap-1">
                <p className="text-[10px] text-gray-500 font-medium">{val > 0 ? money(val).replace("₫","").trim() : ""}</p>
                <div className="w-full bg-gray-100 rounded-t-md relative" style={{ height: "100px" }}>
                  <div
                    className="absolute bottom-0 w-full bg-blue-500 rounded-t-md transition-all"
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-500">{m}</p>
                <p className="text-[10px] text-gray-400">{orderCountByMonth[m] || 0} đơn</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Top products */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Top sản phẩm bán chạy</h2>
          {topProducts.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Chưa có dữ liệu</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={p.name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1.5 font-medium text-gray-700 truncate max-w-[60%]">
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0 ${
                        i === 0 ? "bg-yellow-400" : i === 1 ? "bg-gray-400" : i === 2 ? "bg-amber-600" : "bg-gray-300"
                      }`}>{i + 1}</span>
                      {p.name}
                    </span>
                    <span className="text-gray-500 shrink-0">{money(p.revenue)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${(p.revenue / maxProd) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top customers */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Khách hàng mua nhiều nhất</h2>
          {topCustomers.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Chưa có dữ liệu</p>
          ) : (
            <div className="space-y-3">
              {topCustomers.map((c, i) => (
                <div key={c.name} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 ${
                    i === 0 ? "bg-blue-500" : i === 1 ? "bg-purple-500" : "bg-gray-400"
                  }`}>
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{c.name}</p>
                    <p className="text-[11px] text-gray-400">{money(c.total)}</p>
                  </div>
                  <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    #{i + 1}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
