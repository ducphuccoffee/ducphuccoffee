import { TopBar } from "@/components/TopBar";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { SettingsTabs } from "@/components/settings/SettingsTabs";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  manager: "Quản lý",
  roastery_manager: "Quản lý xưởng",
  warehouse: "Kho",
  sales: "Sales",
  collaborator: "CTV",
  delivery: "Giao hàng",
};

export default async function Page() {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;

  if (!uid) {
    return (
      <div>
        <TopBar title="Cài đặt" subtitle="Vai trò • Quyền xem lợi nhuận" />
        <div className="p-4 text-sm text-red-500">Chưa đăng nhập</div>
      </div>
    );
  }

  const [profileRes, memberRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    supabase.from("org_members").select("role, is_active, org_id").eq("user_id", uid).eq("is_active", true).maybeSingle(),
  ]);
  const p = (profileRes as any).data as Profile | null;
  const memberRole = (memberRes as any).data?.role as string | undefined;
  const canManage = memberRole === "admin" || memberRole === "manager";

  return (
    <div className="space-y-4">
      <TopBar title="Cài đặt" subtitle="Tài khoản • Doanh nghiệp • CRM • KPI • Hoa hồng" />

      <div className="px-4 space-y-4">
        <div className="bg-white rounded-xl border p-4 text-sm text-zinc-700">
          <div><b>Email:</b> {auth?.user?.email ?? "—"}</div>
          <div>
            <b>Vai trò: </b>
            <span className="inline-block px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs">
              {memberRole ? (ROLE_LABEL[memberRole] ?? memberRole) : "—"}
            </span>
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            Xem lợi nhuận/giá vốn: {p?.can_view_profit ? "Có" : "Không"}
          </div>
        </div>

        <SettingsTabs
          canManage={canManage}
          currentUserId={uid}
          initialFullName={p?.full_name ?? null}
        />
      </div>
    </div>
  );
}
