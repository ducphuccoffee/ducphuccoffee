"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { Customer, Product, Order, OrderItemInput } from "@/lib/types";

function money(n: number) {
  return new Intl.NumberFormat("vi-VN").format(Number(n || 0));
}

type ItemRow = {
  product_id: string;
  qty: number;
  sell_price: number;
};

export function OrdersClient({
  initial,
  customers,
  products,
}: {
  initial: Order[];
  customers: Customer[];
  products: Product[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState<string>("");
  const [items, setItems] = useState<ItemRow[]>([
    { product_id: products[0]?.id || "", qty: 1, sell_price: Number(products[0]?.sell_price || 0) },
  ]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return initial;
    return initial.filter((o) => (o.order_code || "").toLowerCase().includes(s) || (o.customer_name || "").toLowerCase().includes(s));
  }, [initial, q]);

  function openCreate() {
    setError(null);
    setCustomerId(customers[0]?.id || "");
    const p0 = products[0];
    setItems([{ product_id: p0?.id || "", qty: 1, sell_price: Number(p0?.sell_price || 0) }]);
    setOpen(true);
  }

  function productById(id: string) {
    return products.find((p) => p.id === id);
  }

  const calc = useMemo(() => {
    let total = 0;
    let cost = 0;
    for (const it of items) {
      if (!it.product_id) continue;
      const p = productById(it.product_id);
      const sell = Number(it.sell_price || 0);
      const c = Number(p?.cost_price || 0);
      total += sell * Number(it.qty || 0);
      cost += c * Number(it.qty || 0);
    }
    return { total, cost, profit: total - cost };
  }, [items, products]);

  function updateItem(idx: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function addItem() {
    const p0 = products[0];
    setItems((prev) => [...prev, { product_id: p0?.id || "", qty: 1, sell_price: Number(p0?.sell_price || 0) }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        customer_id: customerId || null,
        status: "draft",
        items: items
          .filter((i) => i.product_id && Number(i.qty) > 0)
          .map((i) => ({ product_id: i.product_id, qty: Number(i.qty), sell_price: Number(i.sell_price || 0) })),
      };

      if (payload.items.length === 0) throw new Error("Bạn cần ít nhất 1 sản phẩm");

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Tạo đơn thất bại");

      setOpen(false);
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Tạo đơn thất bại");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input placeholder="Tìm theo mã đơn / khách..." value={q} onChange={(e) => setQ(e.target.value)} className="w-[min(420px,100%)]" />
        <Button onClick={openCreate}>+ Tạo đơn hàng</Button>
      </div>

      {error ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="mt-4 overflow-hidden rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-600">
            <tr>
              <th className="px-4 py-3">Mã</th>
              <th className="px-4 py-3">Khách</th>
              <th className="px-4 py-3">Tổng</th>
              <th className="px-4 py-3">Giá vốn</th>
              <th className="px-4 py-3">Lợi nhuận</th>
              <th className="px-4 py-3">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="px-4 py-3 font-medium">{o.order_code || "-"}</td>
                <td className="px-4 py-3 text-zinc-600">{o.customer_name || "-"}</td>
                <td className="px-4 py-3">{money(Number(o.total_amount || 0))}</td>
                <td className="px-4 py-3">{money(Number(o.cost_amount || 0))}</td>
                <td className="px-4 py-3">{money(Number(o.profit || 0))}</td>
                <td className="px-4 py-3 text-zinc-600">{o.status || "-"}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                  Chưa có đơn hàng
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Tạo đơn hàng"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              Huỷ
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Đang tạo..." : "Tạo đơn"}
            </Button>
          </div>
        }
      >
        <div className="grid gap-4">
          <div>
            <label className="text-xs font-medium text-zinc-600">Khách hàng</label>
            <select
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Sản phẩm</div>
              <Button variant="secondary" onClick={addItem}>
                + Thêm dòng
              </Button>
            </div>

            <div className="mt-3 space-y-3">
              {items.map((it, idx) => {
                const p = productById(it.product_id);
                return (
                  <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-end">
                    <div className="sm:col-span-6">
                      <label className="text-xs font-medium text-zinc-600">Sản phẩm</label>
                      <select
                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                        value={it.product_id}
                        onChange={(e) => {
                          const pid = e.target.value;
                          const np = productById(pid);
                          updateItem(idx, { product_id: pid, sell_price: Number(np?.sell_price || 0) });
                        }}
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-xs font-medium text-zinc-600">SL</label>
                      <Input type="number" value={it.qty} onChange={(e) => updateItem(idx, { qty: Number(e.target.value) })} />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="text-xs font-medium text-zinc-600">Giá bán</label>
                      <Input
                        type="number"
                        value={it.sell_price}
                        onChange={(e) => updateItem(idx, { sell_price: Number(e.target.value) })}
                      />
                      <div className="mt-1 text-[11px] text-zinc-500">
                        Giá vốn: {money(Number(p?.cost_price || 0))}
                      </div>
                    </div>

                    <div className="sm:col-span-1 sm:text-right">
                      <Button variant="secondary" onClick={() => removeItem(idx)} disabled={items.length === 1}>
                        ✕
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-xl bg-zinc-50 px-3 py-2 text-sm">
                <div className="text-xs text-zinc-500">Tổng</div>
                <div className="font-semibold">{money(calc.total)}</div>
              </div>
              <div className="rounded-xl bg-zinc-50 px-3 py-2 text-sm">
                <div className="text-xs text-zinc-500">Giá vốn</div>
                <div className="font-semibold">{money(calc.cost)}</div>
              </div>
              <div className="rounded-xl bg-zinc-50 px-3 py-2 text-sm">
                <div className="text-xs text-zinc-500">Lợi nhuận</div>
                <div className="font-semibold">{money(calc.profit)}</div>
              </div>
            </div>
          </div>

          <div className="text-xs text-zinc-500">
            Ghi chú: Step này chỉ tạo đơn + items + tính tổng/giá vốn/lợi nhuận. Inventory OUT sẽ làm ở step tiếp theo.
          </div>
        </div>
      </Modal>
    </div>
  );
}
