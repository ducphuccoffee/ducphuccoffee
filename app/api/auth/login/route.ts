import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const INTERNAL_DOMAIN = "ducphuccoffee.local";

function safeNextPath(v: unknown) {
  const s = typeof v === "string" ? v : "";
  // chặn open-redirect, chỉ cho path nội bộ
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  return "/dashboard";
}

// Cho phép đăng nhập bằng username/SĐT hoặc email.
// Nếu input không có '@' thì coi là username và ghép với domain nội bộ.
function resolveEmail(input: string): string {
  const v = (input || "").trim();
  if (!v) return "";
  if (v.includes("@")) return v.toLowerCase();
  return `${v.toLowerCase()}@${INTERNAL_DOMAIN}`;
}

export async function POST(request: Request) {
  // Hỗ trợ cả JSON và form submit
  const ct = request.headers.get("content-type") || "";
  let identifier = "";
  let password = "";
  let next = "/dashboard";

  if (ct.includes("application/json")) {
    const body = (await request.json()) as any;
    identifier = body?.username || body?.email || "";
    password = body?.password || "";
    next = safeNextPath(body?.next);
  } else {
    const fd = await request.formData();
    identifier = String(fd.get("username") || fd.get("email") || "");
    password = String(fd.get("password") || "");
    next = safeNextPath(fd.get("next"));
  }

  const email = resolveEmail(identifier);

  // Response redirect (để browser không bị đứng ở /api/auth/login)
  const url = new URL(next, request.url);
  const response = NextResponse.redirect(url, { status: 303 });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookie = request.headers.get("cookie") || "";
          const match = cookie.split("; ").find((c) => c.startsWith(name + "="));
          return match ? match.split("=").slice(1).join("=") : undefined;
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // login fail => quay về /login và kèm lỗi
    const back = new URL(`/login?err=${encodeURIComponent(error.message)}`, request.url);
    return NextResponse.redirect(back, { status: 303 });
  }

  return response;
}