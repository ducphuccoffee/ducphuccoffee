"use client";

import { useEffect, useState } from "react";

type Row = { user_id: string; full_name: string | null; role: string; monthly_revenue: number };

const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(n);

export function UserTargets() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ user_id: string; ok: boolean; text: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/user-targets");
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error ?? "Lỗi");
      setRows(j.data ?? []);
      const d: Record<string, number> = {};
      for (const row of j.data ?? []) d[row.user_id] = row.monthly_revenue;
      setDrafts(d);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function save(userId: string) {
    setSavingId(userId);
    setMsg(null);
    try {
      const r = await fetch("/api/user-targets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, monthly_revenue: drafts[userId] ?? 0 }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error ?? "Lỗi");
      setMsg({ user_id: userId, ok: true, text: "Đã lưu" });
      setRows(prev => prev.map(r => r.user_id === userId ? { ...r, monthly_revenue: drafts[userId] ?? 0 } : r));
    } catch (e: any) {
      setMsg({ user_id: userId, ok: false, text: e.message ?? "Lỗi" });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="bg-white rounded-xl border">
      <div className="px-4 py-3 border-b">
        <h3 className="text-sm font-semibold text-gray-800">Target doanh thu/tháng theo từng sales</h3>
        <p className="text-[11px] text-gray-500">Dùng để tính % hoàn thành cá nhân</p>
      </div>
      {loading ? (
        <div className="p-8 text-center text-sm text-gray-400">Đang tải…</div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-400">Không có thành viên</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {rows.map(row => (
            <div key={row.user_id} className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">
                  {row.full_name || row.user_id.slice(0, 8)}
                </div>
                <div className="text-[11px] text-gray-500">{row.role}</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={100000}
                  value={drafts[row.user_id] ?? 0}
                  onChange={e => setDrafts({ ...drafts, [row.user_id]: Number(e.target.value) || 0 })}
                  className="w-40 border rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  disabled={savingId === row.user_id || (drafts[row.user_id] ?? 0) === row.monthly_revenue}
                  onClick={() => save(row.user_id)}
                  className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-40"
                >
                  Lưu
                </button>
              </div>
              {msg?.user_id === row.user_id && (
                <span className={`text-[11px] ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</span>
              )}
              {msg?.user_id !== row.user_id && row.monthly_revenue > 0 && (
                <span className="text-[11px] text-gray-400">Hiện tại: {fmt(row.monthly_revenue)} ₫</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
