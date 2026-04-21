"use client";

import { useEffect, useState, useMemo } from "react";
import { AlertTriangle, DollarSign, Phone, Clock } from "lucide-react";
import { formatDateVN, formatCurrencyVN } from "@/lib/date";
import Link from "next/link";

const money = (n: number) => formatCurrencyVN(Math.round(n));

export function DebtClient() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    setLoading(true);
    fetch("/api/reports?type=debt")
      .then(r => r.json())
      .then(res => { if (res.ok) setData(res.data); })
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    if (filter === "overdue") return data.rows.filter((r: any) => r.is_overdue);
    if (filter === "high") return data.rows.filter((r: any) => r.is_high_debt);
    return data.rows;
  }, [data, filter]);

  return (
    <div>
      {loading ? <Loading /> : !data ? <Empty /> : (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <KPI label="Tổng nợ" value={`${money(data.kpi.total_debt)}đ`} color="text-red-700" bg="bg-red-50" />
            <KPI label="Khách nợ" value={data.kpi.total_customers} color="text-gray-800" bg="bg-gray-50" />
            <KPI label="Quá hạn" value={data.kpi.overdue_count} color="text-amber-700" bg="bg-amber-50" />
            <KPI label="Nợ cao" value={data.kpi.high_debt_count} color="text-orange-700" bg="bg-orange-50" />
          </div>

          {/* Aging buckets */}
          <div className="rounded-xl border bg-white overflow-hidden">
            <div className="px-3 py-2 border-b bg-gray-50"><span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Phân tích tuổi nợ</span></div>
            <div className="grid grid-cols-4 divide-x divide-gray-100">
              {(["0-7", "8-30", "31-60", ">60"] as const).map(b => (
                <div key={b} className="p-3 text-center">
                  <div className="text-[10px] text-gray-400 uppercase">{b} ngày</div>
                  <div className={`text-sm font-bold ${b === ">60" ? "text-red-600" : b === "31-60" ? "text-orange-600" : "text-gray-800"}`}>
                    {money(data.buckets[b] ?? 0)}đ
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Filter + list */}
          <div className="flex gap-1.5 mb-1">
            {[{ key: "all", label: "Tất cả" }, { key: "overdue", label: "Quá hạn" }, { key: "high", label: "Nợ cao" }].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium ${filter === f.key ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {f.label}
              </button>
            ))}
          </div>

          {rows.length === 0 ? <Empty /> : (
            <div className="space-y-2">
              {rows.map((r: any) => (
                <Link key={r.customer_id} href={`/crm/customers/${r.customer_id}`} className="block rounded-xl border bg-white p-3 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {(r.is_overdue || r.is_high_debt) && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                        <span className="text-sm font-bold text-gray-800 truncate">{r.customer_name}</span>
                        <span className={`text-[10px] px-1 py-0.5 rounded ${r.bucket === ">60" ? "bg-red-100 text-red-700" : r.bucket === "31-60" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"}`}>{r.bucket}d</span>
                      </div>
                      {r.customer_phone && <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400"><Phone className="h-3 w-3" />{r.customer_phone}</div>}
                      <div className="flex gap-3 mt-1 text-[10px] text-gray-400">
                        <span>{r.order_count} đơn</span>
                        <span>Mua: {money(r.total_ordered)}đ</span>
                        <span>Trả: {money(r.total_paid)}đ</span>
                      </div>
                      {r.last_order_at && <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1"><Clock className="h-3 w-3" />Gần nhất: {formatDateVN(r.last_order_at)}</div>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-sm font-bold ${r.is_high_debt ? "text-red-600" : "text-amber-600"}`}>{money(r.debt_amount)}đ</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, color, bg }: { label: string; value: any; color: string; bg: string }) {
  return (
    <div className={`rounded-xl border p-3 text-center ${bg}`}>
      <div className="text-[10px] text-gray-500 uppercase">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}

function Loading() { return <div className="space-y-2 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}</div>; }
function Empty() { return <div className="text-center text-sm text-gray-400 py-6">Không có công nợ</div>; }
