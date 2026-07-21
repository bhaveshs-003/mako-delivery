import { requireUser, toAuditActor } from "@/lib/session";
import { can, canActOnProject } from "@/lib/permissions";
import { ok, badRequest, notFound, serverError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { calcBurnDays } from "@/lib/business-days";
import { buildFileKey, putObject } from "@/lib/storage";
import { notifyMany } from "@/lib/notifications";

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = [".xlsx", ".docx", ".pdf", ".txt"];

// POST /api/dependencies/[id]/fulfil — mark a dependency received/fulfilled,
// optionally attaching a document + note (the RL "send" provision). Multipart.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  const dep = await prisma.dependency.findUnique({
    where: { id: params.id },
    include: {
      project: { include: { rlConsultants: { select: { userId: true } }, resources: { select: { userId: true } } } },
    },
  });
  if (!dep) return notFound("Dependency not found");
  if (dep.status === "received") return badRequest("Dependency already fulfilled");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest("Expected multipart/form-data");
  }
  const action = form.get("action") === "fulfill" ? "fulfill" : "receive";

  if (action === "fulfill") {
    if (!can(user.role, "dependency.markFulfilled")) return badRequest("Only RL users can fulfil dependencies");
    if (dep.requestedFromParty !== "rl") return badRequest("Only RL-requested dependencies can be fulfilled by RL");
    if (!canActOnProject(user, dep.project)) return badRequest("You are not assigned to this project");
  } else {
    if (!can(user.role, "dependency.markReceived") || !canActOnProject(user, dep.project))
      return badRequest("You do not have permission to mark this dependency received");
  }

  const dateReceived = new Date(String(form.get("dateReceived")));
  if (Number.isNaN(dateReceived.getTime())) return badRequest("A valid received date is required");
  const comment = (form.get("comment") as string)?.trim() || null;
  const rootCauseCategory = (form.get("rootCauseCategory") as string) || null;
  const rootCauseComment = (form.get("rootCauseComment") as string)?.trim() || null;

  const burnDays = calcBurnDays(dep.dateRequested, dateReceived);
  const slaBreached = burnDays > dep.slaThresholdDays;
  if (slaBreached && (!rootCauseCategory || !rootCauseComment))
    return badRequest("This dependency breached its SLA — a root-cause category and comment are required");

  // Optional document.
  let docKey: string | null = null;
  let docName: string | null = null;
  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) return badRequest("File exceeds 25MB limit");
    if (!ALLOWED.some((ext) => file.name.toLowerCase().endsWith(ext)))
      return badRequest("Allowed file types: .xlsx, .docx, .pdf, .txt");
    docName = file.name;
    docKey = buildFileKey(file.name);
    await putObject(docKey, Buffer.from(await file.arrayBuffer()), file.type || "application/octet-stream");
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const d = await tx.dependency.update({
        where: { id: dep.id },
        data: {
          status: "received",
          dateReceived,
          burnDays,
          slaBreached,
          rootCauseCategory: slaBreached ? (rootCauseCategory as never) : null,
          rootCauseComment: slaBreached ? rootCauseComment : null,
          fulfillmentComment: comment,
          fulfillmentDocKey: docKey,
          fulfillmentDocName: docName,
          fulfilledBy: user.id,
          fulfilledAt: new Date(),
        },
      });
      await writeAudit(
        {
          actor: toAuditActor(user, req),
          action: slaBreached ? "dependency.received_breached" : "dependency.received",
          entityType: "dependency",
          entityId: d.id,
          before: { status: dep.status },
          after: { status: "received", burnDays, slaBreached, doc: docName },
          metadata: { projectId: dep.projectId },
        },
        tx
      );
      return d;
    });

    if (slaBreached && dep.project.projectLeadId) {
      await notifyMany([dep.project.projectLeadId], {
        type: "dependency_sla_breach",
        title: `Dependency SLA breach on ${dep.project.title}`,
        body: `A ${dep.type.replace(/_/g, " ")} dependency took ${burnDays} business days (SLA ${dep.slaThresholdDays}).`,
        entityType: "dependency",
        entityId: dep.id,
        projectId: dep.projectId,
        deepLinkPath: `/projects/${dep.projectId}?tab=dependencies`,
      });
    }

    // Tell the requester their dependency has been fulfilled (RL "sent" it).
    if (action === "fulfill") {
      const recipients = Array.from(
        new Set([dep.createdBy, ...(dep.project.projectLeadId ? [dep.project.projectLeadId] : [])])
      ).filter((id) => id !== user.id);
      if (recipients.length) {
        await notifyMany(recipients, {
          type: "dependency_fulfilled",
          title: `Dependency sent on ${dep.project.title}`,
          body: `${user.name} fulfilled a ${dep.type.replace(/_/g, " ")} dependency${docName ? ` and attached ${docName}` : ""}.`,
          entityType: "dependency",
          entityId: dep.id,
          projectId: dep.projectId,
          deepLinkPath: `/projects/${dep.projectId}?tab=dependencies`,
        });
      }
    }
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}
