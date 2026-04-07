"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";

const money = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(n) || 0);

const KIND_LABEL: Record<string, string> = { original: "Nguyên chất", blend: "Blend" };
const KIND_COLOR: Record<string, string> = {
  original: "bg-green-100 text-green-700",
  blend: "bg-purple-100 text-purple-700",
};
const UNIT_LABEL: Record<string, string> = { kg: "kg", goi: "Gói" };

export type GreenType = { id: string; name: string };

export type ProductFormula = {
  id: string;
  green_type_id: string;
  ratio_pct: number;
  green_types?: { name: string } | null;
};

export type Product = {
  id: string;
  name: string;
  sku: string | null;
  kind: "original" | "blend";
  unit: "kg" | "goi";
  weight_per_unit: number | null;
  price: number;
  note: string | null;
  is_active: boolean;
  created_at: string;
  product_formulas?: ProductFormula[];
};

type FormulaRow = { green_type_id: string; ratio_pct: string };

const emptyForm = () => ({
  name: "",
  sku: "",
  kind: "original" as "original" | "blend",
  unit: "kg" as "kg" | "goi",
  weight_per_unit: "",
  price: "",
  note: "",
});

type Props = { initialProducts: Product[]; greenTypes: GreenType[]; error?: string | null };

export function ProductsClient({ initialProducts, greenTypes, error }: Props) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form
  const [form, setForm] = useState(emptyForm());
  const [formulas, setFormulas] = useState<FormulaRow[]>([{ green_type_id: "", ratio_pct: "" }]);

  useEffect(() => { setProducts(initialProducts); }, [initialProducts]);

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q)
    );
  }, [products, search]);

  // Tổng tỉ lệ blend
  const totalRatio = useMemo(
    () => formulas.reduce((s, f) => s + (parseFloat(f.ratio_pct) || 0), 0),
    [formulas]
  );

  function openCreate() {
    setForm(emptyForm());
    setFormulas([{ green_type_id: "", ratio_pct: "" }]);
    setFormError(null);
    setShowModal(true);
  }

  function addFormulaRow() {
    setFormulas([...formulas, { green_type_id: "", ratio_pct: "" }]);
  }

  function removeFormulaRow(i: number) {
    setFormulas(formulas.filter((_, idx) => idx !== i));
  }

  function updateFormula(i: number, field: keyof FormulaRow, val: string) {
    const updated = [...formulas];
    updated[i] = { ...updated[i], [field]: val };
    setFormulas(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!form.name.trim()) { setFormError("Vui lòng nhập tên sản phẩm"); return; }
    if (form.kind === "blend") {
      const validFormulas = formulas.filter(f => f.green_type_id && f.ratio_pct);
      if (!validFormulas.length) { setFormError("Blend cần ít nhất 1 nguyên liệu"); return; }
      if (Math.abs(totalRatio - 100) > 0.01) { setFormError(`Tổng tỉ lệ phải = 100% (hiện: ${totalRatio.toFixed(1)}%)`); return; }
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        kind: form.kind,
        unit: form.unit,
        weight_per_unit: form.weight_per_unit ? Number(form.weight_per_unit) : null,
        price: Number(form.price) || 0,
        note: form.note.trim() || null,
        formulas: form.kind === "blend"
          ? formulas.filter(f => f.green_type_id && f.ratio_pct).map(f => ({
              green_type_id: f.green_type_id,
              ratio_pct: parseFloat(f.ratio_pct),
            }))
          : [],
      };

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || json.error) { setFormError(json.error ?? "Lỗi tạo sản phẩm"); return; }
      setShowModal(false);
      router.refresh();
    } catch {
      setFormError("Lỗi kết nối");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/products?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || json.error) { alert(json.error ?? "Lỗi xoá"); return; }
      setDeleteId(null);
      router.refresh();
    } catch {
      alert("Lỗi kết nối");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">⚠️ {error}</div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5">
        <input
          className="border rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Tìm tên, SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex-1" />
        <button
          onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          + Thêm sản phẩm
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tên sản phẩm</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">SKU</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Loại</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Đơn vị</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Giá bán</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Công thức</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Xoá</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50 transition">
                <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{p.sku ?? "—"}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${KIND_COLOR[p.kind] ?? ""}`}>
                    {KIND_LABEL[p.kind] ?? p.kind}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {UNIT_LABEL[p.unit] ?? p.unit}
                  {p.unit === "goi" && p.weight_per_unit ? ` (${p.weight_per_unit}g)` : ""}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-800">{money(p.price)}</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {p.kind === "original" ? (
                    <span className="text-gray-400 italic">Nguyên chất</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {(p.product_formulas ?? []).map((f) => (
                        <span key={f.id} className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded text-xs">
                          {f.green_types?.name ?? f.green_type_id} {f.ratio_pct}%
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => setDeleteId(p.id)}
                    className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50 transition"
                  >
                    Xoá
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                  Chưa có sản phẩm nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal tạo sản phẩm */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800">Thêm sản phẩm mới</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Tên */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên sản phẩm *</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="VD: Robusta S18 rang mộc, Blend Signature..."
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              {/* SKU */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="VD: ROB-S18, BLEND-SIG"
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                />
              </div>

              {/* Loại */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loại sản phẩm *</label>
                <div className="flex gap-3">
                  {(["original", "blend"] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setForm({ ...form, kind: k })}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition ${
                        form.kind === k
                          ? k === "original" ? "bg-green-600 text-white border-green-600" : "bg-purple-600 text-white border-purple-600"
                          : "border-gray-200 text-gray-600 hover:border-gray-400"
                      }`}
                    >
                      {KIND_LABEL[k]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Đơn vị */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị bán *</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value as "kg" | "goi" })}
                  >
                    <option value="kg">Kg</option>
                    <option value="goi">Gói</option>
                  </select>
                </div>
                {form.unit === "goi" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Trọng lượng/gói (gram)</label>
                    <input
                      type="number"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="VD: 500"
                      value={form.weight_per_unit}
                      onChange={(e) => setForm({ ...form, weight_per_unit: e.target.value })}
                    />
                  </div>
                )}
              </div>

              {/* Giá bán */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Giá bán (VNĐ)</label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="VD: 250000"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>

              {/* Công thức Blend */}
              {form.kind === "blend" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Công thức blend
                      <span className={`ml-2 text-xs ${Math.abs(totalRatio - 100) < 0.01 ? "text-green-600" : "text-orange-500"}`}>
                        (Tổng: {totalRatio.toFixed(1)}%)
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={addFormulaRow}
                      className="text-blue-600 text-xs hover:underline"
                    >
                      + Thêm dòng
                    </button>
                  </div>
                  <div className="space-y-2">
                    {formulas.map((f, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <select
                          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={f.green_type_id}
                          onChange={(e) => updateFormula(i, "green_type_id", e.target.value)}
                        >
                          <option value="">-- Chọn loại nhân --</option>
                          {greenTypes.map((gt) => (
                            <option key={gt.id} value={gt.id}>{gt.name}</option>
                          ))}
                        </select>
                        <div className="relative w-24">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-6"
                            placeholder="60"
                            value={f.ratio_pct}
                            onChange={(e) => updateFormula(i, "ratio_pct", e.target.value)}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
                        </div>
                        {formulas.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeFormulaRow(i)}
                            className="text-red-400 hover:text-red-600 text-lg leading-none"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ghi chú */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                <textarea
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Mô tả sản phẩm..."
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </div>

              {formError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  ⚠️ {formError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition"
                  disabled={saving}
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg transition"
                  disabled={saving}
                >
                  {saving ? "Đang lưu..." : "Tạo sản phẩm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal xác nhận xoá */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Xoá sản phẩm?</h3>
            <p className="text-sm text-gray-500 mb-5">Hành động này không thể hoàn tác.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition"
                disabled={saving}
              >
                Huỷ
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 rounded-lg transition"
                disabled={saving}
              >
                {saving ? "Đang xoá..." : "Xoá"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
