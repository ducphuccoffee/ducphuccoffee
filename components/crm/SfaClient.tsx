"use client";

import { formatDateTimeVN, formatDateVN } from "@/lib/date";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import Link from "next/link";

const SfaMap = dynamic(() => import("./SfaMap"), { ssr: false, loading: () => <div className="h-72 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">Đang tải bản đồ…</div> });

export interface Visit {
  id: string;
  customer_id: string | null;
  lead_id: string | null;
  customer_name: string;
  owner_user_id: string;
  checkin_at: string;
  checkin_lat: number | null;
  checkin_lng: number | null;
  result: string | null;
  note: string | null;
}

export interface CustomerPin {
  id: string;
  name: string;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
}

const RESULT_LABEL: Record<string, string> = {
  no_answer: "Không gặp",
  met_owner: "Gặp chủ",
  sampled: "Gửi sample",
  quoted: "Báo giá",
  followup_needed: "Cần follow-up",
  won: "Chốt đơn",
  lost: "Mất",
};
const RESULT_COLOR: Record<string, string> = {
  no_answer: "bg-gray-100 text-gray-500",
  met_owner: "bg-blue-100 text-blue-700",
  sampled: "bg-purple-100 text-purple-700",
  quoted: "bg-orange-100 text-orange-700",
  followup_needed: "bg-amber-100 text-amber-700",
  won: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
};

