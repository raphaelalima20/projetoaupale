import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Only same-site relative paths are allowed as redirect targets (prevents open redirects). */
function safeNext(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  return next;
}

/** Completes e-mail links (password recovery): exchanges the code for a session, then redirects. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);

    if (data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (profile?.role === "admin") {
        return NextResponse.redirect(`${origin}${next ?? "/admin/dashboard"}`);
      }
      if (profile?.role === "collaborator") {
        return NextResponse.redirect(`${origin}/colaboradora/minha-agenda`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
