"use client";

import { useEffect, useState } from "react";

type Org = {
  settings: {
    stock?: { default_min_stock_kg?: number };
  };
};

type Item = {
  id: string;
  name: string;
  sku: string | null;
  uom: string;
  type: string | null;
  min_stock: number | null;
};

type Product = {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
  min_stock: number | null;
};

type Alert = {
  kind: "item" | "product";
  id: string;
  name: string;
  sku: string | null;
  uom: string;
  type: string | null;
  onhand: number;
  min_stock: number;
  is_default_threshold: boolean;
  deficit: number;
};

export function StockAlertsSettings() {
  const [defaultMin, setDefaultMin] = useState<number>(5);
  const [savingDefault, setSavingDefault] = useState(false);
  const [defaultMsg, setDefaultMsg] = useState<string | null>(null);

  const [items, setItems] = useState<Item[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [orgR, itemsR, prodR, alertR] = await Promise.all([
        fetch("/api/org"),
        fetch("/api/stock-alerts/items"),
        fetch("/api/stock-alerts/products"),
        fetch("/api/stock-alerts"),
      ]);
      const [orgJ, itemsJ, prodJ, alertJ] = await Promise.all([
        orgR.json(), itemsR.json(), prodR.json(), alertR.json(),
      ]);
      const org = orgJ?.data as Org | null;
      setDefaultMin(Number(org?.settings?.stock?.default_min_stock_kg ?? 5));
      setItems(itemsJ?.data ?? []);
      setProducts(prodJ?.data ?? []);
      setAlerts(alertJ?.data?.alerts ?? []);
    } catch (e: any) {
      setError(e.message ?? "Lỗi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function saveDefault(e: React.FormEvent) {
    e.preventDefault();
    setSavingDefault(true);
    setDefaultMsg(null);
    try {
      const r = await fetch("/api/org", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { stock: { default_min_stock_kg: defaultMin } } }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error ?? "Lỗi");
      setDefaultMsg("Đã lưu");
      await load();
    } catch (e: any) {
      setDefaultMsg(e.message ?? "Lỗi");
    } finally {
      setSavingDefault(false);
    }
  }

  async function setItemMin(id: string, value: number | null) {
    setSavingId(id);
    setError(null);
    try {
      const r = await fetch(`/api/stock-alerts/items?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ min_stock: value }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error ?? "Lỗi");
      setItems(prev => prev.map(it => it.id === id ? { ...it, min_stock: value } : it));
    } catch (e: any) {
      setError(e.message ?? "Lỗi");
    } finally {
      setSavingId(null);
    }
  }

  async function setProductMin(id: string, value: number | null) {
    setSavingId(id);
    setError(null);
    try {
      const r = await fetch(`/api/products?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ min_stock: value }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error ?? "Lỗi");
      setProducts(prev => prev.map(p => p.id === id ? { ...p, min_stock: value } : p));
    } catch (e: any) {
      setError(e.message ?? "Lỗi");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <div className="bg-white rounded-xl border p-4 text-sm text-gray-400">Đang tải…</div>;

  return (
    <div className="space-y-3">
      {/* Default threshold */}
      <form onSubmit={saveDefault} className="bg-white rounded-xl border p-4 space-y-2">
        <h3 className="text-sm font-semibold text-gray-800">Ngưỡng tồn kho mặc định</h3>
        <p className="text-[11px] text-gray-500">
          Áp dụng cho các SP/nguyên liệu chưa đặt ngưỡng riêng. Tồn ≤ ngưỡng → cảnh báo.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number" min={0} step={0.1}
            value={defaultMin}
            onChange={e => setDefaultMin(Number(e.target.value) || 0)}
            className="w-32 border rounded-lg px-3 py-2 text-sm"
          />
          <span className="text-xs text-gray-500">kg</span>
          <button
            disabled={savingDefault}
            className="ml-auto bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {savingDefault ? "Đang lưu…" : "Lưu"}
          </button>
          {defaultMsg && <span className="text-xs text-gray-600">{defaultMsg}</span>}
        </div>
      </form>

      {/* Active alerts */}
      <div className="bg-white rounded-xl border">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-semibold text-gray-800">
            🚨 Cảnh báo tồn kho ({alerts.length})
          </h3>
          <p className="text-[11px] text-gray-500">Các mặt hàng có tồn ≤ ngưỡng cảnh báo</p>
        </div>
        {alerts.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">Tất cả OK ✓</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {alerts.map(a => (
              <div key={`${a.kind}-${a.id}`} className="px-4 py-2 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{a.name}</div>
                  <div className="text-[11px] text-gray-500 truncate">
                    {a.sku ? `SKU: ${a.sku} · ` : ""}{a.kind === "item" ? `Loại: ${a.type ?? "—"}` : "Sản phẩm bán"}
                    {a.is_default_threshold && " · ngưỡng mặc định"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs">
                    Tồn: <span className={a.onhand <= 0 ? "text-red-600 font-bold" : "text-orange-600 font-semibold"}>{a.onhand} {a.uom}</span>
                  </div>
                  <div className="text-[11px] text-gray-500">Ngưỡng: {a.min_stock} {a.uom}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <div className="px-4 py-2 text-xs text-red-600 bg-red-50 rounded">{error}</div>}

      {/* Items min_stock editor */}
      {items.length > 0 && (
        <div className="bg-white rounded-xl border">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-semibold text-gray-800">Ngưỡng theo nguyên liệu / item</h3>
            <p className="text-[11px] text-gray-500">Bỏ trống = dùng ngưỡng mặc định</p>
          </div>
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {items.map(it => (
              <RowEditor
                key={it.id}
                name={it.name}
                sku={it.sku}
                uom={it.uom}
                value={it.min_stock}
                saving={savingId === it.id}
                onSave={v => setItemMin(it.id, v)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Products min_stock editor */}
      {products.length > 0 && (
        <div className="bg-white rounded-xl border">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-semibold text-gray-800">Ngưỡng theo sản phẩm bán</h3>
            <p className="text-[11px] text-gray-500">Cảnh báo khi tồn rang ≤ ngưỡng</p>
          </div>
          <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
            {products.map(p => (
              <RowEditor
                key={p.id}
                name={p.name}
                sku={p.sku}
                uom={p.unit ?? "kg"}
                value={p.min_stock}
                saving={savingId === p.id}
                onSave={v => setProductMin(p.id, v)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RowEditor({
  name, sku, uom, value, saving, onSave,
}: {
  name: string;
  sku: string | null;
  uom: string;
  value: number | null;
  saving: boolean;
  onSave: (v: number | null) => void;
}) {
  const [draft, setDraft] = useState<string>(value == null ? "" : String(value));
  useEffect(() => { setDraft(value == null ? "" : String(value)); }, [value]);

  const dirty = (value == null ? "" : String(value)) !== draft;

  return (
    <div className="px-4 py-2 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{name}</div>
        {sku && <div className="text-[11px] text-gray-500 truncate">SKU: {sku}</div>}
      </div>
      <div className="flex items-center gap-1">
        <input
          type="number" min={0} step={0.1}
          value={draft}
          placeholder="—"
          onChange={e => setDraft(e.target.value)}
          className="w-20 border rounded px-2 py-1 text-xs"
        />
        <span className="text-[11px] text-gray-500">{uom}</span>
        <button
          disabled={saving || !dirty}
          onClick={() => onSave(draft === "" ? null : Number(draft))}
          className="text-[11px] px-2 py-1 rounded border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-40"
        >
          {saving ? "…" : "Lưu"}
        </button>
      </div>
    </div>
  );
}
