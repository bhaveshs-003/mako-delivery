/**
 * Edge middleware: first line of route protection (spec §3.0).
 *
 * - Unauthenticated users are redirected to /login by withAuth.
 * - Deactivated tokens are bounced to /login immediately.
 * - Authenticated users hitting a page their role can't access (spec §3.1) are
 *   redirected to their dashboard with a ?denied flag (surfaced as a toast).
 *
 * This is defense-in-depth. API routes ALSO enforce roles server-side; the
 * middleware never substitutes for that.
 */
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { canAccessRoute } from "@/lib/permissions";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;

    if (token?.deactivated) {
      return NextResponse.redirect(new URL("/login?deactivated=1", req.url));
    }

    const role = token?.role;
    if (role && !canAccessRoute(role, pathname)) {
      const url = new URL("/dashboard", req.url);
      url.searchParams.set("denied", "1");
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token && !token.deactivated,
    },
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/projects/:path*",
    "/dependencies/:path*",
    "/tasks/:path*",
    "/approvals/:path*",
    "/tickets/:path*",
    "/reports/:path*",
    "/resources/:path*",
    "/settings/:path*",
    "/notifications/:path*",
  ],
};
