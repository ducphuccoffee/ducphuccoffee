"use client";

import { useEffect, useState } from "react";
import { formatDateTimeVN, formatCurrencyVN } from "@/lib/date";

type Row = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  meta: any;
  created_at: string;
  actor_user_id: string;
  actor: { full_name: string | null; username: string | null } | null;
};

const ACTION_LABEL: Record<string, string> = {
  "order.create":         "Tạo đơn",
  "order.update_status":  "Đổi trạng thái đơn",
  "order.delete":         "Xoá đơn",
  "payment.create":       "Thu tiền",
  "product.update":       "Sửa sản phẩm",
  "user.create":          "Tạo user",
  "user.update":          "Sửa user / phân quyền",
  "item.update_min_stock":"Đổi ngưỡng tồn",
};

const ENTITY_TYPES = ["", "order", "payment", "product", "user", "item"];
const ACTIONS = ["", ...Object.keys(ACTION_LABEL)];

export function AuditLogViewer() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const [limit, setLimit] = useState(100);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      if (filterAction) params.set("action", filterAction);
      if (filterEntity) params.set("entity_type", filterEntity);
      const r = await fetch(`/api/audit-log?${params.toString()}`);
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error ?? "Lỗi");
      setRows(j.data ?? []);
    } catch (e: any) {
      setError(e.message ?? "Lỗi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filterAction, filterEntity, limit]);

  return (
    <div className="bg-white rounded-xl border">
      <div className="px-4 py-3 border-b flex flex-wrap items-center gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Nhật ký hoạt động</h3>
          <p className="text-[11px] text-gray-500">Ai làm gì lúc nào — chỉ admin/quản lý xem được</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            className="border rounded-lg px-2 py-1 text-xs bg-white"
          >
            {ACTIONS.map(a => (
              <option key={a} value={a}>{a ? (ACTION_LABEL[a] ?? a) : "Tất cả hành động"}</option>
            ))}
          </select>
          <select
            value={filterEntity}
            onChange={e => setFilterEntity(e.target.value)}
            className="border rounded-lg px-2 py-1 text-xs bg-white"
          >
            {ENTITY_TYPES.map(e => (
              <option key={e} value={e}>{e || "Tất cả đối tượng"}</option>
            ))}
          </select>
          <select
            value={limit}
            onChange={e => setLimit(Number(e.target.value))}
            className="border rounded-lg px-2 py-1 text-xs bg-white"
          >
            {[50, 100, 200, 500].map(n => <option key={n} value={n}>{n} dòng</option>)}
          </select>
        </div>
      </div>

      {error && <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border-b">{error}</div>}

      {loading ? (
        <div className="p-8 text-center text-sm text-gray-400">Đang tải…</div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-400">Chưa có hoạt động</div>
      ) : (
        <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
          {rows.map(r => (
            <div key={r.id} className="px-4 py-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-800">
                    {ACTION_LABEL[r.action] ?? r.action}
                    <span className="ml-2 text-[10px] uppercase bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                      {r.entity_type}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {r.actor?.full_name || r.actor?.username || r.actor_user_id.slice(0, 8)}
                  </div>
                  {r.meta && Object.keys(r.meta).length > 0 && (
                    <MetaPretty meta={r.meta} />
                  )}
                </div>
                <div className="text-[11px] text-gray-400 whitespace-nowrap">
                  {formatDateTimeVN(r.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetaPretty({ meta }: { meta: any }) {
  // Render simple { from, to } diffs nicely; fall back to JSON for the rest.
  const parts: React.ReactNode[] = [];
  for (const [k, v] of Object.entries(meta)) {
    if (v && typeof v === "object" && "from" in (v as any) && "to" in (v as any)) {
      parts.push(
        <span key={k} className="mr-3">
          <span className="text-gray-500">{k}:</span>{" "}
          <span className="line-through text-red-600">{fmt(k, (v as any).from)}</span>
          {" → "}
          <span className="text-green-700 font-medium">{fmt(k, (v as any).to)}</span>
        </span>
      );
    } else if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      parts.push(
        <span key={k} className="mr-3">
          <span className="text-gray-500">{k}:</span> {fmt(k, v)}
        </span>
      );
    }
  }
  if (parts.length === 0) {
    return <pre className="text-[10px] text-gray-500 mt-1 whitespace-pre-wrap">{JSON.stringify(meta)}</pre>;
  }
  return <div className="text-[11px] text-gray-700 mt-0.5">{parts}</div>;
}

function fmt(key: string, v: any) {
  if (v == null) return "—";
  if (typeof v === "number" && (key.includes("amount") || key.includes("price"))) {
    return formatCurrencyVN(v);
  }
  if (typeof v === "boolean") return v ? "có" : "không";
  return String(v);
}
