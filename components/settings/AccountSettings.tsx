"use client";

import { useState } from "react";

export function AccountSettings({ initialFullName }: { initialFullName: string | null }) {
  const [fullName, setFullName] = useState(initialFullName ?? "");
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true);
    setNameMsg(null);
    try {
      const r = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error ?? "Lỗi");
      setNameMsg({ ok: true, text: "Đã lưu tên" });
    } catch (e: any) {
      setNameMsg({ ok: false, text: e.message ?? "Lỗi" });
    } finally {
      setSavingName(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (pw1.length < 8) { setPwMsg({ ok: false, text: "Mật khẩu phải ít nhất 8 ký tự" }); return; }
    if (pw1 !== pw2) { setPwMsg({ ok: false, text: "Mật khẩu nhập lại không khớp" }); return; }
    setSavingPw(true);
    try {
      const r = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_password: pw1 }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error ?? "Lỗi");
      setPw1(""); setPw2("");
      setPwMsg({ ok: true, text: "Đã đổi mật khẩu" });
    } catch (e: any) {
      setPwMsg({ ok: false, text: e.message ?? "Lỗi" });
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={saveName} className="bg-white rounded-xl border p-4 space-y-2">
        <h3 className="text-sm font-semibold text-gray-800">Họ tên</h3>
        <input
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          placeholder="Họ và tên"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex items-center gap-2">
          <button
            disabled={savingName}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {savingName ? "Đang lưu…" : "Lưu"}
          </button>
          {nameMsg && (
            <span className={`text-xs ${nameMsg.ok ? "text-green-700" : "text-red-600"}`}>{nameMsg.text}</span>
          )}
        </div>
      </form>

      <form onSubmit={savePassword} className="bg-white rounded-xl border p-4 space-y-2">
        <h3 className="text-sm font-semibold text-gray-800">Đổi mật khẩu</h3>
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Mật khẩu mới (≥ 8 ký tự)"
          value={pw1}
          onChange={e => setPw1(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Nhập lại mật khẩu mới"
          value={pw2}
          onChange={e => setPw2(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex items-center gap-2">
          <button
            disabled={savingPw}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {savingPw ? "Đang đổi…" : "Đổi mật khẩu"}
          </button>
          {pwMsg && (
            <span className={`text-xs ${pwMsg.ok ? "text-green-700" : "text-red-600"}`}>{pwMsg.text}</span>
          )}
        </div>
      </form>
    </div>
  );
}
