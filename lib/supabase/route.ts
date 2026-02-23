import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function getCookieFromHeader(cookieHeader: string | null, name: string) {
  const cookie = cookieHeader || "";
  const match = cookie.split("; ").find((c) => c.startsWith(name + "="));
  return match ? match.split("=").slice(1).join("=") : undefined;
}

export function createRouteSupabase(request: Request, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return getCookieFromHeader(request.headers.get("cookie"), name);
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
}
