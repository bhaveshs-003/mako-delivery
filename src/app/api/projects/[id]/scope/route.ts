import { requireUser, toAuditActor } from "@/lib/session";
import { can, canActOnProject } from "@/lib/permissions";
import { readJson, ok, badRequest, notFound, serverError } from "@/lib/api";
import { decideScopeSchema } from "@/lib/validations";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { buildFileKey, putObject } from "@/lib/storage";
import { daysBetween } from "@/lib/allocation";
import { notify, notifyMany } from "@/lib/notifications";

const MAX_BYTES = 25 * 1024 * 1024;

// POST /api/projects/[id]/scope — PM uploads a Scope Understanding document.
// Supersedes any prior doc and (re)opens the approval gate as pending.
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
    return badRequest("You do not have permission to submit a scope document");

  // Block a new submission while one is already awaiting a decision.
  const pending = await prisma.scopeDocument.count({
    where: { projectId: project.id, status: "pending" },
  });
  if (pending > 0)
    return badRequest("A scope document is already awaiting RL approval");

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

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const key = buildFileKey(file.name);
    await putObject(key, bytes, file.type || "application/octet-stream");

    const doc = await prisma.$transaction(async (tx) => {
      // Any earlier non-superseded docs become superseded by this new one.
      await tx.scopeDocument.updateMany({
        where: { projectId: project.id, status: { not: "superseded" } },
        data: { status: "superseded" },
      });
      const d = await tx.scopeDocument.create({
        data: {
          projectId: project.id,
          filename: file.name,
          fileKey: key,
          fileSize: BigInt(file.size),
          mimeType: file.type || "application/octet-stream",
          note,
          status: "pending",
          submittedById: user.id,
        },
      });
      // A fresh pending doc means scope is no longer approved.
      await tx.project.update({ where: { id: project.id }, data: { scopeApproved: false } });
      await writeAudit(
        { actor: toAuditActor(user, req), action: "scope.submit", entityType: "project", entityId: project.id, after: { scopeDocId: d.id } },
        tx
      );
      return d;
    });

    await notifyMany(project.rlConsultants.map((c) => c.userId), {
      type: "approval_requested",
      title: `Scope understanding submitted: ${project.title}`,
      body: `${user.name} uploaded a scope understanding document for your approval.`,
      entityType: "project",
      entityId: project.id,
      projectId: project.id,
      deepLinkPath: `/projects/${project.id}?tab=overview`,
    });
    return ok({ id: doc.id });
  } catch (e) {
    return serverError(e);
  }
}

// PATCH /api/projects/[id]/scope — RL POC approves/rejects the pending scope doc.
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
    return badRequest("Only the assigned RL POC can decide the scope");

  const doc = await prisma.scopeDocument.findFirst({
    where: { projectId: project.id, status: "pending" },
    orderBy: { submittedAt: "desc" },
  });
  if (!doc) return badRequest("There is no scope document awaiting a decision");
  if (doc.submittedById === user.id)
    return badRequest("You cannot decide your own submission");

  const approved = body.action === "approve";
  if (!approved && !body.decisionComment?.trim())
    return badRequest("A reason is required to reject the scope");

  try {
    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const d = await tx.scopeDocument.update({
        where: { id: doc.id },
        data: {
          status: approved ? "approved" : "rejected",
          decidedById: user.id,
          decidedAt: now,
          decisionComment: body.decisionComment ?? null,
          approvalDurationDays: daysBetween(doc.submittedAt, now),
        },
      });
      await tx.project.update({
        where: { id: project.id },
        data: { scopeApproved: approved },
      });
      await writeAudit(
        { actor: toAuditActor(user, req), action: approved ? "scope.approve" : "scope.reject", entityType: "project", entityId: project.id, after: { status: d.status } },
        tx
      );
      return d;
    });

    await notify({
      recipientId: doc.submittedById,
      type: "approval_decided",
      title: `Scope ${approved ? "approved" : "rejected"}: ${project.title}`,
      body: approved
        ? `${user.name} approved the scope understanding. You can now build the milestone plan.`
        : `${user.name} rejected the scope: "${body.decisionComment}". Upload a revised document.`,
      entityType: "project",
      entityId: project.id,
      projectId: project.id,
      deepLinkPath: `/projects/${project.id}?tab=overview`,
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}
