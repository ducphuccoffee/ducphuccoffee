"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AuthCard } from "@/components/AuthCard";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function SignupPage() {
  const supabase = createBrowserSupabaseClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    setLoading(false);
    if (error) return setError(error.message);

    // If email confirmations enabled, user needs to confirm; otherwise they can login immediately.
    setSuccess("Tạo tài khoản thành công. Bạn có thể đăng nhập ngay (hoặc kiểm tra email nếu bật confirm).");
  }

  return (
    <AuthCard
      title="Đăng ký"
      footer={
        <>
          Đã có tài khoản?{" "}
          <Link className="font-medium text-zinc-900 underline-offset-4 hover:underline" href="/login">
            Đăng nhập
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700">Họ tên</label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Tên của bạn" required />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700">Email</label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" type="email" required />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700">Mật khẩu</label>
          <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Ít nhất 6 ký tự" type="password" required />
        </div>

        {error ? <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        {success ? <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div> : null}

        <Button className="w-full" disabled={loading}>
          {loading ? "Đang tạo..." : "Tạo tài khoản"}
        </Button>
      </form>
    </AuthCard>
  );
}
