"use client";

import { useState, useEffect } from "react";
import { DollarSign, Users, TrendingUp, Target, Award } from "lucide-react";
import { formatCurrencyVN } from "@/lib/date";
import { DateRangeFilter, DateRange } from "./DateRangeFilter";

const money = (n: number) => formatCurrencyVN(Math.round(n));
function daysAgo(n: number) { return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10); }

export function SalesKpiClient() {
  const [range, setRange] = useState<DateRange>({ from: daysAgo(30), to: new Date().toISOString().slice(0, 10) + "T23:59:59" });
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports?type=sales&from=${range.from}&to=${range.to}`)
      .then(r => r.json())
      .then(res => { if (res.ok) setRows(res.data?.rows ?? []); })
      .finally(() => setLoading(false));
  }, [range]);

  const totals = rows.reduce((acc, r) => ({
    revenue: acc.revenue + r.revenue,
    orders: acc.orders + r.orders,
    comm: acc.comm + r.comm_total,
    leads: acc.leads + r.leads,
  }), { revenue: 0, orders: 0, comm: 0, leads: 0 });

  return (
    <div>
      <DateRangeFilter value={range} onChange={setRange} />

      {loading ? <Loading /> : rows.length === 0 ? <Empty /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <KPI icon={<DollarSign className="h-4 w-4" />} label="Tổng DT" value={`${money(totals.revenue)}đ`} />
            <KPI icon={<Award className="h-4 w-4" />} label="Tổng HH" value={`${money(totals.comm)}đ`} />
            <KPI icon={<Target className="h-4 w-4" />} label="Tổng đơn" value={totals.orders} />
            <KPI icon={<Users className="h-4 w-4" />} label="Tổng lead" value={totals.leads} />
          </div>

          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={r.user_id} className="rounded-xl border bg-white p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  {i === 0 && <Award className="h-4 w-4 text-amber-500" />}
                  <span className="text-sm font-bold text-gray-800">{r.name}</span>
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">#{i + 1}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <Stat label="Doanh thu" value={`${money(r.revenue)}đ`} />
                  <Stat label="Đơn hàng" value={r.orders} />
                  <Stat label="HH tổng" value={`${money(r.comm_total)}đ`} />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <Stat label="HH chờ" value={`${money(r.comm_pending)}đ`} small />
                  <Stat label="HH đã chi" value={`${money(r.comm_paid)}đ`} small />
                  <Stat label="Lead" value={`${r.leads} (${r.converted} cvt)`} small />
                  <Stat label="CVR" value={`${r.conversion_rate}%`} small />
                </div>
                <div className="flex gap-3 mt-2 text-[10px] text-gray-400">
                  <span>{r.opps} cơ hội · {money(r.opp_value)}đ pipeline</span>
                </div>
              </div>
            ))}
          </div>
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

function Stat({ label, value, small }: { label: string; value: any; small?: boolean }) {
  return (
    <div>
      <div className={`text-gray-400 ${small ? "text-[9px]" : "text-[10px]"}`}>{label}</div>
      <div className={`font-bold text-gray-700 ${small ? "text-xs" : "text-sm"}`}>{value}</div>
    </div>
  );
}

function Loading() { return <div className="space-y-2 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}</div>; }
function Empty() { return <div className="text-center text-sm text-gray-400 py-6">Chưa có dữ liệu KPI</div>; }
