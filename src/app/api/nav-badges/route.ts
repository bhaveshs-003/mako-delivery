import { requireUser } from "@/lib/session";
import { ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { projectScopeWhere } from "@/lib/permissions";

// GET /api/nav-badges — per-section counts for the sidebar notification dots,
// scoped to what the current user can see/act on. Keyed by nav href.
export async function GET() {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  const scope = projectScopeWhere(user);
  const isOrgWide = user.role === "super_admin" || user.role === "admin";

  const [unread, apprReq, scopeDocs, plans, tickets, tasks] = await Promise.all([
    prisma.notification.count({ where: { recipientId: user.id, isRead: false } }),
    prisma.approvalRequest.count({ where: { status: "pending", project: scope } }),
    prisma.scopeDocument.count({ where: { status: "pending", project: scope } }),
    prisma.project.count({ where: { milestonePlanStatus: "pending_approval", ...scope } }),
    prisma.ticket.count({
      where: {
        status: { notIn: ["closed", "resolved"] },
        ...(isOrgWide ? {} : { projectLinks: { some: { project: scope } } }),
      },
    }),
    prisma.subtask.count({ where: { assignedToId: user.id, status: { not: "done" } } }),
  ]);

  const badges: Record<string, number> = {
    "/notifications": unread,
    "/approvals": apprReq + scopeDocs + plans,
    "/tickets": tickets,
    "/tasks": tasks,
  };
  return ok({ badges });
}

export const dynamic = "force-dynamic";
