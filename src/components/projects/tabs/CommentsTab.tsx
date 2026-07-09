import { prisma } from "@/lib/db";
import { CommentsSection, type CommentNode } from "@/components/projects/CommentsSection";

export async function CommentsTab({ projectId, userId }: { projectId: string; userId: string }) {
  const comments = await prisma.comment.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { name: true } }, _count: { select: { versions: true } } },
  });

  const nodes: CommentNode[] = comments.map((c) => ({
    id: c.id,
    content: c.content,
    authorId: c.authorId,
    authorName: c.author.name,
    createdAt: c.createdAt.toISOString(),
    isEdited: c.isEdited,
    versionCount: c._count.versions,
    parentCommentId: c.parentCommentId,
  }));

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-navy">Comments</h2>
      <CommentsSection projectId={projectId} comments={nodes} userId={userId} />
    </div>
  );
}
