import { requireRole, toAuditActor } from "@/lib/session";
import { readJson, ok, serverError } from "@/lib/api";
import { upsertSlaSchema } from "@/lib/validations";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

// GET /api/settings/sla — list SLA configs (Super Admin only, spec §5.7).
export async function GET() {
  const guard = await requireRole(["super_admin"]);
  if ("response" in guard) return guard.response;
  const configs = await prisma.slaConfig.findMany({ orderBy: { dependencyType: "asc" } });
  return ok(configs);
}

// PUT /api/settings/sla — upsert one SLA rule.
export async function PUT(req: Request) {
  const guard = await requireRole(["super_admin"]);
  if ("response" in guard) return guard.response;
  const { user } = guard;

  const parsed = await readJson(req, upsertSlaSchema);
  if ("response" in parsed) return parsed.response;
  const input = parsed.data;

  try {
    const config = await prisma.$transaction(async (tx) => {
      const c = await tx.slaConfig.upsert({
        where: { dependencyType: input.dependencyType },
        create: {
          dependencyType: input.dependencyType,
          thresholdDays: input.thresholdDays,
          approvalSlaDays: input.approvalSlaDays,
          createdBy: user.id,
        },
        update: {
          thresholdDays: input.thresholdDays,
          approvalSlaDays: input.approvalSlaDays,
        },
      });
      await writeAudit(
        { actor: toAuditActor(user, req), action: "sla_config.upsert", entityType: "sla_config", entityId: c.id, after: { type: c.dependencyType, threshold: c.thresholdDays } },
        tx
      );
      return c;
    });
    return ok(config);
  } catch (e) {
    return serverError(e);
  }
}
