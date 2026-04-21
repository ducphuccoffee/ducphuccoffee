"use client";

import { formatDateTimeVN } from "@/lib/date";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { Checkin } from "@/lib/types";

function nowLocalInputValue() {
  const d = new Date();
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CheckinsClient({ initial }: { initial: Checkin[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ checkin_at: nowLocalInputValue(), lat: "", lng: "", place_name: "", note: "" });

  function openCreate() {
    setError(null);
    setForm({ checkin_at: nowLocalInputValue(), lat: "", lng: "", place_name: "", note: "" });
    setOpen(true);
  }

  async function fillGps() {
    setError(null);
    if (!navigator.geolocation) {
      setError("Trình duyệt không hỗ trợ GPS");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({ ...f, lat: String(pos.coords.latitude), lng: String(pos.coords.longitude) }));
      },
      (err) => setError(err.message || "Không lấy được GPS"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        checkin_at: new Date(form.checkin_at).toISOString(),
        lat: Number(form.lat),
        lng: Number(form.lng),
        place_name: form.place_name || null,
        note: form.note || null,
      };
      const res = await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Save failed");
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-zinc-600">Mẹo: mở bằng điện thoại để lấy GPS nhanh.</div>
        <Button onClick={openCreate}>+ Check-in</Button>
      </div>

      {error ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="mt-4 overflow-hidden rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-600">
            <tr>
              <th className="px-4 py-3">Thời gian</th>
              <th className="px-4 py-3">Địa điểm</th>
              <th className="px-4 py-3">GPS</th>
              <th className="px-4 py-3">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {initial.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-3 text-zinc-600">{formatDateTimeVN(r.checkin_at)}</td>
                <td className="px-4 py-3 font-medium">{r.place_name || "-"}</td>
                <td className="px-4 py-3 text-zinc-600">{Number(r.lat).toFixed(5)}, {Number(r.lng).toFixed(5)}</td>
                <td className="px-4 py-3 text-zinc-600">{r.note || "-"}</td>
              </tr>
            ))}
            {initial.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-zinc-500">Chưa có check-in</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Check-in"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>Huỷ</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-zinc-600">Thời gian</label>
            <Input type="datetime-local" value={form.checkin_at} onChange={(e) => setForm({ ...form, checkin_at: e.target.value })} />
          </div>
          <div className="flex items-end gap-2">
            <Button variant="secondary" onClick={fillGps} disabled={saving}>Lấy GPS</Button>
            <div className="text-xs text-zinc-500">(cho phép định vị)</div>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600">Latitude</label>
            <Input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} placeholder="10.77..." />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600">Longitude</label>
            <Input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} placeholder="106.69..." />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-zinc-600">Địa điểm</label>
            <Input value={form.place_name} onChange={(e) => setForm({ ...form, place_name: e.target.value })} placeholder="Ví dụ: Quán Cafe XYZ" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-zinc-600">Ghi chú</label>
            <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Ví dụ: gặp chủ quán, hẹn test mẫu" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
