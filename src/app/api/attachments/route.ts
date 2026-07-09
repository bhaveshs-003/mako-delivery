import { requireUser, toAuditActor } from "@/lib/session";
import { ok, badRequest, serverError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { buildFileKey, putObject } from "@/lib/storage";
import { canAccessParent, type ParentRef } from "@/lib/comment-scope";

const MAX_BYTES = 25 * 1024 * 1024; // 25MB (spec §5.3.9)
const ALLOWED = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "image/png",
  "image/jpeg",
  "text/plain",
  "application/zip",
  "application/octet-stream",
];

// POST /api/attachments — multipart upload (file + parent ref). Stores to S3
// (or local fallback) and records the attachment row.
export async function POST(req: Request) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest("Expected multipart/form-data");
  }

  const file = form.get("file");
  if (!(file instanceof File)) return badRequest("No file provided");
  if (file.size > MAX_BYTES) return badRequest("File exceeds 25MB limit");
  if (file.type && !ALLOWED.includes(file.type))
    return badRequest(`Unsupported file type: ${file.type}`);

  const ref: ParentRef = {
    projectId: (form.get("projectId") as string) || undefined,
    milestoneId: (form.get("milestoneId") as string) || undefined,
    ticketId: (form.get("ticketId") as string) || undefined,
    changeRequestId: (form.get("changeRequestId") as string) || undefined,
    approvalRequestId: (form.get("approvalRequestId") as string) || undefined,
    meetingId: (form.get("meetingId") as string) || undefined,
  };
  if (!ref.projectId && !ref.milestoneId && !ref.ticketId && !ref.changeRequestId && !ref.approvalRequestId && !ref.meetingId)
    return badRequest("A parent entity is required");
  if (!(await canAccessParent(user, ref)))
    return badRequest("You do not have access to that item");

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const key = buildFileKey(file.name);
    await putObject(key, bytes, file.type || "application/octet-stream");

    const attachment = await prisma.$transaction(async (tx) => {
      const a = await tx.attachment.create({
        data: {
          ...ref,
          filename: file.name,
          fileKey: key,
          fileSize: BigInt(file.size),
          mimeType: file.type || "application/octet-stream",
          uploadedById: user.id,
        },
      });
      await writeAudit(
        { actor: toAuditActor(user, req), action: "attachment.upload", entityType: "attachment", entityId: a.id, after: { filename: a.filename, size: file.size } },
        tx
      );
      return a;
    });

    return ok({ id: attachment.id, filename: attachment.filename }, 201);
  } catch (e) {
    return serverError(e);
  }
}
