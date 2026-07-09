import { requireUser, toAuditActor } from "@/lib/session";
import { readJson, ok, badRequest, notFound, serverError } from "@/lib/api";
import { editCommentSchema } from "@/lib/validations";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

// PATCH /api/comments/[id] — edit OWN comment. The prior content is preserved
// as a comment_version BEFORE the update (spec §2.11). Comments are NEVER
// deleted here — only the Super Admin hard-delete console can remove one.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  const parsed = await readJson(req, editCommentSchema);
  if ("response" in parsed) return parsed.response;

  const comment = await prisma.comment.findUnique({ where: { id: params.id } });
  if (!comment) return notFound("Comment not found");
  if (comment.authorId !== user.id)
    return badRequest("You can only edit your own comments");

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const priorVersions = await tx.commentVersion.count({ where: { commentId: comment.id } });
      // Snapshot the OLD content first.
      await tx.commentVersion.create({
        data: {
          commentId: comment.id,
          content: comment.content,
          versionNumber: priorVersions + 1,
        },
      });
      const c = await tx.comment.update({
        where: { id: comment.id },
        data: { content: parsed.data.content, isEdited: true, editedAt: new Date() },
      });
      await writeAudit(
        { actor: toAuditActor(user, req), action: "comment.edit", entityType: "comment", entityId: c.id, before: { content: comment.content }, after: { content: c.content } },
        tx
      );
      return c;
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}
