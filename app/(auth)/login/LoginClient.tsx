"use client";

import { useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function LoginClient() {
  const sp = useSearchParams();
  const next = sp.get("next") || "/dashboard";
  const err = sp.get("err");

  return (
    <AuthCard title="Đăng nhập" footer={null}>
      <form className="space-y-3" action="/api/auth/login" method="post">
        <input type="hidden" name="next" value={next} />
        <div>
          <label className="text-xs font-medium text-zinc-600">
            Tên đăng nhập / Số điện thoại
          </label>
          <Input
            name="username"
            type="text"
            required
            placeholder="vd: 0967027267"
            autoComplete="username"
            inputMode="text"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-600">Mật khẩu</label>
          <Input
            name="password"
            type="password"
            required
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>
        {err && (
          <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{err}</p>
        )}
        <Button type="submit" className="w-full">Đăng nhập</Button>
        <p className="text-[11px] text-zinc-400 text-center">
          Quên mật khẩu? Liên hệ quản lý để được cấp lại.
        </p>
      </form>
    </AuthCard>
  );
}
