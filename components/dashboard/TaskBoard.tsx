"use client";

import { useEffect, useState, useCallback } from "react";
import { Clock, User, CheckCircle, XCircle, Loader2, RefreshCw } from "lucide-react";

const COLUMNS: { type: string; label: string; color: string }[] = [
  { type: "confirm_order", label: "Chờ tiếp nhận",  color: "border-t-sky-400" },
  { type: "prepare_order", label: "Đang chuẩn bị",  color: "border-t-amber-400" },
  { type: "deliver_order", label: "Chờ giao",        color: "border-t-purple-400" },
  { type: "close_order",   label: "Chờ hoàn tất",   color: "border-t-emerald-400" },
];

const TASK_ROLES: Record<string, string[]> = {
  confirm_order: ["admin", "manager", "warehouse"],
  prepare_order: ["admin", "manager", "warehouse"],
  deliver_order: ["admin", "manager", "warehouse", "shipper"],
  close_order:   ["admin", "manager"],
};

const VN_FMT = new Intl.NumberFormat("vi-VN");
const money  = (n: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency", currency: "VND",
    notation: n >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: n >= 1_000_000 ? 1 : 0,
  }).format(n);

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

interface Task {
  id: string;
  type: string;
  status: string;
  ref_id: string | null;
  ref_type: string | null;
  assigned_to: string | null;
  created_at: string;
  orders?: {
    id: string;
    order_code: string | null;
    status: string;
    total_amount: number | null;
    customers?: { id: string; name: string } | null;
  } | null;
}

interface Props {
  userId: string;
  userRole: string;
}

export default function TaskBoard({ userId, userRole }: Props) {
  const [tasks, setTasks]         = useState<Task[]>([]);
  const [loading, setLoading]     = useState(true);
  const [acting, setActing]       = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);

  const isAdminManager = ["admin", "manager"].includes(userRole);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/tasks");
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setTasks(json.data ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function doAction(taskId: string, action: "take" | "complete" | "reject") {
    setActing(taskId + action);
    try {
      const res  = await fetch(`/api/tasks?id=${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      await load();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActing(null);
    }
  }

  function canTake(task: Task) {
    if (task.status !== "todo") return false;
    if (task.assigned_to && task.assigned_to !== userId) return false;
    return (TASK_ROLES[task.type] ?? []).includes(userRole);
  }

  function canComplete(task: Task) {
    if (task.status !== "in_progress") return false;
    if (task.assigned_to) return task.assigned_to === userId || isAdminManager;
    return (TASK_ROLES[task.type] ?? []).includes(userRole);
  }

  function canReject(task: Task) {
    if (!["todo", "in_progress"].includes(task.status)) return false;
    return isAdminManager || task.assigned_to === userId;
  }

  const grouped = Object.fromEntries(
    COLUMNS.map(col => [col.type, tasks.filter(t => t.type === col.type && ["todo", "in_progress"].includes(t.status))])
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Task xử lý đơn hàng</p>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors">
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Tải lại
        </button>
      </div>

      {error && (
        <div className="text-[12px] text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
          {error}
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUMNS.map(col => {
          const colTasks = grouped[col.type] ?? [];
          return (
            <div key={col.type}
              className={`shrink-0 w-[260px] sm:w-[280px] bg-gray-50 rounded-xl border border-gray-200 border-t-4 ${col.color} flex flex-col`}>
              <div className="px-3 pt-3 pb-2 flex items-center justify-between">
                <span className="text-[12px] font-bold text-gray-700">{col.label}</span>
                <span className="text-[11px] bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-500 font-medium">
                  {colTasks.length}
                </span>
              </div>

              <div className="flex flex-col gap-2 px-2 pb-3 overflow-y-auto max-h-[480px]">
                {loading && colTasks.length === 0 ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-300" />
                  </div>
                ) : colTasks.length === 0 ? (
                  <p className="text-center text-[11px] text-gray-300 py-6">Không có task</p>
                ) : (
                  colTasks.map(task => {
                    const order      = task.orders;
                    const orderCode  = order?.order_code ?? `#${task.ref_id?.slice(0, 8).toUpperCase() ?? "—"}`;
                    const custName   = order?.customers?.name ?? "—";
                    const amount     = order?.total_amount ?? 0;
                    const isInProgress = task.status === "in_progress";

                    return (
                      <div key={task.id}
                        className={`bg-white rounded-lg border shadow-sm p-3 space-y-2 transition-all
                          ${isInProgress ? "border-amber-300 ring-1 ring-amber-200" : "border-gray-200"}`}>

                        <div className="flex items-start justify-between gap-1">
                          <span className="text-[13px] font-bold text-gray-800 font-mono">{orderCode}</span>
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                            isInProgress ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"
                          }`}>
                            {isInProgress ? "Đang xử lý" : "Chờ nhận"}
                          </span>
                        </div>

                        <div className="space-y-0.5">
                          <p className="text-[11px] text-gray-500 truncate flex items-center gap-1">
                            <User className="h-3 w-3 shrink-0" />{custName}
                          </p>
                          <p className="text-[12px] font-semibold text-gray-700">
                            {amount ? money(amount) : "—"}
                          </p>
                          <p className="text-[10px] text-gray-400 flex items-center gap-1">
                            <Clock className="h-3 w-3 shrink-0" />{formatDate(task.created_at)}
                          </p>
                          {task.assigned_to && (
                            <p className="text-[10px] text-amber-600 font-medium">
                              Assigned: {task.assigned_to === userId ? "Bạn" : task.assigned_to.slice(0, 8)}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-1.5 pt-1">
                          {canTake(task) && (
                            <button
                              onClick={() => doAction(task.id, "take")}
                              disabled={!!acting}
                              className="flex-1 text-[11px] font-semibold bg-blue-500 hover:bg-blue-600 text-white rounded-md py-1.5 transition-colors disabled:opacity-50">
                              {acting === task.id + "take" ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : "Nhận xử lý"}
                            </button>
                          )}
                          {canComplete(task) && (
                            <button
                              onClick={() => doAction(task.id, "complete")}
                              disabled={!!acting}
                              className="flex-1 text-[11px] font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-md py-1.5 transition-colors disabled:opacity-50">
                              {acting === task.id + "complete" ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : "Hoàn thành"}
                            </button>
                          )}
                          {canReject(task) && (
                            <button
                              onClick={() => doAction(task.id, "reject")}
                              disabled={!!acting}
                              title="Từ chối"
                              className="text-[11px] font-semibold bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 rounded-md px-2 py-1.5 transition-colors disabled:opacity-50">
                              {acting === task.id + "reject" ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
