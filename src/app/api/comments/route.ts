import { requireUser, toAuditActor } from "@/lib/session";
import { readJson, ok, badRequest, serverError } from "@/lib/api";
import { createCommentSchema } from "@/lib/validations";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { canAccessParent, singleParent, type ParentRef } from "@/lib/comment-scope";

// POST /api/comments — add a comment to a parent entity (threaded).
export async function POST(req: Request) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  const parsed = await readJson(req, createCommentSchema);
  if ("response" in parsed) return parsed.response;
  const input = parsed.data;

  const ref: ParentRef = {
    projectId: input.projectId,
    milestoneId: input.milestoneId,
    ticketId: input.ticketId,
    changeRequestId: input.changeRequestId,
    approvalRequestId: input.approvalRequestId,
    meetingId: input.meetingId,
  };
  const parent = singleParent(ref);
  if (!parent) return badRequest("A comment must attach to exactly one parent entity");
  if (!(await canAccessParent(user, ref)))
    return badRequest("You do not have access to that item");

  try {
    const comment = await prisma.$transaction(async (tx) => {
      const c = await tx.comment.create({
        data: {
          ...ref,
          parentCommentId: input.parentCommentId ?? null,
          content: input.content,
          authorId: user.id,
        },
      });
      await writeAudit(
        { actor: toAuditActor(user, req), action: "comment.create", entityType: "comment", entityId: c.id, after: { parent: parent.key } },
        tx
      );
      return c;
    });
    return ok(comment, 201);
  } catch (e) {
    return serverError(e);
  }
}
