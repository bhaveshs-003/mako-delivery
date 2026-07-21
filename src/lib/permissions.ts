/**
 * Role-based access control (spec §3).
 *
 * CRITICAL: this is enforced SERVER-SIDE. Hiding a button is UX, not security.
 * Every API route calls `requireRole` / `can` and every list query applies
 * `projectScopeWhere` so a user physically cannot read or mutate data outside
 * their scope, even by crafting requests manually.
 */
import type { UserRole } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

// ── Page-level route access (spec §3.1 / §4.1) ──────────────────────────────
// Maps a top-level path segment to the roles allowed to load it.
export const ROUTE_ACCESS: Record<string, UserRole[]> = {
  dashboard: ["super_admin", "admin", "sub_admin", "rl_user", "resource"],
  projects: ["super_admin", "admin", "sub_admin", "rl_user"], // resource → /tasks
  dependencies: ["super_admin", "admin", "sub_admin", "rl_user"],
  tasks: ["super_admin", "admin", "resource"],
  approvals: ["super_admin", "admin", "sub_admin", "rl_user"],
  tickets: ["super_admin", "admin", "sub_admin", "rl_user", "resource"],
  reports: ["super_admin", "admin", "sub_admin", "rl_user"],
  resources: ["super_admin", "admin"],
  settings: ["super_admin"],
  notifications: ["super_admin", "admin", "sub_admin", "rl_user", "resource"],
};

export function canAccessRoute(role: UserRole, path: string): boolean {
  const segment = path.split("/").filter(Boolean)[0] ?? "dashboard";
  const allowed = ROUTE_ACCESS[segment];
  // Unlisted segments (e.g. nested detail pages) fall back to their parent's
  // access via the first segment; unknown segments default to authenticated.
  return allowed ? allowed.includes(role) : true;
}

// ── Action-level permissions (spec §3.1 matrix) ─────────────────────────────
// A curated set of the security-sensitive actions. `scoped` means "only within
// the user's assigned projects" — the caller must additionally apply scoping.
export type Action =
  | "project.create"
  | "project.archive"
  | "project.edit"
  | "project.assign"
  | "milestone.crud"
  | "dependency.log"
  | "dependency.markReceived"
  | "dependency.markFulfilled"
  | "approval.request"
  | "approval.decide"
  | "ticket.raise"
  | "ticket.respond"
  | "ticket.escalate"
  | "cr.raise"
  | "cr.decide"
  | "meeting.log"
  | "comment.add"
  | "comment.editOwn"
  | "report.export"
  | "resource.manage"
  | "org.settings"
  | "user.manage"
  | "hardDelete"
  | "auditLog.view";

type Access = "full" | "scoped" | "none";

const MATRIX: Record<Action, Record<UserRole, Access>> = {
  "project.create": { super_admin: "full", admin: "full", sub_admin: "none", rl_user: "none", resource: "none" },
  "project.archive": { super_admin: "full", admin: "full", sub_admin: "none", rl_user: "none", resource: "none" },
  "project.edit": { super_admin: "full", admin: "full", sub_admin: "scoped", rl_user: "none", resource: "none" },
  "project.assign": { super_admin: "full", admin: "full", sub_admin: "scoped", rl_user: "none", resource: "none" },
  "milestone.crud": { super_admin: "full", admin: "full", sub_admin: "scoped", rl_user: "none", resource: "none" },
  "dependency.log": { super_admin: "full", admin: "full", sub_admin: "scoped", rl_user: "none", resource: "none" },
  "dependency.markReceived": { super_admin: "full", admin: "full", sub_admin: "scoped", rl_user: "none", resource: "none" },
  "dependency.markFulfilled": { super_admin: "full", admin: "full", sub_admin: "none", rl_user: "scoped", resource: "none" },
  "approval.request": { super_admin: "full", admin: "full", sub_admin: "scoped", rl_user: "none", resource: "none" },
  "approval.decide": { super_admin: "none", admin: "none", sub_admin: "none", rl_user: "scoped", resource: "none" },
  "ticket.raise": { super_admin: "full", admin: "full", sub_admin: "scoped", rl_user: "none", resource: "scoped" },
  "ticket.respond": { super_admin: "none", admin: "none", sub_admin: "none", rl_user: "scoped", resource: "none" },
  "ticket.escalate": { super_admin: "full", admin: "full", sub_admin: "none", rl_user: "none", resource: "none" },
  "cr.raise": { super_admin: "full", admin: "full", sub_admin: "scoped", rl_user: "none", resource: "none" },
  "cr.decide": { super_admin: "none", admin: "none", sub_admin: "none", rl_user: "scoped", resource: "none" },
  "meeting.log": { super_admin: "full", admin: "full", sub_admin: "scoped", rl_user: "none", resource: "scoped" },
  "comment.add": { super_admin: "full", admin: "full", sub_admin: "scoped", rl_user: "scoped", resource: "scoped" },
  "comment.editOwn": { super_admin: "full", admin: "full", sub_admin: "full", rl_user: "full", resource: "full" },
  "report.export": { super_admin: "full", admin: "full", sub_admin: "none", rl_user: "none", resource: "none" },
  "resource.manage": { super_admin: "full", admin: "full", sub_admin: "none", rl_user: "none", resource: "none" },
  "org.settings": { super_admin: "full", admin: "none", sub_admin: "none", rl_user: "none", resource: "none" },
  "user.manage": { super_admin: "full", admin: "scoped", sub_admin: "none", rl_user: "none", resource: "none" },
  "hardDelete": { super_admin: "full", admin: "none", sub_admin: "none", rl_user: "none", resource: "none" },
  "auditLog.view": { super_admin: "full", admin: "none", sub_admin: "none", rl_user: "none", resource: "none" },
};

/** Returns the access level a role has for an action ("none" if forbidden). */
export function accessLevel(role: UserRole, action: Action): Access {
  return MATRIX[action][role];
}

/** True if the role may perform the action at all (full OR scoped). */
export function can(role: UserRole, action: Action): boolean {
  return MATRIX[action][role] !== "none";
}

/**
 * Prisma `where` fragment that scopes a Project query to what the user may see
 * (spec §3.2). Super Admin & Admin see everything; others are filtered.
 */
export function projectScopeWhere(user: SessionUser): Prisma.ProjectWhereInput {
  switch (user.role) {
    case "super_admin":
    case "admin":
      return {};
    case "sub_admin":
      return { projectLeadId: user.id };
    case "rl_user":
      return { rlConsultants: { some: { userId: user.id } } };
    case "resource":
      return { resources: { some: { userId: user.id } } };
    default:
      // Fail closed: unknown role sees nothing.
      return { id: "__none__" };
  }
}

/**
 * Whether a user can act on a specific project given its lead/consultant/
 * resource assignments (for scoped actions). Admins/Super Admins always can.
 */
export function canActOnProject(
  user: SessionUser,
  project: {
    projectLeadId: string | null;
    rlConsultants?: { userId: string }[];
    resources?: { userId: string }[];
  }
): boolean {
  if (user.role === "super_admin" || user.role === "admin") return true;
  if (user.role === "sub_admin") return project.projectLeadId === user.id;
  if (user.role === "rl_user")
    return !!project.rlConsultants?.some((c) => c.userId === user.id);
  if (user.role === "resource")
    return !!project.resources?.some((r) => r.userId === user.id);
  return false;
}