export function SfaClient({
  customers, currentUserId, isAdmin,
}: {
  customers: CustomerPin[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [plannedVisits, setPlannedVisits] = useState<Array<{ id: string; description: string | null; due_at: string | null; customer_id: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [form, setForm] = useState({
    customer_id: "",
    note: "",
    result: "met_owner",
    checkin_lat: "",
    checkin_lng: "",
  });

  // Read query params for deep-link check-in from Today page.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const custId = params.get("customer_id");
    const tId = params.get("task_id");
    if (tId) setTaskId(tId);
    if (custId) {
      setForm(f => ({ ...f, customer_id: custId }));
      setShowForm(true);
    }
  }, []);

  function loadPlanned() {
    fetch("/api/crm-tasks").then(r => r.json()).then(res => {
      const rows = (res.data ?? []).filter((t: any) => t.type === "visit");
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);
      const today = rows.filter((t: any) => {
        if (!t.due_at) return true;
        const d = new Date(t.due_at);
        return d < tomorrowStart; // overdue + today
      });
      setPlannedVisits(today.map((t: any) => ({
        id: t.id,
        description: t.description,
        due_at: t.due_at,
        customer_id: t.customer_id,
      })));
    });
  }

  function loadVisits() {
    setLoading(true);
    fetch("/api/sfa-visits")
      .then(r => r.json())
      .then(res => {
        if (res.ok) {
          setVisits((res.data ?? []).map((v: any) => ({
            ...v,
            customer_name: v.customers?.name ?? v.leads?.name ?? "—",
          })));
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadVisits(); loadPlanned(); }, []);

  async function detectGps() {
    if (!navigator.geolocation) { setError("Trình duyệt không hỗ trợ GPS"); return; }
    navigator.geolocation.getCurrentPosition(
      pos => setForm(f => ({ ...f, checkin_lat: String(pos.coords.latitude), checkin_lng: String(pos.coords.longitude) })),
      () => setError("Không lấy được vị trí GPS")
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_id) { setError("Vui lòng chọn khách hàng"); return; }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/sfa-visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_id:  form.customer_id,
        note:         form.note.trim() || null,
        result:       form.result,
        checkin_lat:  form.checkin_lat ? Number(form.checkin_lat) : null,
        checkin_lng:  form.checkin_lng ? Number(form.checkin_lng) : null,
        task_id:      taskId || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) { setError(json.error ?? "Lỗi"); setSaving(false); return; }
    setShowForm(false);
    setSaving(false);
    setTaskId(null);
    loadVisits();
    loadPlanned();
  }

  const mapPins = customers.filter(c => c.latitude != null && c.longitude != null);

  return (
    <div className="p-4 space-y-4">
      {/* Map */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-3 py-2.5 border-b flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">Bản đồ ({mapPins.length} điểm)</p>
        </div>
        <div className="h-72">
          <SfaMap customers={mapPins} visits={visits} />
        </div>
      </div>

      {/* Planned visits today */}
      {plannedVisits.length > 0 && (
        <div className="bg-white rounded-xl border border-orange-200 overflow-hidden">
          <div className="px-3 py-2 border-b bg-orange-50 flex items-center justify-between">
            <p className="text-sm font-semibold text-orange-800">Kế hoạch ghé thăm hôm nay ({plannedVisits.length})</p>
            <Link href="/crm/today" className="text-[11px] text-blue-600 hover:underline">Việc hôm nay →</Link>
          </div>
          <div className="divide-y divide-gray-100">
            {plannedVisits.map(p => {
              const cust = customers.find(c => c.id === p.customer_id);
              return (
                <div key={p.id} className="flex items-center justify-between px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-gray-800 truncate">{cust?.name ?? p.description ?? "Ghé thăm"}</div>
                    {p.due_at && <div className="text-[10px] text-gray-400">Hẹn: {formatDateVN(p.due_at)}</div>}
                  </div>
                  <button
                    onClick={() => {
                      setTaskId(p.id);
                      setForm(f => ({ ...f, customer_id: p.customer_id ?? "" }));
                      setShowForm(true);
                      setError(null);
                    }}
                    className="text-[11px] bg-blue-600 text-white px-2.5 py-1 rounded hover:bg-blue-700 shrink-0"
                  >
                    Check-in
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">{visits.length} visit</p>
        <button onClick={() => { setTaskId(null); setShowForm(true); setError(null); setForm({ customer_id: "", note: "", result: "met_owner", checkin_lat: "", checkin_lng: "" }); }}
          className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          + Check-in
        </button>
      </div>

      {/* Visits list */}
      {loading ? (
        <div className="space-y-2 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-2">
          {visits.length === 0 && <div className="bg-white rounded-xl border p-8 text-center text-gray-400 text-sm">Chưa có visit nào</div>}
          {visits.map(v => (
            <div key={v.id} className="bg-white rounded-xl border px-3 py-2.5 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{v.customer_name}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{formatDateTimeVN(v.checkin_at)}</p>
                {v.note && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{v.note}</p>}
              </div>
              {v.result && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${RESULT_COLOR[v.result] ?? "bg-gray-100 text-gray-500"}`}>
                  {RESULT_LABEL[v.result] ?? v.result}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New visit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setShowForm(false)}>
          <form onSubmit={submit} onClick={e => e.stopPropagation()}
            className="bg-white w-full sm:max-w-md sm:rounded-xl rounded-t-xl max-h-[90vh] overflow-y-auto p-4 space-y-3">
            <h2 className="text-base font-bold text-gray-800">Check-in</h2>

            <div>
              <label className="text-xs font-medium text-gray-600">Khách hàng *</label>
              <select value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}
                className="w-full mt-1 border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">-- Chọn --</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600">Kết quả</label>
              <select value={form.result} onChange={e => setForm(f => ({ ...f, result: e.target.value }))}
                className="w-full mt-1 border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {Object.entries(RESULT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600">Ghi chú</label>
              <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                rows={2} className="w-full mt-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>

            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-600">Lat / Lng</label>
                <div className="flex gap-1 mt-1">
                  <input placeholder="Lat" value={form.checkin_lat}
                    onChange={e => setForm(f => ({ ...f, checkin_lat: e.target.value }))}
                    className="w-1/2 border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <input placeholder="Lng" value={form.checkin_lng}
                    onChange={e => setForm(f => ({ ...f, checkin_lng: e.target.value }))}
                    className="w-1/2 border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <button type="button" onClick={detectGps}
                className="px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">GPS</button>
            </div>

            {error && <p className="text-red-500 text-xs bg-red-50 p-2 rounded">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-3 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">Huỷ</button>
              <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Đang lưu…" : "Lưu check-in"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
