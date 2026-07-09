/**
 * Cross-cutting constants: the SACRED attribution palette, human labels, and
 * role-based navigation. The 4 attribution colors (spec §6.1 rule 2) must be
 * byte-identical in every chart, badge, legend, and export.
 */
import type { UserRole } from "@prisma/client";

// ── Attribution palette — used EVERYWHERE a delay owner is shown ────────────
export const ATTRIBUTION_COLORS = {
  mako: "#3A5A78", // steel blue
  rl: "#7C3AED", // purple
  client_via_rl: "#0891B2", // teal
  product_bug: "#DC2626", // red
  other: "#5B6774", // slate (fallback)
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

export const STATUS_LABELS: Record<string, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  paused: "Paused",
  completed: "Completed",
  delivered: "Delivered",
  archived: "Archived",
  yet_to_start: "Yet to Start",
  ongoing: "Ongoing",
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
