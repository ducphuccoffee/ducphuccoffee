"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Clock, User, Loader2, RefreshCw, Package2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { toast } from "@/components/ui/Toast";

const COLUMNS: { type: string; label: string; short: string; color: string; dot: string }[] = [
  { type: "confirm_order", label: "Chờ tiếp nhận",  short: "Tiếp nhận", color: "border-t-sky-400",     dot: "bg-sky-400" },
  { type: "prepare_order", label: "Đang chuẩn bị",  short: "Chuẩn bị",  color: "border-t-amber-400",   dot: "bg-amber-400" },
  { type: "deliver_order", label: "Chờ giao",       short: "Chờ giao",  color: "border-t-purple-400",  dot: "bg-purple-400" },
  { type: "close_order",   label: "Chờ hoàn tất",   short: "Hoàn tất",  color: "border-t-emerald-400", dot: "bg-emerald-400" },
];

const TYPE_LABEL: Record<string, string> = {
  confirm_order: "Tiếp nhận đơn",
  prepare_order: "Chuẩn bị hàng",
  deliver_order: "Giao hàng",
  close_order:   "Hoàn tất đơn",
};

const TASK_ROLES: Record<string, string[]> = {
  confirm_order: ["admin", "manager", "warehouse"],
  prepare_order: ["admin", "manager", "warehouse"],
  deliver_order: ["admin", "manager", "warehouse", "shipper"],
  close_order:   ["admin", "manager"],
};

const money = (n: number) =>
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
  order_id?: string | null;
  assigned_to: string | null;
  assignee_name?: string | null;
  created_at: string;
  orders?: {
    id: string;
    order_code: string | null;
    status: string;
    total_amount: number | null;
    customers?: { id: string; name: string; phone?: string | null } | null;
  } | null;
}

interface Props {
  userId: string;
  userRole: string;
}

