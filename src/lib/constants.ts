/**
 * Cross-cutting constants: the SACRED attribution palette, human labels, and
 * role-based navigation. The 4 attribution colors (spec §6.1 rule 2) must be
 * byte-identical in every chart, badge, legend, and export.
 */
import type { UserRole } from "@prisma/client";

// ── Attribution palette — used EVERYWHERE a delay owner is shown ────────────
// Validated CVD-safe (dataviz palette check, light + dark). RL is orange, not
// purple: blue+purple collapses under red-blindness — orange stays distinct.
export const ATTRIBUTION_COLORS = {
  mako: "#2a78d6", // blue
  rl: "#eb6834", // orange
  client_via_rl: "#1baf7a", // teal
  product_bug: "#e34948", // red
  other: "#8a93a2", // muted gray (fallback)
} as const;

// Dark-mode steps of the same hues (for future dark theme / charts on dark).
export const ATTRIBUTION_COLORS_DARK = {
  mako: "#3987e5",
  rl: "#d95926",
  client_via_rl: "#199e70",
  product_bug: "#e66767",
  other: "#8a93a2",
} as const;

export const ATTRIBUTION_LABELS: Record<string, string> = {
  mako: "Mako",
  rl: "Rocketlane",
  client_via_rl: "Client-via-RL",
  product_bug: "Product Bug",
  other: "Other",
};

// ── Human-readable labels for enum values ───────────────────────────────────
export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  sub_admin: "Sub-admin",
  rl_user: "RL User",
  resource: "Resource",
};

export const PROJECT_TYPE_LABELS: Record<string, string> = {
  migration: "Migration",
  integration: "Integration",
  custom_app: "Custom App",
};

export const MILESTONE_TYPE_LABELS: Record<string, string> = {
  main_scope: "Main Scope",
  change_request: "Change Request",
  delta_scope: "Delta Scope",
};

export const STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  paused: "Paused",
  completed: "Completed",
  delivered: "Delivered",
  archived: "Archived",
  yet_to_start: "Upcoming",
  ongoing: "In Progress",
  submitted: "Submitted",
  revision_requested: "Revision Requested",
  awaiting: "Awaiting",
  received: "Received",
  overdue: "Overdue",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  not_required: "Not Required",
  open: "Open",
  in_review: "In Review",
  resolved: "Resolved",
  workaround_applied: "Workaround Applied",
  closed: "Closed",
  blocked: "Blocked",
  done: "Done",
  in_progress_subtask: "In Progress",
  draft: "Draft",
  superseded: "Superseded",
  pending_rl_approval: "Pending RL Approval",
  late: "Late",
  on_time: "On Time",
  at_risk: "At Risk",
  on_track: "On Track",
  delayed: "Delayed",
};

// ── Role-based sidebar navigation (spec §4.1) ───────────────────────────────
export type NavItem = { label: string; href: string; icon: string };

export const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  super_admin: [
    { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
    { label: "Projects", href: "/projects", icon: "FolderKanban" },
    { label: "Tickets", href: "/tickets", icon: "Ticket" },
    { label: "Reports", href: "/reports", icon: "BarChart3" },
    { label: "Resource Mgmt", href: "/resources", icon: "Users" },
    { label: "Org Settings", href: "/settings", icon: "Settings" },
    { label: "Notifications", href: "/notifications", icon: "Bell" },
  ],
  admin: [
    { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
    { label: "Projects", href: "/projects", icon: "FolderKanban" },
    { label: "Tickets", href: "/tickets", icon: "Ticket" },
    { label: "Reports", href: "/reports", icon: "BarChart3" },
    { label: "Resource Mgmt", href: "/resources", icon: "Users" },
    { label: "Notifications", href: "/notifications", icon: "Bell" },
  ],
  sub_admin: [
    { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
    { label: "My Projects", href: "/projects", icon: "FolderKanban" },
    { label: "Tickets", href: "/tickets", icon: "Ticket" },
    { label: "Notifications", href: "/notifications", icon: "Bell" },
  ],
  rl_user: [
    { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
    { label: "My Projects", href: "/projects", icon: "FolderKanban" },
    { label: "Pending Approvals", href: "/approvals", icon: "CheckSquare" },
    { label: "Tickets", href: "/tickets", icon: "Ticket" },
    { label: "Reports", href: "/reports", icon: "BarChart3" },
    { label: "Notifications", href: "/notifications", icon: "Bell" },
  ],
  resource: [
    { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
    { label: "My Tasks", href: "/tasks", icon: "ClipboardList" },
    { label: "Notifications", href: "/notifications", icon: "Bell" },
  ],
};
