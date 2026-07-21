import { z } from "zod";
import { requireUser, toAuditActor } from "@/lib/session";
import { can, canActOnProject } from "@/lib/permissions";
import { readJson, ok, badRequest, notFound, serverError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

const createSchema = z.object({
  projectId: z.string().uuid(),
  date: z.coerce.date(),
  label: z.string().min(1).max(200),
});

// A project's holidays are locked once its timeline is submitted or approved.
async function timelineLocked(projectId: string): Promise<boolean> {
  const c = await prisma.timelineProposal.count({
    where: { projectId, status: { in: ["pending", "approved"] } },
  });
  return c > 0;
}

// GET /api/holidays?projectId=… — a project's holiday calendar.
export async function GET(req: Request) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId) return badRequest("A projectId is required");
  const holidays = await prisma.holiday.findMany({
    where: { projectId },
    orderBy: { date: "asc" },
    select: { id: true, date: true, label: true },
  });
  return ok(
    holidays.map((h) => ({ id: h.id, date: h.date.toISOString().slice(0, 10), label: h.label }))
  );
}

// POST /api/holidays — declare a holiday for a project's timeline.
export async function POST(req: Request) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  const parsed = await readJson(req, createSchema);
  if ("response" in parsed) return parsed.response;
  const { projectId, date, label } = parsed.data;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { rlConsultants: { select: { userId: true } }, resources: { select: { userId: true } } },
  });
  if (!project) return notFound("Project not found");
  if (!can(user.role, "project.edit") || !canActOnProject(user, project))
    return badRequest("You cannot manage holidays for this project");
  if (await timelineLocked(projectId))
    return badRequest("The timeline is submitted/approved — holidays are locked");

  try {
    const created = await prisma.holiday.upsert({
      where: { projectId_date: { projectId, date } },
      update: { label },
      create: { projectId, date, label, createdBy: user.id },
    });
    await writeAudit({
      actor: toAuditActor(user, req),
      action: "holiday.create",
      entityType: "project",
      entityId: projectId,
      after: { date: created.date.toISOString().slice(0, 10), label: created.label },
    });
    return ok({ id: created.id });
  } catch (e) {
    return serverError(e);
  }
}

// DELETE /api/holidays?id=… — remove a project holiday.
export async function DELETE(req: Request) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return badRequest("A holiday id is required");

  const holiday = await prisma.holiday.findUnique({
    where: { id },
    include: { project: { include: { rlConsultants: { select: { userId: true } }, resources: { select: { userId: true } } } } },
  });
  if (!holiday) return notFound("Holiday not found");
  if (!can(user.role, "project.edit") || !canActOnProject(user, holiday.project))
    return badRequest("You cannot manage holidays for this project");
  if (await timelineLocked(holiday.projectId))
    return badRequest("The timeline is submitted/approved — holidays are locked");

  try {
    await prisma.holiday.delete({ where: { id } });
    await writeAudit({
      actor: toAuditActor(user, req),
      action: "holiday.delete",
      entityType: "project",
      entityId: holiday.projectId,
    });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}

export const dynamic = "force-dynamic";
