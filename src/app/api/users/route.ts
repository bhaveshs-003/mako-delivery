import { requireRole, toAuditActor } from "@/lib/session";
import { readJson, ok, badRequest, serverError } from "@/lib/api";
import { createUserSchema } from "@/lib/validations";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { hash } from "bcryptjs";

// Roles an Admin (vs Super Admin) is allowed to create/manage (spec §3.1 note).
const ADMIN_MANAGEABLE = ["sub_admin", "resource"] as const;

// GET /api/users?role=rl_user — list users for assignment pickers.
export async function GET(req: Request) {
  const guard = await requireRole(["super_admin", "admin", "sub_admin"]);
  if ("response" in guard) return guard.response;

  const role = new URL(req.url).searchParams.get("role") ?? undefined;
  const users = await prisma.user.findMany({
    where: { isActive: true, ...(role ? { role: role as never } : {}) },
    select: { id: true, name: true, email: true, role: true, designation: true },
    orderBy: { name: "asc" },
  });
  return ok(users);
}

// POST /api/users — create a user (Super Admin, or Admin for sub_admin/resource).
export async function POST(req: Request) {
  const guard = await requireRole(["super_admin", "admin"]);
  if ("response" in guard) return guard.response;
  const { user } = guard;

  const parsed = await readJson(req, createUserSchema);
  if ("response" in parsed) return parsed.response;
  const input = parsed.data;

  if (
    user.role === "admin" &&
    !ADMIN_MANAGEABLE.includes(input.role as (typeof ADMIN_MANAGEABLE)[number])
  ) {
    return badRequest("Admins can only create Sub-admin and Resource users");
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (existing) return badRequest("A user with that email already exists");

    const created = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          name: input.name,
          email: input.email.toLowerCase(),
          role: input.role,
          passwordHash: await hash(input.password, 10),
        },
      });
      await writeAudit(
        {
          actor: toAuditActor(user, req),
          action: "user.create",
          entityType: "user",
          entityId: u.id,
          after: { email: u.email, role: u.role },
        },
        tx
      );
      return u;
    });

    return ok(
      { id: created.id, name: created.name, email: created.email, role: created.role },
      201
    );
  } catch (e) {
    return serverError(e);
  }
}

export const dynamic = "force-dynamic";
