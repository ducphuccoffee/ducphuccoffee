"use client";

import { useEffect, useState } from "react";
import { Package, Coffee, AlertTriangle, ArrowDownUp } from "lucide-react";
import { formatDateTimeVN, formatCurrencyVN } from "@/lib/date";

const fmt = (n: number) => Number(n).toFixed(1);

export function StockClient() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/reports?type=stock")
      .then(r => r.json())
      .then(res => { if (res.ok) setData(res.data); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {loading ? <Loading /> : !data ? <Empty msg="Không tải được dữ liệu" /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <KPI icon={<Coffee className="h-4 w-4" />} label="Nhân xanh" value={`${fmt(data.kpi.total_green_kg)} kg`} bg="bg-green-50" color="text-green-700" />
            <KPI icon={<Package className="h-4 w-4" />} label="Rang nền" value={`${fmt(data.kpi.total_roasted_kg)} kg`} bg="bg-amber-50" color="text-amber-700" />
            <KPI icon={<AlertTriangle className="h-4 w-4" />} label="Sắp hết" value={data.kpi.low_stock_count} bg="bg-red-50" color="text-red-700" />
          </div>

          {/* Low stock alert */}
          {data.low_stock.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <div className="flex items-center gap-2 mb-1"><AlertTriangle className="h-4 w-4 text-red-600" /><span className="text-xs font-bold text-red-800">Sắp hết hàng ({"<"}5kg)</span></div>
              <div className="divide-y divide-red-100">
                {data.low_stock.map((p: any, i: number) => (
                  <div key={i} className="flex justify-between py-1 text-sm">
                    <span className="text-gray-700">{p.name}</span>
                    <span className="font-bold text-red-600">{fmt(p.total_kg)} kg</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Green stock */}
          <Section title="Tồn kho nhân xanh">
            {data.green.length === 0 ? <Empty msg="Không có dữ liệu" /> : (
              <table className="w-full text-sm">
                <thead><tr className="text-[10px] text-gray-400 uppercase"><th className="text-left py-1">Loại</th><th className="text-right py-1">Lô</th><th className="text-right py-1">Tồn (kg)</th></tr></thead>
                <tbody>{data.green.map((g: any, i: number) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="py-1.5 text-gray-700">{g.name}</td>
                    <td className="py-1.5 text-right text-gray-600">{g.lots}</td>
                    <td className="py-1.5 text-right font-medium text-gray-800">{fmt(g.total_kg)}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </Section>

          {/* Roasted stock */}
          <Section title="Tồn kho rang nền (theo SP)">
            {data.roasted.length === 0 ? <Empty msg="Không có dữ liệu" /> : (
              <table className="w-full text-sm">
                <thead><tr className="text-[10px] text-gray-400 uppercase"><th className="text-left py-1">Sản phẩm</th><th className="text-right py-1">Lô</th><th className="text-right py-1">Tồn (kg)</th></tr></thead>
                <tbody>{data.roasted.map((r: any, i: number) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="py-1.5 text-gray-700">{r.name}</td>
                    <td className="py-1.5 text-right text-gray-600">{r.lots}</td>
                    <td className={`py-1.5 text-right font-medium ${r.total_kg < 5 ? "text-red-600" : "text-gray-800"}`}>{fmt(r.total_kg)}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </Section>

          {/* Recent movements */}
          <Section title="Biến động gần đây">
            {data.recent_movements.length === 0 ? <Empty msg="Không có" /> : (
              <div className="divide-y divide-gray-100">
                {data.recent_movements.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between py-1.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <ArrowDownUp className="h-3 w-3 text-gray-400 shrink-0" />
                        <span className="text-xs text-gray-700 truncate">{m.item_name ?? m.item_id}</span>
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1 py-0.5 rounded">{m.direction}</span>
                      </div>
                      <div className="text-[10px] text-gray-400 ml-5">{formatDateTimeVN(m.occurred_at)}</div>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${m.direction === "in" ? "text-green-600" : "text-red-600"}`}>
                      {m.direction === "in" ? "+" : "-"}{fmt(Number(m.qty_kg ?? 0))} kg
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

function KPI({ icon, label, value, bg, color }: { icon: React.ReactNode; label: string; value: any; bg: string; color: string }) {
  return (
    <div className={`rounded-xl border p-3 text-center ${bg}`}>
      <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">{icon}<span className="text-[10px] uppercase">{label}</span></div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
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
function Empty({ msg }: { msg: string }) { return <div className="text-center text-sm text-gray-400 py-6">{msg}</div>; }
