import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { response, user, supabase } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isAdminRoute = pathname.startsWith("/admin");
  const isCollabRoute = pathname.startsWith("/colaboradora");
  const isLoginRoute = pathname === "/login";

  if (!user && (isAdminRoute || isCollabRoute)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && (isAdminRoute || isCollabRoute || isLoginRoute)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (isLoginRoute) {
      if (profile?.role === "admin") {
        return NextResponse.redirect(new URL("/admin/dashboard", request.url));
      }
      if (profile?.role === "collaborator") {
        return NextResponse.redirect(new URL("/colaboradora/minha-agenda", request.url));
      }
    }

    if (isAdminRoute && profile?.role !== "admin") {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if (isCollabRoute && profile?.role !== "collaborator") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
