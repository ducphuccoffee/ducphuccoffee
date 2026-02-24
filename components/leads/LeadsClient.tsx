"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import type { Lead } from "@/lib/types";

const stages = [
  "lead",
  "qualify",
  "quote",
  "sample_sent",
  "sample_test",
  "negotiate",
  "won",
  "lost",
  "nurture",
];

export function LeadsClient({ initial }: { initial: Lead[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", stage: "lead" });

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return initial;
    return initial.filter((l) => (l.name || "").toLowerCase().includes(s) || (l.phone || "").toLowerCase().includes(s));
  }, [initial, q]);

  function openCreate() {
    setError(null);
    setForm({ name: "", phone: "", stage: "lead" });
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, phone: form.phone || null, stage: form.stage }),
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

  async function updateStage(id: string, stage: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, stage }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Update failed");
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input placeholder="Tìm theo tên / SĐT..." value={q} onChange={(e) => setQ(e.target.value)} className="w-[min(420px,100%)]" />
        <Button onClick={openCreate}>+ Tạo lead</Button>
      </div>

      {error ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="mt-4 overflow-hidden rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-600">
            <tr>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">SĐT</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Cập nhật</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="px-4 py-3 font-medium">{l.name}</td>
                <td className="px-4 py-3 text-zinc-600">{l.phone || "-"}</td>
                <td className="px-4 py-3"><Badge>{l.stage}</Badge></td>
                <td className="px-4 py-3">
                  <select
                    className="rounded-xl border px-3 py-2 text-sm"
                    value={l.stage}
                    onChange={(e) => updateStage(l.id, e.target.value)}
                    disabled={saving}
                  >
                    {stages.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-zinc-500">Chưa có lead</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Tạo lead"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>Huỷ</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Đang lưu..." : "Lưu"}</Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-zinc-600">Tên lead / Quán / Xe</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ví dụ: Quán Cafe ABC" />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600">SĐT</label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="090..." />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600">Stage</label>
            <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
              {stages.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
