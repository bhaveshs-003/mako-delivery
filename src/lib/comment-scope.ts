/**
 * Resolve the owning project(s) of a polymorphic comment/attachment parent and
 * confirm the user may access it. Comments are visible to anyone who can see
 * the parent entity; this centralises that check.
 */
import { prisma } from "./db";
import { projectScopeWhere, type SessionUser } from "./permissions";

export type ParentRef = {
  projectId?: string;
  milestoneId?: string;
  ticketId?: string;
  changeRequestId?: string;
  approvalRequestId?: string;
  meetingId?: string;
};

/** Exactly one parent id must be set. Returns the key/id or null. */
export function singleParent(ref: ParentRef): { key: keyof ParentRef; id: string } | null {
  const entries = Object.entries(ref).filter(([, v]) => !!v) as [keyof ParentRef, string][];
  if (entries.length !== 1) return null;
  return { key: entries[0][0], id: entries[0][1] };
}

/** Returns true if the user can access the parent entity (via its project). */
export async function canAccessParent(user: SessionUser, ref: ParentRef): Promise<boolean> {
  const scope = projectScopeWhere(user);

  // Resolve to a set of candidate project ids.
  let projectIds: string[] = [];
  if (ref.projectId) projectIds = [ref.projectId];
  else if (ref.milestoneId) {
    const m = await prisma.milestone.findUnique({ where: { id: ref.milestoneId }, select: { projectId: true } });
    if (m) projectIds = [m.projectId];
  } else if (ref.changeRequestId) {
    const c = await prisma.changeRequest.findUnique({ where: { id: ref.changeRequestId }, select: { projectId: true } });
    if (c) projectIds = [c.projectId];
  } else if (ref.approvalRequestId) {
    const a = await prisma.approvalRequest.findUnique({ where: { id: ref.approvalRequestId }, select: { projectId: true } });
    if (a) projectIds = [a.projectId];
  } else if (ref.meetingId) {
    const mt = await prisma.meeting.findUnique({ where: { id: ref.meetingId }, select: { projectId: true } });
    if (mt) projectIds = [mt.projectId];
  } else if (ref.ticketId) {
    const links = await prisma.ticketProject.findMany({ where: { ticketId: ref.ticketId }, select: { projectId: true } });
    projectIds = links.map((l) => l.projectId);
  }

  if (projectIds.length === 0) return false;
  const count = await prisma.project.count({ where: { AND: [{ id: { in: projectIds } }, scope] } });
  return count > 0;
}
