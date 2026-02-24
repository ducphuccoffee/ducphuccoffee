import { TopBar } from "@/components/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export default async function Page() {
  const supabase = createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;

  const profileRes = uid ? await supabase.from("profiles").select("*").eq("id", uid).single() : { data: null, error: null };
  const p = (profileRes as any).data as Profile | null;

  return (
    <div>
      <TopBar title="Cài đặt" subtitle="Vai trò • Quyền xem giá vốn/lợi nhuận • Hoa hồng" />
      <Card>
        <CardHeader><CardTitle>Tài khoản</CardTitle></CardHeader>
        <CardContent className="text-sm text-zinc-700 space-y-2">
          <div><b>User ID:</b> {uid || "-"}</div>
          <div><b>Role:</b> {p?.role || "-"}</div>
          <div><b>Cho xem lợi nhuận/cost:</b> {p?.can_view_profit ? "Có" : "Không"}</div>
          <div className="text-xs text-zinc-500">
            Gợi ý: admin có thể bật/tắt quyền xem lợi nhuận cho quản lý xưởng trong bảng <code className="rounded bg-zinc-100 px-1">profiles.can_view_profit</code>.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
