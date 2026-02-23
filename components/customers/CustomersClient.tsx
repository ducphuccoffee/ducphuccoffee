"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { Customer } from "@/lib/types";

const emptyForm = {
  id: "",
  name: "",
  phone: "",
  email: "",
  address: "",
  credit_limit: 0,
};

function money(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(n || 0));
}

export function CustomersClient({ initial }: { initial: Customer[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return initial;
    return initial.filter((c) => (c.name || "").toLowerCase().includes(s) || (c.phone || "").toLowerCase().includes(s) || (c.email || "").toLowerCase().includes(s));
  }, [initial, q]);

  function openCreate() {
    setError(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(c: Customer) {
    setError(null);
    setForm({
      id: c.id,
      name: c.name || "",
      phone: c.phone || "",
      email: c.email || "",
      address: c.address || "",
      credit_limit: Number(c.credit_limit || 0),
    });
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        credit_limit: Number(form.credit_limit || 0),
      };

      const res = await fetch("/api/customers", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form.id ? { id: form.id, ...payload } : payload),
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

  async function remove(id: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Delete failed");
      setConfirmId(null);
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input placeholder="Tìm theo tên / SĐT / email..." value={q} onChange={(e) => setQ(e.target.value)} className="w-[min(420px,100%)]" />
        <Button onClick={openCreate}>+ Thêm khách hàng</Button>
      </div>

      {error ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="mt-4 overflow-hidden rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-600">
            <tr>
              <th className="px-4 py-3">Tên</th>
              <th className="px-4 py-3">Điện thoại</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Credit limit</th>
              <th className="px-4 py-3 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-zinc-600">{c.phone || "-"}</td>
                <td className="px-4 py-3 text-zinc-600">{c.email || "-"}</td>
                <td className="px-4 py-3">{money(Number(c.credit_limit || 0))}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-2">
                    <Button variant="secondary" onClick={() => openEdit(c)}>
                      Sửa
                    </Button>
                    <Button variant="secondary" onClick={() => setConfirmId(c.id)}>
                      Xoá
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-zinc-500">
                  Không có dữ liệu
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={form.id ? "Sửa khách hàng" : "Thêm khách hàng"}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              Huỷ
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-zinc-600">Tên khách</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ví dụ: Quán Cafe A" />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600">Điện thoại</label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="090..." />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600">Email</label>
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="a@b.com" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-zinc-600">Địa chỉ</label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="TP.HCM" />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600">Credit limit</label>
            <Input
              type="number"
              value={form.credit_limit}
              onChange={(e) => setForm({ ...form, credit_limit: Number(e.target.value) })}
              placeholder="0"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        title="Xoá khách hàng?"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmId(null)} disabled={saving}>
              Huỷ
            </Button>
            <Button onClick={() => confirmId && remove(confirmId)} disabled={saving}>
              {saving ? "Đang xoá..." : "Xoá"}
            </Button>
          </div>
        }
      >
        <div className="text-sm text-zinc-700">Hành động này không thể hoàn tác.</div>
      </Modal>
    </div>
  );
}
