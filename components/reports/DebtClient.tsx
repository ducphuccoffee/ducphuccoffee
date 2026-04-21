"use client";

import { useEffect, useState, useMemo } from "react";
import { AlertTriangle, DollarSign, Phone } from "lucide-react";
import { formatDateVN } from "@/lib/date";
import Link from "next/link";

type DebtRow = {
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  total_ordered: number;
  total_paid: number;
  debt_amount: number;
  order_count: number;
  last_order_at: string | null;
  is_overdue: boolean;
  is_high_debt: boolean;
  days_since_last_order: number;
};

const money = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n));

export function DebtClient() {
  const [rows, setRows] = useState<DebtRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    setLoading(true);
    fetch("/api/customer-debt")
      .then(r => r.json())
      .then(res => setRows(res.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (filter === "overdue") return rows.filter(r => r.is_overdue);
    if (filter === "high") return rows.filter(r => r.is_high_debt);
    return rows;
  }, [rows, filter]);

  const totalDebt = rows.reduce((s, r) => s + r.debt_amount, 0);
  const overdueCount = rows.filter(r => r.is_overdue).length;
  const highCount = rows.filter(r => r.is_high_debt).length;

  return (
    <div>
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-xl border bg-red-50 p-3 text-center">
          <div className="text-[10px] text-red-600 uppercase">Tổng nợ</div>
          <div className="text-lg font-bold text-red-700">{money(totalDebt)}đ</div>
        </div>
        <div className="rounded-xl border bg-amber-50 p-3 text-center">
          <div className="text-[10px] text-amber-600 uppercase">Quá hạn</div>
          <div className="text-lg font-bold text-amber-700">{overdueCount}</div>
        </div>
        <div className="rounded-xl border bg-orange-50 p-3 text-center">
          <div className="text-[10px] text-orange-600 uppercase">Nợ cao</div>
          <div className="text-lg font-bold text-orange-700">{highCount}</div>
        </div>
      </div>

      <div className="flex gap-1.5 mb-3">
        {[{ key: "all", label: "Tất cả" }, { key: "overdue", label: "Quá hạn" }, { key: "high", label: "Nợ cao" }].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium ${filter === f.key ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-sm text-gray-400 py-8">Không có công nợ</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <Link key={r.customer_id} href={`/crm/customers/${r.customer_id}`} className="block rounded-xl border bg-white p-3 hover:bg-gray-50">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {(r.is_overdue || r.is_high_debt) && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                    <span className="text-sm font-bold text-gray-800 truncate">{r.customer_name}</span>
                  </div>
                  {r.customer_phone && <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400"><Phone className="h-3 w-3" />{r.customer_phone}</div>}
                  <div className="flex gap-3 mt-1 text-[10px] text-gray-400">
                    <span>{r.order_count} đơn</span>
                    <span>Đã trả: {money(r.total_paid)}đ</span>
                    {r.last_order_at && <span>Gần nhất: {formatDateVN(r.last_order_at)}</span>}
                  </div>
                  {r.is_overdue && <div className="text-[10px] text-red-500 mt-0.5">Quá hạn {r.days_since_last_order} ngày</div>}
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-sm font-bold ${r.is_high_debt ? "text-red-600" : "text-amber-600"}`}>{money(r.debt_amount)}đ</div>
                  <div className="text-[10px] text-gray-400">/ {money(r.total_ordered)}đ</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
