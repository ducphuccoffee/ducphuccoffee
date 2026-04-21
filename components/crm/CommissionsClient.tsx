"use client";

import { useEffect, useState, useMemo } from "react";
import { DollarSign, Check, Filter } from "lucide-react";
import { formatDateVN } from "@/lib/date";

type Commission = {
  id: string;
  order_id: string;
  beneficiary_user_id: string;
  amount: number;
  qty_kg: number;
  rate_per_kg: number;
  commission_type: string | null;
  status: string;
  created_at: string;
  orders?: { order_code: string; customer_id: string; total_amount: number } | null;
};

const TYPE_LABEL: Record<string, string> = { coffee: "Cà phê", machine_sale: "Máy", rental: "Thuê máy" };
const money = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n));

export function CommissionsClient() {
  const [items, setItems] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  function load() {
    setLoading(true);
    fetch("/api/commissions")
      .then(r => r.json())
      .then(res => {
        const data = res.data ?? [];
        setItems(data);
        const userIds = [...new Set(data.map((c: Commission) => c.beneficiary_user_id).filter(Boolean))];
        if (userIds.length > 0) {
          fetch(`/api/admin/users`).then(r => r.json()).then(u => {
            const map: Record<string, string> = {};
            for (const p of u.data ?? []) map[p.id] = p.full_name || p.email || p.id;
            setProfiles(map);
          });
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (filterStatus === "all") return items;
    return items.filter(c => c.status === filterStatus);
  }, [items, filterStatus]);

  const totalPending = items.filter(c => c.status === "pending").reduce((s, c) => s + Number(c.amount), 0);
  const totalPaid = items.filter(c => c.status === "paid").reduce((s, c) => s + Number(c.amount), 0);

  async function markPaid(id: string) {
    await fetch(`/api/commissions?id=${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid" }),
    });
    load();
  }

  return (
    <div>
      {/* Summary */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="rounded-xl border bg-amber-50 p-3 text-center">
          <div className="text-[10px] text-amber-600 uppercase">Chờ chi</div>
          <div className="text-lg font-bold text-amber-700">{money(totalPending)}đ</div>
        </div>
        <div className="rounded-xl border bg-green-50 p-3 text-center">
          <div className="text-[10px] text-green-600 uppercase">Đã chi</div>
          <div className="text-lg font-bold text-green-700">{money(totalPaid)}đ</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-1.5 mb-3">
        {[{ key: "all", label: "Tất cả" }, { key: "pending", label: "Chờ chi" }, { key: "paid", label: "Đã chi" }].map(f => (
          <button key={f.key} onClick={() => setFilterStatus(f.key)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium ${filterStatus === f.key ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-sm text-gray-400 py-8">Chưa có hoa hồng nào</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id} className="rounded-xl border bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-sm font-bold text-gray-800">{money(Number(c.amount))}đ</span>
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1 py-0.5 rounded">{TYPE_LABEL[c.commission_type ?? ""] ?? c.commission_type}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{profiles[c.beneficiary_user_id] ?? c.beneficiary_user_id.slice(0, 8)}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{formatDateVN(c.created_at)}{c.qty_kg > 0 ? ` · ${c.qty_kg}kg` : ""}</div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  {c.status === "pending" ? (
                    <button onClick={() => markPaid(c.id)}
                      className="flex items-center gap-1 text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 font-medium">
                      <Check className="h-3 w-3" /> Đã chi
                    </button>
                  ) : (
                    <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Đã chi</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
