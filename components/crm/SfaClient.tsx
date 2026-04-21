"use client";

import { formatDateTimeVN } from "@/lib/date";
import dynamic from "next/dynamic";
import { useState } from "react";

// Dynamic import to avoid SSR crash — Leaflet requires window
const SfaMap = dynamic(() => import("./SfaMap"), { ssr: false, loading: () => <div className="h-72 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">Đang tải bản đồ…</div> });

export interface Visit {
  id: string;
  customer_id: string;
  customer_name: string;
  user_id: string;
  check_in_time: string;
  check_in_lat: number | null;
  check_in_lng: number | null;
  note: string | null;
  status: string;
}

export interface CustomerPin {
  id: string;
  name: string;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
}

const STATUS_LABEL: Record<string, string> = {
  visited:   "Đã thăm",
  no_answer: "Không bắt máy",
  follow_up: "Cần follow-up",
};
const STATUS_COLOR: Record<string, string> = {
  visited:   "bg-green-100 text-green-700",
  no_answer: "bg-gray-100 text-gray-500",
  follow_up: "bg-amber-100 text-amber-700",
};

export function SfaClient({
  initialVisits, customers, currentUserId, isAdmin,
}: {
  initialVisits: Visit[];
  customers: CustomerPin[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [visits, setVisits] = useState<Visit[]>(initialVisits);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    customer_id: "",
    note: "",
    status: "visited",
    check_in_lat: "",
    check_in_lng: "",
  });

  async function detectGps() {
    if (!navigator.geolocation) { setError("Trình duyệt không hỗ trợ GPS"); return; }
    navigator.geolocation.getCurrentPosition(
      pos => setForm(f => ({ ...f, check_in_lat: String(pos.coords.latitude), check_in_lng: String(pos.coords.longitude) })),
      () => setError("Không lấy được vị trí GPS")
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_id) { setError("Vui lòng chọn khách hàng"); return; }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/crm/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_id:   form.customer_id,
        note:          form.note.trim() || null,
        status:        form.status,
        check_in_lat:  form.check_in_lat ? Number(form.check_in_lat) : null,
        check_in_lng:  form.check_in_lng ? Number(form.check_in_lng) : null,
      }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Lỗi"); setSaving(false); return; }
    const custName = customers.find(c => c.id === form.customer_id)?.name ?? "—";
    setVisits(prev => [{ ...json.data, customer_name: custName }, ...prev]);
    setShowForm(false);
    setSaving(false);
  }

  const mapPins = customers.filter(c => c.latitude != null && c.longitude != null);

  return (
    <div className="p-6 space-y-5">
      {/* Map */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">
            Bản đồ khách hàng ({mapPins.length} điểm)
          </p>
          <span className="text-xs text-gray-400">OpenStreetMap · Leaflet</span>
        </div>
        <div className="h-72">
          <SfaMap customers={mapPins} visits={visits} />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">{visits.length} visit</p>
        <button onClick={() => { setShowForm(true); setError(null); setForm({ customer_id: "", note: "", status: "visited", check_in_lat: "", check_in_lng: "" }); }}
          className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition">
          + Ghi nhận visit
        </button>
      </div>

      {/* Visits list — card layout (mobile-first) */}
      <div className="space-y-2">
        {visits.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
            Chưa có visit nào
          </div>
        )}
        {visits.map(v => (
          <div key={v.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{v.customer_name}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {formatDateTimeVN(v.check_in_time)}
              </p>
              {v.note && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{v.note}</p>}
            </div>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 mt-0.5 ${STATUS_COLOR[v.status] ?? "bg-gray-100 text-gray-500"}`}>
              {STATUS_LABEL[v.status] ?? v.status}
            </span>
          </div>
        ))}
      </div>

      {/* New visit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowForm(false)}>
          <form onSubmit={submit} onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Ghi nhận visit</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Khách hàng *</label>
              <select value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                <option value="">-- Chọn khách hàng --</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kết quả</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
              <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
            </div>

            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Lat / Lng (tuỳ chọn)</label>
                <div className="flex gap-1">
                  <input placeholder="Lat" value={form.check_in_lat}
                    onChange={e => setForm(f => ({ ...f, check_in_lat: e.target.value }))}
                    className="w-1/2 border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                  <input placeholder="Lng" value={form.check_in_lng}
                    onChange={e => setForm(f => ({ ...f, check_in_lng: e.target.value }))}
                    className="w-1/2 border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
              </div>
              <button type="button" onClick={detectGps}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                📍 GPS
              </button>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={saving}
                className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                {saving ? "Đang lưu…" : "Lưu visit"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Huỷ
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