export default function TaskBoard({ userId, userRole }: Props) {
  const [tasks, setTasks]     = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(COLUMNS[0].type);

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
      toast.error(e.message);
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

  const grouped = useMemo(() => Object.fromEntries(
    COLUMNS.map(col => [
      col.type,
      tasks.filter(t => t.type === col.type && ["todo", "in_progress"].includes(t.status))
    ])
  ), [tasks]);

  const totalCount = tasks.filter(t => ["todo", "in_progress"].includes(t.status)).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Task xử lý đơn hàng</p>
          {totalCount > 0 && (
            <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
              {totalCount}
            </span>
          )}
        </div>
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

      {/* ── Mobile: tab pills + single column ─────────────────────── */}
      <div className="sm:hidden">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 mb-3">
          {COLUMNS.map(col => {
            const count = grouped[col.type]?.length ?? 0;
            const active = activeTab === col.type;
            return (
              <button
                key={col.type}
                onClick={() => setActiveTab(col.type)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all ${
                  active
                    ? "bg-gray-900 text-white shadow"
                    : "bg-white text-gray-600 border border-gray-200"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${col.dot}`} />
                {col.short}
                {count > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0 rounded-full min-w-[18px] text-center ${
                    active ? "bg-white/20" : "bg-gray-100 text-gray-600"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
            </div>
          ) : (grouped[activeTab]?.length ?? 0) === 0 ? (
            <p className="text-center text-[12px] text-gray-300 py-8">Không có task</p>
          ) : (
            grouped[activeTab].map(task => (
              <TaskCard
                key={task.id}
                task={task}
                userId={userId}
                acting={acting}
                onAction={doAction}
                canTake={canTake(task)}
                canComplete={canComplete(task)}
                canReject={canReject(task)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Desktop: kanban columns ───────────────────────────────── */}
      <div className="hidden sm:flex gap-3 overflow-x-auto pb-2">
        {COLUMNS.map(col => {
          const colTasks = grouped[col.type] ?? [];
          return (
            <div key={col.type}
              className={`shrink-0 w-[280px] bg-gray-50 rounded-xl border border-gray-200 border-t-4 ${col.color} flex flex-col`}>
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
                  colTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      userId={userId}
                      acting={acting}
                      onAction={doAction}
                      canTake={canTake(task)}
                      canComplete={canComplete(task)}
                      canReject={canReject(task)}
                      compact
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Card ──────────────────────────────────────────────────────────── */
function TaskCard({
  task, userId, acting, onAction, canTake, canComplete, canReject, compact,
}: {
  task: Task;
  userId: string;
  acting: string | null;
  onAction: (id: string, action: "take" | "complete" | "reject") => void;
  canTake: boolean;
  canComplete: boolean;
  canReject: boolean;
  compact?: boolean;
}) {
  const order   = task.orders;
  const orderId = task.order_id || task.ref_id || order?.id;
  const orderCode = order?.order_code ?? (orderId ? `#${orderId.slice(0, 8).toUpperCase()}` : null);
  const custName  = order?.customers?.name ?? null;
  const amount    = order?.total_amount ?? 0;
  const isInProgress = task.status === "in_progress";
  const assignedToMe = task.assigned_to === userId;

  return (
    <div className={`bg-white rounded-xl border shadow-sm transition-all ${
      isInProgress ? "border-amber-300 ring-1 ring-amber-100" : "border-gray-200"
    }`}>
      {/* Top row: order code + status badge */}
      <div className="px-3 pt-3 pb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {orderCode ? (
            <Link href={`/orders?focus=${orderId}`} className="text-[13px] font-bold text-gray-800 font-mono hover:text-blue-600 transition truncate block">
              {orderCode}
            </Link>
          ) : (
            <div className="flex items-center gap-1.5 text-[13px] font-bold text-gray-700">
              <Package2 className="h-3.5 w-3.5 text-gray-400" />
              {TYPE_LABEL[task.type] ?? task.type}
            </div>
          )}
          {custName && (
            <p className="text-[11px] text-gray-500 truncate flex items-center gap-1 mt-0.5">
              <User className="h-3 w-3 shrink-0" />{custName}
            </p>
          )}
        </div>
        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap ${
          isInProgress ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"
        }`}>
          {isInProgress ? "Đang xử lý" : "Chờ nhận"}
        </span>
      </div>

      {/* Meta row */}
      <div className="px-3 pb-2 flex items-center justify-between gap-2 text-[10.5px]">
        <div className="flex items-center gap-2 text-gray-400 min-w-0">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 shrink-0" />{formatDate(task.created_at)}
          </span>
          {amount > 0 && (
            <span className="font-semibold text-gray-700">{money(amount)}</span>
          )}
        </div>
        {task.assignee_name && (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded truncate max-w-[100px] ${
            assignedToMe ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
          }`} title={task.assignee_name}>
            {assignedToMe ? "Bạn" : task.assignee_name}
          </span>
        )}
      </div>

      {/* Actions */}
      {(canTake || canComplete || canReject) && (
        <div className="px-2 pb-2 flex gap-1.5">
          {canTake && (
            <button
              onClick={() => onAction(task.id, "take")}
              disabled={!!acting}
              className="flex-1 text-[11.5px] font-semibold bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-lg py-2 transition disabled:opacity-50 flex items-center justify-center gap-1">
              {acting === task.id + "take"
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <>Nhận xử lý <ChevronRight className="h-3 w-3" /></>}
            </button>
          )}
          {canComplete && (
            <button
              onClick={() => onAction(task.id, "complete")}
              disabled={!!acting}
              className="flex-1 text-[11.5px] font-semibold bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-lg py-2 transition disabled:opacity-50">
              {acting === task.id + "complete" ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : "Hoàn thành"}
            </button>
          )}
          {canReject && (
            <button
              onClick={() => onAction(task.id, "reject")}
              disabled={!!acting}
              title="Từ chối"
              className="text-[11.5px] font-semibold bg-white hover:bg-red-50 text-red-500 border border-red-200 rounded-lg w-9 py-2 transition disabled:opacity-50 flex items-center justify-center">
              {acting === task.id + "reject" ? <Loader2 className="h-3 w-3 animate-spin" /> : "✕"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
