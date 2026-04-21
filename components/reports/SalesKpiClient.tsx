"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Users, DollarSign, Award } from "lucide-react";

type SalesRow = {
  user_id: string;
  user_name: string;
  total_orders: number;
  total_revenue: number;
  total_commission: number;
  total_leads: number;
  converted_leads: number;
  conversion_rate: number;
};

const money = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n));

export function SalesKpiClient() {
  const [rows, setRows] = useState<SalesRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/sales-kpi")
      .then(r => r.json())
      .then(res => setRows(res.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const totalRevenue = rows.reduce((s, r) => s + r.total_revenue, 0);
  const totalCommission = rows.reduce((s, r) => s + r.total_commission, 0);
  const totalOrders = rows.reduce((s, r) => s + r.total_orders, 0);

  return (
    <div>
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-xl border bg-blue-50 p-3 text-center">
          <div className="text-[10px] text-blue-600 uppercase">Tổng DT</div>
          <div className="text-lg font-bold text-blue-700">{money(totalRevenue)}đ</div>
        </div>
        <div className="rounded-xl border bg-green-50 p-3 text-center">
          <div className="text-[10px] text-green-600 uppercase">Tổng HH</div>
          <div className="text-lg font-bold text-green-700">{money(totalCommission)}đ</div>
        </div>
        <div className="rounded-xl border bg-purple-50 p-3 text-center">
          <div className="text-[10px] text-purple-600 uppercase">Tổng đơn</div>
          <div className="text-lg font-bold text-purple-700">{totalOrders}</div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}</div>
      ) : rows.length === 0 ? (
        <div className="text-center text-sm text-gray-400 py-8">Chưa có dữ liệu KPI</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={r.user_id} className="rounded-xl border bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {i === 0 && <Award className="h-4 w-4 text-amber-500" />}
                    <span className="text-sm font-bold text-gray-800">{r.user_name}</span>
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">#{i + 1}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div>
                      <div className="text-[10px] text-gray-400">Doanh thu</div>
                      <div className="text-sm font-bold text-gray-700">{money(r.total_revenue)}đ</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400">Hoa hồng</div>
                      <div className="text-sm font-bold text-green-600">{money(r.total_commission)}đ</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400">Đơn hàng</div>
                      <div className="text-sm font-bold text-gray-700">{r.total_orders}</div>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-1.5 text-[10px] text-gray-400">
                    <span><Users className="h-3 w-3 inline mr-0.5" />{r.total_leads} leads</span>
                    <span><TrendingUp className="h-3 w-3 inline mr-0.5" />CVR: {r.conversion_rate}%</span>
                    <span>{r.converted_leads} converted</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
