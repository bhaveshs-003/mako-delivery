import { requireUser, toAuditActor } from "@/lib/session";
import { can, canActOnProject } from "@/lib/permissions";
import { readJson, ok, badRequest, notFound, serverError } from "@/lib/api";
import { createMeetingSchema } from "@/lib/validations";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

// POST /api/meetings — log a meeting. MoM deadline = meetingDate + 24h (spec §2.10).
export async function POST(req: Request) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  if (!can(user.role, "meeting.log"))
    return badRequest("You do not have permission to log meetings");

  const parsed = await readJson(req, createMeetingSchema);
  if ("response" in parsed) return parsed.response;
  const input = parsed.data;

  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    include: { rlConsultants: { select: { userId: true } }, resources: { select: { userId: true } } },
  });
  if (!project) return notFound("Project not found");
  if (!canActOnProject(user, project))
    return badRequest("You are not assigned to this project");

  try {
    const momDeadline = new Date(input.meetingDate.getTime() + 24 * 60 * 60 * 1000);
    const meeting = await prisma.$transaction(async (tx) => {
      const m = await tx.meeting.create({
        data: {
          projectId: input.projectId,
          milestoneId: input.milestoneId ?? null,
          title: input.title,
          meetingDate: input.meetingDate,
          meetingLink: input.meetingLink || null,
          organizerId: user.id,
          momDeadline,
          attendees: { create: input.attendeeIds.map((userId) => ({ userId })) },
          createdBy: user.id,
        },
      });
      await writeAudit(
        { actor: toAuditActor(user, req), action: "meeting.create", entityType: "meeting", entityId: m.id, after: { title: m.title }, metadata: { projectId: input.projectId } },
        tx
      );
      return m;
    });
    return ok(meeting, 201);
  } catch (e) {
    return serverError(e);
  }
}
