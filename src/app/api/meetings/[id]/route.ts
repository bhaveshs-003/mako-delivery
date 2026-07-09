import { requireUser, toAuditActor } from "@/lib/session";
import { readJson, ok, badRequest, notFound, serverError } from "@/lib/api";
import { submitMomSchema } from "@/lib/validations";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

// PATCH /api/meetings/[id] — submit the MoM. If past the 24h deadline, a late
// reason is mandatory; 'rl_delay_compressed_timeline' feeds the delay-
// attribution report as an RL-caused event (spec §2.10).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  const parsed = await readJson(req, submitMomSchema);
  if ("response" in parsed) return parsed.response;
  const input = parsed.data;

  const meeting = await prisma.meeting.findUnique({ where: { id: params.id } });
  if (!meeting) return notFound("Meeting not found");

  // Only the organizer (or an Admin/Super Admin) may submit the MoM.
  const isAdmin = user.role === "admin" || user.role === "super_admin";
  if (meeting.organizerId !== user.id && !isAdmin)
    return badRequest("Only the meeting organizer can submit the MoM");

  const now = new Date();
  const isLate = meeting.momDeadline ? now > meeting.momDeadline : false;
  if (isLate && (!input.lateReasonCategory || !input.lateReasonComment?.trim())) {
    return badRequest("This MoM is past its deadline — a late reason is required");
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const m = await tx.meeting.update({
        where: { id: meeting.id },
        data: {
          momStatus: isLate ? "late" : "submitted",
          momContent: input.content,
          momSubmittedAt: now,
          momSubmittedBy: user.id,
          momLateReasonCategory: isLate ? input.lateReasonCategory : null,
          momLateReasonComment: isLate ? input.lateReasonComment : null,
        },
      });
      await writeAudit(
        { actor: toAuditActor(user, req), action: isLate ? "mom.submit_late" : "mom.submit", entityType: "meeting", entityId: m.id, after: { momStatus: m.momStatus, lateReason: m.momLateReasonCategory }, metadata: { projectId: meeting.projectId } },
        tx
      );
      return m;
    });
    return ok(updated);
  } catch (e) {
    return serverError(e);
  }
}
