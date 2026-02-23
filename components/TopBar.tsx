import { Badge } from "@/components/ui/Badge";

export function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-zinc-600">{subtitle}</p> : null}
        </div>
        <Badge>Supabase • Vercel</Badge>
      </div>
    </div>
  );
}
