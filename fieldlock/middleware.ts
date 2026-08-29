import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Public routes
  if (pathname === "/" || pathname === "/login") {
    if (session?.user) {
      return NextResponse.redirect(
        new URL(session.user.role === "ADMIN" ? "/admin" : "/dashboard", req.url)
      );
    }
    return NextResponse.next();
  }

  // Protected routes — require auth
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Admin-only routes
  if (pathname.startsWith("/admin") && session.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|images).*)"],
};
