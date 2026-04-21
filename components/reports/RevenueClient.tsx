"use client";

import { useState, useEffect } from "react";
import { DollarSign, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { formatDateVN, formatCurrencyVN } from "@/lib/date";
import { DateRangeFilter, DateRange } from "./DateRangeFilter";

const money = (n: number) => formatCurrencyVN(Math.round(n));

function daysAgo(n: number) { return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10); }

export function RevenueClient() {
  const [range, setRange] = useState<DateRange>({ from: daysAgo(30), to: new Date().toISOString().slice(0, 10) + "T23:59:59" });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports?type=revenue&from=${range.from}&to=${range.to}`)
      .then(r => r.json())
      .then(res => { if (res.ok) setData(res.data); })
      .finally(() => setLoading(false));
  }, [range]);

  return (
    <div>
      <DateRangeFilter value={range} onChange={setRange} />

      {loading ? <Loading /> : !data ? <Empty /> : (
        <div className="space-y-4">
          {/* KPI */}
          <div className="grid grid-cols-3 gap-2">
            <KPI icon={<DollarSign className="h-4 w-4" />} label="Doanh thu" value={`${money(data.kpi.total_revenue)}đ`} />
            <KPI icon={<ShoppingCart className="h-4 w-4" />} label="Đơn hàng" value={data.kpi.total_orders} />
            <KPI icon={<TrendingUp className="h-4 w-4" />} label="TB/đơn" value={`${money(data.kpi.avg_order)}đ`} />
          </div>

          {/* By day */}
          <Section title="Theo ngày">
            {data.by_day.length === 0 ? <Empty /> : (
              <table className="w-full text-sm">
                <thead><tr className="text-[10px] text-gray-400 uppercase"><th className="text-left py-1">Ngày</th><th className="text-right py-1">Đơn</th><th className="text-right py-1">Doanh thu</th></tr></thead>
                <tbody>{data.by_day.map((d: any) => (
                  <tr key={d.day} className="border-t border-gray-100">
                    <td className="py-1.5 text-gray-700">{formatDateVN(d.day)}</td>
                    <td className="py-1.5 text-right text-gray-600">{d.count}</td>
                    <td className="py-1.5 text-right font-medium text-gray-800">{money(d.revenue)}đ</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </Section>

          {/* By sale */}
          <Section title="Theo nhân viên">
            {data.by_sale.length === 0 ? <Empty /> : (
              <table className="w-full text-sm">
                <thead><tr className="text-[10px] text-gray-400 uppercase"><th className="text-left py-1">NV</th><th className="text-right py-1">Đơn</th><th className="text-right py-1">Doanh thu</th></tr></thead>
                <tbody>{data.by_sale.map((s: any) => (
                  <tr key={s.user_id} className="border-t border-gray-100">
                    <td className="py-1.5 text-gray-700">{s.name}</td>
                    <td className="py-1.5 text-right text-gray-600">{s.count}</td>
                    <td className="py-1.5 text-right font-medium text-gray-800">{money(s.revenue)}đ</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </Section>

          {/* By customer */}
          <Section title="Theo khách hàng (top 20)">
            {data.by_customer.length === 0 ? <Empty /> : (
              <table className="w-full text-sm">
                <thead><tr className="text-[10px] text-gray-400 uppercase"><th className="text-left py-1">KH</th><th className="text-right py-1">Đơn</th><th className="text-right py-1">Doanh thu</th></tr></thead>
                <tbody>{data.by_customer.map((c: any, i: number) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="py-1.5 text-gray-700 truncate max-w-[120px]">{c.name}</td>
                    <td className="py-1.5 text-right text-gray-600">{c.count}</td>
                    <td className="py-1.5 text-right font-medium text-gray-800">{money(c.revenue)}đ</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </Section>

          {/* By product */}
          <Section title="Theo sản phẩm (top 20)">
            {data.by_product.length === 0 ? <Empty /> : (
              <table className="w-full text-sm">
                <thead><tr className="text-[10px] text-gray-400 uppercase"><th className="text-left py-1">SP</th><th className="text-right py-1">Kg</th><th className="text-right py-1">Doanh thu</th></tr></thead>
                <tbody>{data.by_product.map((p: any, i: number) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="py-1.5 text-gray-700 truncate max-w-[120px]">{p.name}</td>
                    <td className="py-1.5 text-right text-gray-600">{p.qty_kg?.toFixed(1)}</td>
                    <td className="py-1.5 text-right font-medium text-gray-800">{money(p.revenue)}đ</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

function KPI({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return (
    <div className="rounded-xl border bg-white p-3 text-center">
      <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">{icon}<span className="text-[10px] uppercase">{label}</span></div>
      <div className="text-lg font-bold text-gray-800">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="px-3 py-2 border-b bg-gray-50"><span className="text-xs font-bold text-gray-600 uppercase tracking-wider">{title}</span></div>
      <div className="px-3 py-2">{children}</div>
    </div>
  );
}

function Loading() { return <div className="space-y-2 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}</div>; }
function Empty() { return <div className="text-center text-sm text-gray-400 py-6">Không có dữ liệu</div>; }
