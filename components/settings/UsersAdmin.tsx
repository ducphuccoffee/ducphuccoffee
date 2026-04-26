"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/ui/Toast";

type Role =
  | "admin"
  | "manager"
  | "roastery_manager"
  | "warehouse"
  | "sales"
  | "collaborator"
  | "delivery";

const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  manager: "Quản lý",
  roastery_manager: "Quản lý xưởng",
  warehouse: "Kho",
  sales: "Sales",
  collaborator: "CTV",
  delivery: "Giao hàng",
};
const ROLES: Role[] = [
  "admin",
  "manager",
  "roastery_manager",
  "warehouse",
  "sales",
  "collaborator",
  "delivery",
];

type Row = {
  user_id: string;
  email: string | null;
  username: string | null;
  is_internal: boolean;
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
  const [resetId, setResetId] = useState<string | null>(null);

  // Create form
  const [createOpen, setCreateOpen] = useState(false);
  const [mode, setMode] = useState<"username" | "email">("username");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [emailInvite, setEmailInvite] = useState("");
  const [newRole, setNewRole] = useState<Role>("sales");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);

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

  async function patch(userId: string, body: Record<string, any>) {
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

  async function resetPassword(userId: string) {
    const pw = window.prompt("Nhập mật khẩu mới (≥ 6 ký tự):");
    if (pw == null) return;
    if (pw.length < 6) {
      setError("Mật khẩu phải ít nhất 6 ký tự");
      return;
    }
    setResetId(userId);
    setError(null);
    try {
      const r = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, password: pw }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error ?? "Lỗi đổi mật khẩu");
      toast.success("Đã đổi mật khẩu");
    } catch (e: any) {
      setError(e.message ?? "Lỗi");
    } finally {
      setResetId(null);
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateMsg(null);
    setError(null);
    try {
      const body: Record<string, any> = { role: newRole };
      if (mode === "username") {
        body.username = username.trim();
        body.password = password;
        if (fullName.trim()) body.full_name = fullName.trim();
      } else {
        body.email = emailInvite.trim();
      }
      const r = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error ?? "Lỗi tạo user");
      setCreateMsg(
        mode === "username"
          ? `Đã tạo: ${j.username}`
          : `Đã gửi mời tới: ${j.email}`,
      );
      setUsername("");
      setPassword("");
      setFullName("");
      setEmailInvite("");
      await load();
    } catch (e: any) {
      setError(e.message ?? "Lỗi");
    } finally {
      setCreating(false);
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
          onClick={() => setCreateOpen(v => !v)}
          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
        >
          {createOpen ? "Đóng" : "+ Tạo user"}
        </button>
      </div>

      {createOpen && (
        <form onSubmit={createUser} className="px-4 py-3 border-b bg-gray-50 space-y-2">
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setMode("username")}
              className={`px-3 py-1 rounded-full border ${mode === "username" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700"}`}
            >
              Username + mật khẩu
            </button>
            <button
              type="button"
              onClick={() => setMode("email")}
              className={`px-3 py-1 rounded-full border ${mode === "email" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700"}`}
            >
              Mời qua email
            </button>
          </div>

          {mode === "username" ? (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                required
                placeholder="Username / SĐT (vd: 0967027267)"
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm sm:col-span-2"
                autoComplete="off"
              />
              <input
                required
                type="text"
                placeholder="Mật khẩu (≥ 6)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
                autoComplete="new-password"
              />
              <select
                value={newRole}
                onChange={e => setNewRole(e.target.value as Role)}
                className="border rounded-lg px-3 py-2 text-sm bg-white"
              >
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
              <input
                placeholder="Họ tên (tuỳ chọn)"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm sm:col-span-3"
              />
              <button
                type="submit"
                disabled={creating}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? "Đang tạo…" : "Tạo user"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                required
                placeholder="email@vidu.com"
                value={emailInvite}
                onChange={e => setEmailInvite(e.target.value)}
                className="flex-1 border rounded-lg px-3 py-2 text-sm"
              />
              <select
                value={newRole}
                onChange={e => setNewRole(e.target.value as Role)}
                className="border rounded-lg px-3 py-2 text-sm bg-white"
              >
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
              <button
                type="submit"
                disabled={creating}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? "Đang gửi…" : "Gửi lời mời"}
              </button>
            </div>
          )}

          {createMsg && <div className="text-xs text-green-700">{createMsg}</div>}
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
            const resetting = resetId === row.user_id;
            const displayId =
              row.username ||
              (row.is_internal ? null : row.email) ||
              row.user_id.slice(0, 8);
            return (
              <div key={row.user_id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">
                    {row.full_name || displayId}
                    {isSelf && <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Bạn</span>}
                    {!row.is_active && <span className="ml-2 text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">Đã tắt</span>}
                  </div>
                  <div className="text-[11px] text-gray-500 truncate">
                    {row.username
                      ? <>@{row.username}{row.is_internal ? "" : <> · {row.email}</>}</>
                      : (row.email || "—")}
                  </div>
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
                    type="button"
                    disabled={resetting}
                    onClick={() => resetPassword(row.user_id)}
                    className="text-[11px] px-2 py-1 rounded border text-blue-700 border-blue-200 hover:bg-blue-50 disabled:opacity-60"
                    title="Đặt lại mật khẩu"
                  >
                    {resetting ? "…" : "Đổi mật khẩu"}
                  </button>

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
