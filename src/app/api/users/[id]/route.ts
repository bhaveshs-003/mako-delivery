import { requireRole, toAuditActor } from "@/lib/session";
import { readJson, ok, badRequest, notFound, serverError } from "@/lib/api";
import { patchUserSchema } from "@/lib/validations";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

const ADMIN_MANAGEABLE = ["sub_admin", "resource"];

// PATCH /api/users/[id] — deactivate/reactivate/edit. Deactivation NEVER
// deletes or anonymizes (spec §3.3.7): the row and all its FKs stay intact.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireRole(["super_admin", "admin"]);
  if ("response" in guard) return guard.response;
  const { user } = guard;

  const parsed = await readJson(req, patchUserSchema);
  if ("response" in parsed) return parsed.response;
  const body = parsed.data;

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return notFound("User not found");

  // Admins may only manage Sub-admins and Resources.
  if (user.role === "admin" && !ADMIN_MANAGEABLE.includes(target.role)) {
    return badRequest("Admins can only manage Sub-admin and Resource users");
  }
  if (target.id === user.id && body.action === "deactivate") {
    return badRequest("You cannot deactivate your own account");
  }

  try {
    const actor = toAuditActor(user, req);
    const now = new Date();

    if (body.action === "deactivate") {
      const u = await prisma.$transaction(async (tx) => {
        const updated = await tx.user.update({
          where: { id: target.id },
          data: { isActive: false, deactivatedAt: now, deactivatedBy: user.id },
        });
        await writeAudit({ actor, action: "user.deactivate", entityType: "user", entityId: target.id, before: { isActive: true }, after: { isActive: false } }, tx);
        return updated;
      });
      return ok({ id: u.id, isActive: u.isActive });
    }

    if (body.action === "reactivate") {
      const u = await prisma.$transaction(async (tx) => {
        const updated = await tx.user.update({
          where: { id: target.id },
          data: { isActive: true, deactivatedAt: null, deactivatedBy: null },
        });
        await writeAudit({ actor, action: "user.reactivate", entityType: "user", entityId: target.id, after: { isActive: true } }, tx);
        return updated;
      });
      return ok({ id: u.id, isActive: u.isActive });
    }

    // edit
    const u = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: target.id },
        data: { name: body.name ?? undefined, role: body.role ?? undefined },
      });
      await writeAudit({ actor, action: "user.edit", entityType: "user", entityId: target.id, after: { name: updated.name, role: updated.role } }, tx);
      return updated;
    });
    return ok({ id: u.id, name: u.name, role: u.role });
  } catch (e) {
    return serverError(e);
  }
}
