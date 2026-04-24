"use client";

import { useEffect, useState } from "react";

type Role = "admin" | "manager" | "roastery_manager" | "warehouse" | "sales" | "collaborator";

const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  manager: "Quản lý",
  roastery_manager: "Quản lý xưởng",
  warehouse: "Kho",
  sales: "Sales",
  collaborator: "CTV",
};
const ROLES: Role[] = ["admin", "manager", "roastery_manager", "warehouse", "sales", "collaborator"];

type Row = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  can_view_profit: boolean;
  is_active: boolean;
  created_at: string;
};

export function UsersAdmin({ currentUserId }: { currentUserId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Invite form state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("sales");
  const [inviting, setInviting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/users");
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error ?? "Không tải được danh sách");
      setRows(j.data ?? []);
    } catch (e: any) {
      setError(e.message ?? "Lỗi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function patch(userId: string, body: Partial<Pick<Row, "role" | "can_view_profit" | "is_active">>) {
    setSavingId(userId);
    setError(null);
    try {
      const r = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, ...body }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error ?? "Lỗi cập nhật");
      setRows(prev => prev.map(row => row.user_id === userId ? { ...row, ...body } as Row : row));
    } catch (e: any) {
      setError(e.message ?? "Lỗi");
    } finally {
      setSavingId(null);
    }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error ?? "Lỗi mời");
      setInviteEmail("");
      setInviteOpen(false);
      await load();
    } catch (e: any) {
      setError(e.message ?? "Lỗi");
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Thành viên & phân quyền</h2>
          <p className="text-[11px] text-gray-500">Chỉ admin/quản lý mới thấy mục này</p>
        </div>
        <button
          onClick={() => setInviteOpen(v => !v)}
          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
        >
          {inviteOpen ? "Đóng" : "+ Mời user"}
        </button>
      </div>

      {inviteOpen && (
        <form onSubmit={invite} className="px-4 py-3 border-b bg-gray-50 flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            required
            placeholder="email@vidu.com"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={inviteRole}
            onChange={e => setInviteRole(e.target.value as Role)}
            className="border rounded-lg px-3 py-2 text-sm bg-white"
          >
            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <button
            type="submit"
            disabled={inviting}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {inviting ? "Đang mời…" : "Gửi lời mời"}
          </button>
        </form>
      )}

      {error && (
        <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border-b">{error}</div>
      )}

      {loading ? (
        <div className="p-8 text-center text-sm text-gray-400">Đang tải…</div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-gray-400">Chưa có thành viên</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {rows.map(row => {
            const isSelf = row.user_id === currentUserId;
            const saving = savingId === row.user_id;
            return (
              <div key={row.user_id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">
                    {row.full_name || row.email || row.user_id.slice(0, 8)}
                    {isSelf && <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Bạn</span>}
                    {!row.is_active && <span className="ml-2 text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">Đã tắt</span>}
                  </div>
                  <div className="text-[11px] text-gray-500 truncate">{row.email || "—"}</div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    disabled={saving || isSelf}
                    value={row.role}
                    onChange={e => patch(row.user_id, { role: e.target.value as Role })}
                    className="border rounded-lg px-2 py-1.5 text-xs bg-white disabled:opacity-60"
                    title={isSelf ? "Không thể tự đổi role của bạn" : "Đổi vai trò"}
                  >
                    {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>

                  <label className="flex items-center gap-1 text-xs text-gray-700 select-none">
                    <input
                      type="checkbox"
                      disabled={saving}
                      checked={row.can_view_profit}
                      onChange={e => patch(row.user_id, { can_view_profit: e.target.checked })}
                      className="rounded"
                    />
                    <span>Xem lợi nhuận</span>
                  </label>

                  <button
                    disabled={saving || isSelf}
                    onClick={() => patch(row.user_id, { is_active: !row.is_active })}
                    className={`text-[11px] px-2 py-1 rounded border ${row.is_active ? "text-red-600 border-red-200 hover:bg-red-50" : "text-green-700 border-green-200 hover:bg-green-50"} disabled:opacity-60`}
                    title={isSelf ? "Không thể tự vô hiệu hoá" : (row.is_active ? "Vô hiệu hoá" : "Kích hoạt")}
                  >
                    {row.is_active ? "Tắt" : "Bật"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
