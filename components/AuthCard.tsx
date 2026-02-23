import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export function AuthCard({ title, children, footer }: { title: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="mt-1 text-sm text-zinc-600">Quản lý xưởng rang + CRM + ERP mini</p>
      </CardHeader>
      <CardContent>
        {children}
        <div className="mt-4 text-sm text-zinc-600">{footer}</div>
        <div className="mt-6 text-xs text-zinc-500">
          Tip: Nếu bạn chưa tạo schema DB, hãy chạy file SQL trong <code className="rounded bg-zinc-100 px-1">supabase/migrations/0001_init.sql</code> trên Supabase SQL Editor.
        </div>
      </CardContent>
    </Card>
  );
}
