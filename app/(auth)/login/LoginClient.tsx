"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function LoginClient() {
  const sp = useSearchParams();
  const next = sp.get("next") || "/dashboard";

  return (
    <AuthCard
      title="Đăng nhập"
      footer={
        <div className="flex items-center justify-between">
          <span>Chưa có tài khoản?</span>
          <Link className="underline" href={`/signup?next=${encodeURIComponent(next)}`}>
            Đăng ký
          </Link>
        </div>
      }
    >
      <form className="space-y-3" action="/api/auth/login" method="post">
        <input type="hidden" name="next" value={next} />
        <div>
          <label className="text-xs font-medium text-zinc-600">Email</label>
          <Input name="email" type="email" required placeholder="you@email.com" />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-600">Mật khẩu</label>
          <Input name="password" type="password" required placeholder="••••••••" />
        </div>
        <Button type="submit" className="w-full">
          Đăng nhập
        </Button>
      </form>
    </AuthCard>
  );
}