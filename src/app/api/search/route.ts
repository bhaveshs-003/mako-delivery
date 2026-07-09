import { requireUser } from "@/lib/session";
import { ok } from "@/lib/api";
import { prisma } from "@/lib/db";
import { projectScopeWhere } from "@/lib/permissions";

// GET /api/search?q= — scoped search across projects and tickets (spec §4.1).
// Results are limited to what the caller may see.
export async function GET(req: Request) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return ok({ projects: [], tickets: [] });

  const scope = projectScopeWhere(user);
  const isOrgWide = user.role === "super_admin" || user.role === "admin";

  const [projects, tickets] = await Promise.all([
    prisma.project.findMany({
      where: { ...scope, title: { contains: q, mode: "insensitive" } },
      select: { id: true, title: true, type: true },
      take: 6,
    }),
    prisma.ticket.findMany({
      where: {
        title: { contains: q, mode: "insensitive" },
        ...(isOrgWide ? {} : { projectLinks: { some: { project: scope } } }),
      },
      select: { id: true, title: true, status: true },
      take: 6,
    }),
  ]);

  return ok({ projects, tickets });
}

export const dynamic = "force-dynamic";
