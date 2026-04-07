"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { RoastBatch, GreenStock } from "@/lib/batch-types";

const money = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  completed: "Hoàn thành",
  cancelled: "Đã huỷ",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

type Props = {
  initialBatches: RoastBatch[];
  initialStock: GreenStock[];
  error?: string | null;
};

export function BatchesClient({ initialBatches, initialStock, error }: Props) {
  const router = useRouter();
  const [batches, setBatches] = useState<RoastBatch[]>(initialBatches);
  const [stock, setStock] = useState<GreenStock[]>(initialStock);

  // Sync khi server refresh xong
  useEffect(() => { setBatches(initialBatches); }, [initialBatches]);
  useEffect(() => { setStock(initialStock); }, [initialStock]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [selectedLot, setSelectedLot] = useState("");
  const [inputKg, setInputKg] = useState("");
  const [outputKg, setOutputKg] = useState("");
  const [note, setNote] = useState("");

  // Preview tính toán
  const preview = useMemo(() => {
    const iKg = parseFloat(inputKg) || 0;
    const oKg = parseFloat(outputKg) || 0;
    if (!iKg || !oKg || oKg > iKg) return null;
    const lot = stock.find((s) => s.green_inbound_id === selectedLot);
    const lossKg = iKg - oKg;
    const lossPct = ((lossKg / iKg) * 100).toFixed(2);
    const costPerKg = lot ? Math.round((iKg * lot.unit_cost) / oKg) : 0;
    return { lossKg, lossPct, costPerKg };
  }, [inputKg, outputKg, selectedLot, stock]);

  const filtered = useMemo(() => {
    if (!search.trim()) return batches;
    const q = search.toLowerCase();
    return batches.filter(
      (b) =>
        b.batch_code.toLowerCase().includes(q) ||
        (b.green_type_name ?? "").toLowerCase().includes(q) ||
        (b.lot_code ?? "").toLowerCase().includes(q)
    );
  }, [batches, search]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!selectedLot) { setFormError("Vui lòng chọn lô nhân"); return; }
    const iKg = parseFloat(inputKg);
    const oKg = parseFloat(outputKg);
    if (!iKg || iKg <= 0) { setFormError("Nhập kg đầu vào hợp lệ"); return; }
    if (!oKg || oKg <= 0) { setFormError("Nhập kg thành phẩm hợp lệ"); return; }
    if (oKg > iKg) { setFormError("Thành phẩm không thể lớn hơn đầu vào"); return; }

    const lot = stock.find((s) => s.green_inbound_id === selectedLot);
    if (lot && iKg > lot.remaining_kg) {
      setFormError(`Lô "${lot.lot_code}" chỉ còn ${lot.remaining_kg}kg`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          green_inbound_id: selectedLot,
          input_kg: iKg,
          output_kg: oKg,
          note: note.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setFormError(json.error ?? "Lỗi tạo batch");
        return;
      }
      setShowModal(false);
      setSelectedLot(""); setInputKg(""); setOutputKg(""); setNote("");
      // Refetch toàn bộ data từ server (cập nhật stock FIFO + batches list)
      router.refresh();
    } catch {
      setFormError("Lỗi kết nối");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5">
        <input
          className="border rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Tìm mã batch, loại nhân, lô..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex-1" />
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          + Tạo batch rang
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Tổng batch"
          value={batches.filter((b) => b.status === "completed").length}
          unit="batch"
          color="blue"
        />
        <StatCard
          label="Tổng đầu vào"
          value={batches
            .filter((b) => b.status === "completed")
            .reduce((s, b) => s + b.input_kg, 0)
            .toFixed(1)}
          unit="kg"
          color="orange"
        />
        <StatCard
          label="Tổng thành phẩm"
          value={batches
            .filter((b) => b.status === "completed")
            .reduce((s, b) => s + b.output_kg, 0)
            .toFixed(1)}
          unit="kg"
          color="green"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Mã batch</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Ngày rang</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Loại nhân / Lô</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Đầu vào</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Thành phẩm</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Hao hụt</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Giá vốn/kg</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-400">
                  Chưa có batch rang nào
                </td>
              </tr>
            )}
            {filtered.map((b) => (
              <tr key={b.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3 font-mono font-semibold text-blue-700">{b.batch_code}</td>
                <td className="px-4 py-3 text-gray-700">{b.roast_date}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-800">{b.green_type_name ?? "—"}</div>
                  {b.lot_code && (
                    <div className="text-xs text-gray-400 mt-0.5">{b.lot_code}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">{Number(b.input_kg).toFixed(1)} kg</td>
                <td className="px-4 py-3 text-right text-gray-700">{Number(b.output_kg).toFixed(1)} kg</td>
                <td className="px-4 py-3 text-right">
                  <span className="text-orange-600 font-medium">{(Number(b.input_kg) - Number(b.output_kg)).toFixed(1)} kg</span>
                  <span className="text-gray-400 text-xs ml-1">({(((Number(b.input_kg) - Number(b.output_kg)) / Number(b.input_kg)) * 100).toFixed(1)}%)</span>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-800">
                  {money(Number(b.output_kg) > 0 ? Math.round((Number(b.input_kg) * Number(b.unit_cost_green)) / Number(b.output_kg)) : 0)}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[b.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {STATUS_LABEL[b.status] ?? b.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-gray-800">Tạo batch rang mới</h2>
              <button
                onClick={() => { setShowModal(false); setFormError(null); }}
                className="text-gray-400 hover:text-gray-700 text-xl leading-none"
              >×</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
                  {formError}
                </div>
              )}

              {/* Chọn lô nhân (FIFO) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lô nhân xanh <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedLot}
                  onChange={(e) => setSelectedLot(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">— Chọn lô (FIFO) —</option>
                  {stock
                    .filter((s) => s.remaining_kg > 0)
                    .map((s) => (
                      <option key={s.green_inbound_id} value={s.green_inbound_id}>
                        {s.lot_code} · {s.green_type_name} · còn {Number(s.remaining_kg).toFixed(1)}kg · {money(s.unit_cost)}/kg
                      </option>
                    ))}
                </select>
              </div>

              {/* Input kg */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Đầu vào (kg) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={inputKg}
                    onChange={(e) => setInputKg(e.target.value)}
                    placeholder="VD: 50"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Thành phẩm (kg) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={outputKg}
                    onChange={(e) => setOutputKg(e.target.value)}
                    placeholder="VD: 42"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Preview */}
              {preview && (
                <div className="bg-blue-50 rounded-lg p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Hao hụt:</span>
                    <span className="font-semibold text-orange-600">
                      {preview.lossKg.toFixed(2)} kg ({preview.lossPct}%)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Giá vốn/kg thành phẩm:</span>
                    <span className="font-semibold text-blue-700">{money(preview.costPerKg)}</span>
                  </div>
                </div>
              )}

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Tuỳ chọn..."
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setFormError(null); }}
                  className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50 transition"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg py-2 text-sm font-medium transition"
                >
                  {saving ? "Đang lưu..." : "Tạo batch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label, value, unit, color,
}: {
  label: string; value: string | number; unit: string; color: "blue" | "green" | "orange";
}) {
  const colorMap = {
    blue: "bg-blue-100 text-blue-700",
    green: "bg-green-100 text-green-700",
    orange: "bg-orange-100 text-orange-700",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${colorMap[color]}`}>
        {color === "blue" ? "☕" : color === "green" ? "✅" : "⚖️"}
      </div>
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-xl font-bold text-gray-800">
          {value} <span className="text-sm font-normal text-gray-500">{unit}</span>
        </div>
      </div>
    </div>
  );
}
