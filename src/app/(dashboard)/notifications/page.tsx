import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { NotificationsFeed, type NotifItem } from "@/components/notifications/NotificationsFeed";

// Derive a deep link from the notification's stored references.
function deepLink(n: { projectId: string | null; entityType: string | null }): string | null {
  if (!n.projectId) return null;
  const tabByEntity: Record<string, string> = {
    dependency: "dependencies",
    approval_request: "approvals",
    change_request: "change-requests",
    subtask: "lifecycle",
    milestone: "lifecycle",
    meeting: "moms",
  };
  const tab = n.entityType ? tabByEntity[n.entityType] : undefined;
  return `/projects/${n.projectId}${tab ? `?tab=${tab}` : ""}`;
}

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { recipientId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const items: NotifItem[] = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
    deepLinkPath: deepLink(n),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy">Notifications</h1>
      <NotificationsFeed initial={items} />
    </div>
  );
}
