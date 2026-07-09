import { requireUser } from "@/lib/session";
import { ok, badRequest, serverError } from "@/lib/api";
import { prisma } from "@/lib/db";

// GET /api/notifications — the current user's notifications + unread count.
export async function GET() {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notification.count({ where: { recipientId: user.id, isRead: false } }),
  ]);
  return ok({ items, unread });
}

// PATCH /api/notifications — mark one or all read.
export async function PATCH(req: Request) {
  const guard = await requireUser();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  let body: { action?: string; id?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  try {
    if (body.action === "read_all") {
      await prisma.notification.updateMany({
        where: { recipientId: user.id, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });
    } else if (body.action === "read" && body.id) {
      // Scope the update to the caller's own notification.
      await prisma.notification.updateMany({
        where: { id: body.id, recipientId: user.id },
        data: { isRead: true, readAt: new Date() },
      });
    } else {
      return badRequest("Unknown action");
    }
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
}

export const dynamic = "force-dynamic";
