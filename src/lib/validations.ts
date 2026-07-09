/**
 * Shared Zod schemas for API request validation. Grows per phase.
 */
import { z } from "zod";

const uuid = z.string().uuid();

// ── Projects (Phase 2) ──────────────────────────────────────────────────────
export const createProjectSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(5000).optional().or(z.literal("")),
  type: z.enum(["migration", "integration", "custom_app"]),
  rlCommittedDeadline: z.coerce.date(),
  makoInternalDeadline: z.coerce.date().optional().nullable(),
  rlProjectId: z.string().max(255).optional().or(z.literal("")),
  projectLeadId: uuid.optional().nullable(),
  rlConsultantIds: z.array(uuid).default([]),
  resourceIds: z.array(uuid).default([]),
  loadMilestonesFromTemplate: z.boolean().default(true),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const patchProjectSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("archive") }),
  z.object({ action: z.literal("unarchive") }),
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("complete") }),
  z.object({
    action: z.literal("pause"),
    reasonCategory: z.enum(["mako", "rl", "client_via_rl", "product_bug", "other"]),
    reasonComment: z.string().min(1, "A comment is required to pause"),
  }),
  z.object({ action: z.literal("resume") }),
  z.object({
    action: z.literal("edit"),
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(5000).optional(),
    makoInternalDeadline: z.coerce.date().optional().nullable(),
    projectLeadId: uuid.optional().nullable(),
  }),
  z.object({
    action: z.literal("assign"),
    rlConsultantIds: z.array(uuid).optional(),
    resourceIds: z.array(uuid).optional(),
  }),
]);

// ── Users (Phase 2) ─────────────────────────────────────────────────────────
export const createUserSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  role: z.enum(["super_admin", "admin", "sub_admin", "rl_user", "resource"]),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const patchUserSchema = z.object({
  action: z.enum(["deactivate", "reactivate", "edit"]),
  name: z.string().min(1).max(255).optional(),
  role: z
    .enum(["super_admin", "admin", "sub_admin", "rl_user", "resource"])
    .optional(),
});

// ── Dependencies (Phase 3) ──────────────────────────────────────────────────
export const createDependencySchema = z.object({
  projectId: uuid,
  milestoneId: uuid.optional().nullable(),
  type: z.enum(["credential", "source_sheet", "approval", "clarification", "confirmation", "other"]),
  description: z.string().min(1, "Description is required").max(2000),
  requestedFromParty: z.enum(["mako", "rl", "client_via_rl"]),
  dateRequested: z.coerce.date(),
  slaThresholdDays: z.number().int().min(0).max(365),
});

export const markDependencySchema = z.object({
  action: z.enum(["receive", "fulfill"]),
  dateReceived: z.coerce.date(),
  // Required by the API only when the dependency is SLA-breached (spec §2.5).
  rootCauseCategory: z.enum(["mako", "rl", "client_via_rl", "product_bug"]).optional(),
  rootCauseComment: z.string().max(2000).optional(),
});

// ── Milestones & subtasks (Phase 3) ─────────────────────────────────────────
export const createMilestoneSchema = z.object({
  projectId: uuid,
  name: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  parentStage: z.string().max(255).optional(),
  ownerId: uuid.optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
});

export const patchMilestoneSchema = z.object({
  action: z.enum(["edit", "status"]),
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  ownerId: uuid.optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  status: z
    .enum(["yet_to_start", "ongoing", "submitted", "revision_requested", "completed"])
    .optional(),
});

export const createSubtaskSchema = z.object({
  milestoneId: uuid,
  title: z.string().min(1).max(500),
  assignedToId: uuid.optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
});

export const patchSubtaskSchema = z
  .object({
    status: z.enum(["not_started", "in_progress", "blocked", "done"]),
    blockedReason: z.string().max(2000).optional(),
  })
  .refine((d) => d.status !== "blocked" || (d.blockedReason && d.blockedReason.trim().length > 0), {
    message: "A reason is required when marking a subtask blocked",
    path: ["blockedReason"],
  });

// ── Approvals (Phase 4) ─────────────────────────────────────────────────────
export const createApprovalSchema = z.object({
  projectId: uuid,
  milestoneId: uuid,
  requestComment: z.string().min(1, "A request comment is required").max(2000),
});

export const decideApprovalSchema = z.object({
  action: z.enum(["approve", "reject", "escalate"]),
  // Mandatory on approve/reject (spec §2.7); optional on escalate.
  decisionComment: z.string().max(2000).optional(),
});

// ── Tickets (Phase 4) ───────────────────────────────────────────────────────
export const createTicketSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().min(1).max(5000),
  type: z.enum(["product_bug", "api_change", "escalation", "clarification", "dependency", "requisites"]),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  projectIds: z.array(uuid).min(1, "A ticket must link to at least one project"),
  assignedToId: uuid.optional().nullable(),
});

export const patchTicketSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("respond"),
    status: z.enum(["in_review", "resolved", "workaround_applied"]),
    comment: z.string().min(1, "A comment is required when responding").max(2000),
  }),
  z.object({ action: z.literal("escalate"), comment: z.string().max(2000).optional() }),
  z.object({ action: z.literal("close"), comment: z.string().max(2000).optional() }),
]);

// ── Change Requests (Phase 5) ───────────────────────────────────────────────
export const createChangeRequestSchema = z.object({
  projectId: uuid,
  scopeDelta: z.string().min(1).max(5000),
  timelineImpactDays: z.number().int().min(0).max(365).optional().nullable(),
  effortImpactDescription: z.string().max(2000).optional(),
});

export const decideChangeRequestSchema = z.object({
  action: z.enum(["approve", "reject"]),
  decisionComment: z.string().min(1, "A decision comment is required").max(2000),
});

// ── Meetings & MoM (Phase 5) ────────────────────────────────────────────────
export const createMeetingSchema = z.object({
  projectId: uuid,
  title: z.string().min(1).max(500),
  meetingDate: z.coerce.date(),
  meetingLink: z.string().max(1000).optional(),
  milestoneId: uuid.optional().nullable(),
  attendeeIds: z.array(uuid).default([]),
});

export const submitMomSchema = z.object({
  content: z.string().min(1, "MoM content is required"),
  lateReasonCategory: z.enum(["genuine_miss", "rl_delay_compressed_timeline", "other"]).optional(),
  lateReasonComment: z.string().max(2000).optional(),
});

// ── Comments (Phase 5) ──────────────────────────────────────────────────────
export const createCommentSchema = z.object({
  content: z.string().min(1).max(10000),
  parentCommentId: uuid.optional().nullable(),
  // exactly one parent entity
  projectId: uuid.optional(),
  milestoneId: uuid.optional(),
  ticketId: uuid.optional(),
  changeRequestId: uuid.optional(),
  approvalRequestId: uuid.optional(),
  meetingId: uuid.optional(),
});

export const editCommentSchema = z.object({
  content: z.string().min(1).max(10000),
});

// ── SLA config (Phase 2) ────────────────────────────────────────────────────
export const upsertSlaSchema = z.object({
  dependencyType: z.enum([
    "credential",
    "source_sheet",
    "approval",
    "clarification",
    "confirmation",
    "other",
  ]),
  thresholdDays: z.number().int().min(0).max(365),
  approvalSlaDays: z.number().int().min(0).max(365),
});
