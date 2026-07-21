import { requireUser, toAuditActor } from "@/lib/session";
import { can, canActOnProject } from "@/lib/permissions";
import { readJson, ok, badRequest, notFound, serverError } from "@/lib/api";
import { decideScopeSchema } from "@/lib/validations";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { buildFileKey, putObject } from "@/lib/storage";
import { daysBetween } from "@/lib/allocation";
import { addBusinessDaysTo } from "@/lib/business-days";
import { notify, notifyMany } from "@/lib/notifications";

const MAX_BYTES = 25 * 1024 * 1024;

// POST /api/projects/[id]/scope — PM uploads a document for RL approval. Two
// kinds: the initial `scope` understanding (which gates the project), or a
// `change_request` raised AFTER scope is approved. Both follow the same flow.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { rlConsultants: { select: { userId: true } }, resources: { select: { userId: true } } },
  });
  if (!project) return notFound("Project not found");
  if (!can(user.role, "milestone.crud") || !canActOnProject(user, project))
    return badRequest("You do not have permission to submit a document");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest("Expected multipart/form-data");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return badRequest("No file provided");
  if (file.size > MAX_BYTES) return badRequest("File exceeds 25MB limit");
  const note = (form.get("note") as string) || null;
  const title = (form.get("title") as string) || null;
  const kind = form.get("kind") === "change_request" ? "change_request" : "scope";
  const impactRaw = Number(form.get("timelineImpactDays"));
  const timelineImpactDays =
    kind === "change_request" && Number.isFinite(impactRaw) && impactRaw > 0
      ? Math.min(365, Math.round(impactRaw))
      : null;

  // A change request may propose a revised project timeline (applied on approval).
  const proposedDate = (name: string) => {
    if (kind !== "change_request") return null;
    const raw = form.get(name);
    if (typeof raw !== "string" || !raw.trim()) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const proposedRlStartDate = proposedDate("proposedRlStartDate");
  const proposedRlCommittedDeadline = proposedDate("proposedRlCommittedDeadline");
  const proposedMakoStartDate = proposedDate("proposedMakoStartDate");
  const proposedMakoInternalDeadline = proposedDate("proposedMakoInternalDeadline");
  const proposedIncludeWeekends =
    kind === "change_request" && form.has("proposedIncludeWeekends")
      ? form.get("proposedIncludeWeekends") === "true"
      : null;

  // Gating differs by kind:
  //  - scope: only while scope is NOT yet approved; one pending at a time.
  //  - change_request: only AFTER scope is approved; each is independent.
  if (kind === "scope") {
    if (project.scopeApproved)
      return badRequest("Scope is already approved — raise a change request to change scope");
    const pending = await prisma.scopeDocument.count({
      where: { projectId: project.id, kind: "scope", status: "pending" },
    });
    if (pending > 0) return badRequest("A scope document is already awaiting RL approval");
  } else {
    if (!project.scopeApproved)
      return badRequest("Approve the scope understanding before raising a change request");
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const key = buildFileKey(file.name);
    await putObject(key, bytes, file.type || "application/octet-stream");

    const doc = await prisma.$transaction(async (tx) => {
      const d = await tx.scopeDocument.create({
        data: {
          projectId: project.id,
          kind,
          title,
          timelineImpactDays,
          proposedRlStartDate,
          proposedRlCommittedDeadline,
          proposedMakoStartDate,
          proposedMakoInternalDeadline,
          proposedIncludeWeekends,
          filename: file.name,
          fileKey: key,
          fileSize: BigInt(file.size),
          mimeType: file.type || "application/octet-stream",
          note,
          status: "pending",
          submittedById: user.id,
        },
      });
      // Only a scope submission (re)opens the gate; change requests never do.
      if (kind === "scope") {
        await tx.project.update({ where: { id: project.id }, data: { scopeApproved: false } });
      }
      await writeAudit(
        { actor: toAuditActor(user, req), action: kind === "scope" ? "scope.submit" : "change_request.submit", entityType: "project", entityId: project.id, after: { scopeDocId: d.id, kind } },
        tx
      );
      return d;
    });

    const label = kind === "scope" ? "scope understanding" : "change request";
    await notifyMany(project.rlConsultants.map((c) => c.userId), {
      type: "approval_requested",
      title: `${kind === "scope" ? "Scope understanding" : "Change request"} submitted: ${project.title}`,
      body: `${user.name} uploaded a ${label} document for your approval.`,
      entityType: "project",
      entityId: project.id,
      projectId: project.id,
      deepLinkPath: `/projects/${project.id}?tab=scope`,
    });
    return ok({ id: doc.id });
  } catch (e) {
    return serverError(e);
  }
}

