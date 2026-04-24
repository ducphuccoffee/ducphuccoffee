"use client";

import { useEffect, useState } from "react";

type Rule = {
  id: string;
  commission_type: string;
  fixed_amount: number;
  collaborator_rate_per_kg: number;
  is_active: boolean;
};

const TYPE_LABEL: Record<string, string> = {
  machine_sale: "Bán máy",
  rental: "Cho thuê",
  coffee: "Cà phê",
};

const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(n);

export function CommissionRules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, Partial<Rule>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);

  // new rule form
  const [newType, setNewType] = useState("");
  const [newFixed, setNewFixed] = useState(0);
  const [newRate, setNewRate] = useState(0);
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/commission-rules");
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error ?? "Lỗi");
      setRules(j.data ?? []);
      setDrafts({});
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function draft(id: string): Partial<Rule> {
    return drafts[id] ?? {};
  }
  function setDraft(id: string, patch: Partial<Rule>) {
    setDrafts(d => ({ ...d, [id]: { ...d[id], ...patch } }));
  }

  async function save(rule: Rule) {
    const d = drafts[rule.id];
    if (!d) return;
    setSavingId(rule.id);
    setMsg(null);
    try {
      const r = await fetch("/api/commission-rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id, ...d }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error ?? "Lỗi");
      setMsg({ id: rule.id, ok: true, text: "Đã lưu" });
      await load();
    } catch (e: any) {
      setMsg({ id: rule.id, ok: false, text: e.message ?? "Lỗi" });
    } finally {
      setSavingId(null);
    }
  }

  async function addRule(e: React.FormEvent) {
    e.preventDefault();
    if (!newType.trim()) return;
    setAdding(true);
    try {
      const r = await fetch("/api/commission-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commission_type: newType.trim(), fixed_amount: newFixed, collaborator_rate_per_kg: newRate }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error ?? "Lỗi");
      setNewType(""); setNewFixed(0); setNewRate(0);
      await load();
    } catch (e: any) {
      alert(e.message ?? "Lỗi");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border">
      <div className="px-4 py-3 border-b">
        <h3 className="text-sm font-semibold text-gray-800">Công thức hoa hồng</h3>
        <p className="text-[11px] text-gray-500">
          <b>fixed_amount</b>: cộng cố định/đơn • <b>rate_per_kg</b>: nhân với kg cà phê cho CTV
        </p>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-gray-400">Đang tải…</div>
      ) : rules.length === 0 ? (
        <div className="p-4 text-sm text-gray-400">Chưa có rule nào</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {rules.map(rule => {
            const d = draft(rule.id);
            const dirty = Object.keys(d).length > 0;
            const fixed = d.fixed_amount ?? rule.fixed_amount;
            const rate = d.collaborator_rate_per_kg ?? rule.collaborator_rate_per_kg;
            const active = d.is_active ?? rule.is_active;
            return (
              <div key={rule.id} className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-800">
                    {TYPE_LABEL[rule.commission_type] ?? rule.commission_type}
                    <span className="ml-2 text-[10px] text-gray-400">{rule.commission_type}</span>
                  </div>
                  <label className="flex items-center gap-1 text-xs text-gray-700 select-none">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={e => setDraft(rule.id, { is_active: e.target.checked })}
                      className="rounded"
                    />
                    <span>Đang dùng</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-[11px] text-gray-500">Fixed / đơn (₫)</span>
                    <input
                      type="number" min={0} step={10000}
                      value={fixed}
                      onChange={e => setDraft(rule.id, { fixed_amount: Number(e.target.value) || 0 })}
                      className="w-full mt-0.5 border rounded-lg px-2 py-1.5 text-sm text-right"
                    />
                    <span className="text-[10px] text-gray-400">{fmt(fixed)} ₫</span>
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-gray-500">CTV / kg (₫)</span>
                    <input
                      type="number" min={0} step={1000}
                      value={rate}
                      onChange={e => setDraft(rule.id, { collaborator_rate_per_kg: Number(e.target.value) || 0 })}
                      className="w-full mt-0.5 border rounded-lg px-2 py-1.5 text-sm text-right"
                    />
                    <span className="text-[10px] text-gray-400">{fmt(rate)} ₫/kg</span>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={!dirty || savingId === rule.id}
                    onClick={() => save(rule)}
                    className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-40"
                  >
                    {savingId === rule.id ? "Đang lưu…" : "Lưu"}
                  </button>
                  {msg?.id === rule.id && (
                    <span className={`text-[11px] ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={addRule} className="px-4 py-3 border-t bg-gray-50 space-y-2">
        <div className="text-xs font-medium text-gray-700">+ Thêm rule mới</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            value={newType}
            onChange={e => setNewType(e.target.value)}
            placeholder="commission_type (vd: coffee_vip)"
            className="border rounded-lg px-2 py-1.5 text-sm"
            required
          />
          <input
            type="number" min={0} step={10000}
            value={newFixed}
            onChange={e => setNewFixed(Number(e.target.value) || 0)}
            placeholder="Fixed amount"
            className="border rounded-lg px-2 py-1.5 text-sm text-right"
          />
          <input
            type="number" min={0} step={1000}
            value={newRate}
            onChange={e => setNewRate(Number(e.target.value) || 0)}
            placeholder="Rate per kg"
            className="border rounded-lg px-2 py-1.5 text-sm text-right"
          />
        </div>
        <button disabled={adding || !newType.trim()} className="text-xs bg-gray-800 text-white px-3 py-1.5 rounded-lg hover:bg-gray-900 disabled:opacity-40">
          {adding ? "Đang thêm…" : "Thêm"}
        </button>
      </form>
    </div>
  );
}
