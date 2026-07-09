/**
 * Server-side session helpers. Every API route and server component that needs
 * the current user goes through here so authorization is consistent and never
 * trusts client-supplied identity.
 */
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import { authOptions } from "./auth";
import type { SessionUser } from "./permissions";
import type { AuditActor } from "./audit";

/** Returns the authenticated user, or null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? "",
    role: session.user.role,
  };
}

/** Thrown-style guard for API routes: returns the user or a 401 NextResponse. */
export async function requireUser(): Promise<
  { user: SessionUser } | { response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { user };
}

/** Guard that also enforces a role allow-list. Returns user or 401/403. */
export async function requireRole(
  allowed: UserRole[]
): Promise<{ user: SessionUser } | { response: NextResponse }> {
  const result = await requireUser();
  if ("response" in result) return result;
  if (!allowed.includes(result.user.role)) {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return result;
}

/** Build an AuditActor from the session for audit-log writes. */
export function toAuditActor(
  user: SessionUser,
  req?: Request
): AuditActor {
  const ip =
    req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req?.headers.get("x-real-ip") ??
    null;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    ip,
    sessionId: null,
  };
}