// PATCH /api/projects/[id]/scope — RL POC approves/rejects a specific document.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  const parsed = await readJson(req, decideScopeSchema);
  if ("response" in parsed) return parsed.response;
  const body = parsed.data;

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { rlConsultants: { select: { userId: true } }, resources: { select: { userId: true } } },
  });
  if (!project) return notFound("Project not found");
  if (!can(user.role, "approval.decide") || !canActOnProject(user, project))
    return badRequest("Only the assigned RL POC can decide this");

  const doc = await prisma.scopeDocument.findFirst({
    where: { id: body.scopeDocumentId, projectId: project.id },
  });
  if (!doc) return notFound("Document not found");
  if (doc.status !== "pending") return badRequest("This document has already been decided");
  if (doc.submittedById === user.id)
    return badRequest("You cannot decide your own submission");

  const approved = body.action === "approve";
  if (!approved && !body.decisionComment?.trim())
    return badRequest("A reason is required to reject");

  const isScope = doc.kind === "scope";

  // A change request may adjust the timeline on approval — either by proposing
  // explicit new date ranges, or (legacy) by extending the deadline N days.
  const hasProposedDates =
    !!doc.proposedRlStartDate || !!doc.proposedRlCommittedDeadline ||
    !!doc.proposedMakoStartDate || !!doc.proposedMakoInternalDeadline;
  const willAdjust =
    !isScope && approved && (hasProposedDates || (!!doc.timelineImpactDays && doc.timelineImpactDays > 0));

  try {
    const now = new Date();
    const { updated, newDeadline } = await prisma.$transaction(async (tx) => {
      const d = await tx.scopeDocument.update({
        where: { id: doc.id },
        data: {
          status: approved ? "approved" : "rejected",
          decidedById: user.id,
          decidedAt: now,
          decisionComment: body.decisionComment ?? null,
          approvalDurationDays: daysBetween(doc.submittedAt, now),
          timelineAdjusted: willAdjust,
        },
      });
      // Only a scope decision flips the gate; a change-request decision doesn't.
      if (isScope) {
        await tx.project.update({ where: { id: project.id }, data: { scopeApproved: approved } });
      }
      // Retain the CR timeline adjustment. Prefer the proposed date ranges;
      // fall back to the legacy N-business-day deadline extension.
      let deadline: Date | null = null;
      if (!isScope && approved && hasProposedDates) {
        await tx.project.update({
          where: { id: project.id },
          data: {
            rlStartDate: doc.proposedRlStartDate ?? undefined,
            rlCommittedDeadline: doc.proposedRlCommittedDeadline ?? undefined,
            makoStartDate: doc.proposedMakoStartDate ?? undefined,
            makoInternalDeadline: doc.proposedMakoInternalDeadline ?? undefined,
            includeWeekends: doc.proposedIncludeWeekends ?? undefined,
          },
        });
        deadline = doc.proposedMakoInternalDeadline ?? null;
      } else if (willAdjust) {
        const base = project.makoInternalDeadline ?? project.rlCommittedDeadline;
        if (base) {
          deadline = addBusinessDaysTo(base, doc.timelineImpactDays!);
          await tx.project.update({ where: { id: project.id }, data: { makoInternalDeadline: deadline } });
        }
      }
      await writeAudit(
        { actor: toAuditActor(user, req), action: `${isScope ? "scope" : "change_request"}.${approved ? "approve" : "reject"}`, entityType: "project", entityId: project.id, after: { status: d.status, newDeadline: deadline } },
        tx
      );
      return { updated: d, newDeadline: deadline };
    });

    const label = isScope ? "Scope" : "Change request";
    await notify({
      recipientId: doc.submittedById,
      type: "approval_decided",
      title: `${label} ${approved ? "approved" : "rejected"}: ${project.title}`,
      body: approved
        ? isScope
          ? `${user.name} approved the scope understanding. You can now build the milestone plan.`
          : `${user.name} approved the change request.${newDeadline ? ` Timeline extended to ${newDeadline.toDateString()}.` : ""}`
        : `${user.name} rejected: "${body.decisionComment}". You can submit a revised document.`,
      entityType: "project",
      entityId: project.id,
      projectId: project.id,
      deepLinkPath: `/projects/${project.id}?tab=scope`,
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}
