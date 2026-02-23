"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AuthCard } from "@/components/AuthCard";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const supabase = createBrowserSupabaseClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = useSearchParams().get("next") || "/dashboard";

  async function onSubmit(e: React.FormEvent) {
  e.preventDefault();
  setError(null);
  setLoading(true);

  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const json = await res.json();
  setLoading(false);

  if (!json.ok) return setError(json.error || "Login failed");

  window.location.href = next;
}

  return (
    <AuthCard
      title="Đăng nhập"
      footer={
        <>
          Chưa có tài khoản?{" "}
          <Link className="font-medium text-zinc-900 underline-offset-4 hover:underline" href="/signup">
            Đăng ký
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700">Email</label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" type="email" required />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700">Mật khẩu</label>
          <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" type="password" required />
        </div>

        {error ? <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

        <Button className="w-full" disabled={loading}>
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </Button>
      </form>
    </AuthCard>
  );
}
