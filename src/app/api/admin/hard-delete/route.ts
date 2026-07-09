import { requireRole, toAuditActor } from "@/lib/session";
import { readJson, ok, badRequest, notFound, serverError } from "@/lib/api";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

// Entities the console can delete, with a loader for the confirmation name.
const DELETABLE: Record<string, { table: string; label: (row: Record<string, unknown>) => string }> = {
  project: { table: "project", label: (r) => String(r.title) },
  ticket: { table: "ticket", label: (r) => String(r.title) },
  comment: { table: "comment", label: (r) => String(r.content).slice(0, 40) },
};

const schema = z.object({
  entityType: z.enum(["project", "ticket", "comment"]),
  entityId: z.string().uuid(),
  confirmName: z.string().min(1),
  reason: z.string().min(1, "A written reason is required"),
});

// POST /api/admin/hard-delete — Super Admin only. Writes a tombstone to the
// audit log in the SAME transaction as the delete (spec §2.13, §3.3.6). If the
// tombstone insert fails, the delete does not execute.
export async function POST(req: Request) {
  const guard = await requireRole(["super_admin"]);
  if ("response" in guard) return guard.response;
  const { user } = guard;

  const parsed = await readJson(req, schema);
  if ("response" in parsed) return parsed.response;
  const { entityType, entityId, confirmName, reason } = parsed.data;

  const def = DELETABLE[entityType];
  if (!def) return badRequest("Unsupported entity type");

  // Load the target to verify the typed confirmation name matches.
  // @ts-expect-error dynamic model access
  const row = await prisma[def.table].findUnique({ where: { id: entityId } });
  if (!row) return notFound("Record not found");
  if (def.label(row) !== confirmName)
    return badRequest("Confirmation text does not match the record");

  try {
    await prisma.$transaction(async (tx) => {
      // Tombstone FIRST — if this throws, the delete never runs.
      await writeAudit(
        {
          actor: toAuditActor(user, req),
          action: `${entityType}.hard_delete`,
          entityType,
          entityId,
          before: JSON.parse(JSON.stringify(row, (_k, v) => (typeof v === "bigint" ? v.toString() : v))),
          tombstone: { reason, targetType: entityType, targetId: entityId },
        },
        tx
      );
      // @ts-expect-error dynamic model access
      await tx[def.table].delete({ where: { id: entityId } });
    });
    return ok({ deleted: true });
  } catch (e) {
    return serverError(e);
  }
}
