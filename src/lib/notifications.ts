/**
 * Notification dispatch (spec §2.14, §7.5, §8). Creates an in-app notification
 * row AND sends the branded email. Deactivated users receive neither.
 */
import { prisma } from "./db";
import { renderEmail, sendEmail } from "./email";

// The 19 notification types (spec §2.14 / §8).
export type NotificationType =
  | "project_created"
  | "resource_assigned"
  | "status_changed"
  | "ticket_raised"
  | "ticket_response"
  | "ticket_multi_project"
  | "approval_requested"
  | "approval_decided"
  | "approval_sla_approaching"
  | "approval_sla_breached"
  | "dependency_sla_breach"
  | "dependency_requested"
  | "dependency_fulfilled"
  | "mom_deadline_approaching"
  | "mom_deadline_missed"
  | "cr_raised"
  | "cr_decided"
  | "milestone_due_soon"
  | "subtask_assigned"
  | "subtask_blocked"
  | "escalation";

export type NotifyInput = {
  recipientId: string;
  type: NotificationType;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  projectId?: string;
  /** In-app + email deep link, e.g. "/projects/<id>". */
  deepLinkPath?: string;
};

/** Dispatch one notification (DB row + email). Never throws to the caller. */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const recipient = await prisma.user.findUnique({
      where: { id: input.recipientId },
      select: { email: true, isActive: true },
    });
    // Deactivated users stop receiving notifications immediately.
    if (!recipient || !recipient.isActive) return;

    const notification = await prisma.notification.create({
      data: {
        recipientId: input.recipientId,
        type: input.type,
        title: input.title,
        body: input.body,
        entityType: input.entityType,
        entityId: input.entityId,
        projectId: input.projectId,
      },
    });

    const html = renderEmail({
      title: input.title,
      body: input.body ?? "",
      deepLinkPath: input.deepLinkPath,
    });
    const { sent } = await sendEmail({
      to: recipient.email,
      subject: `[Mako] ${input.title}`,
      html,
    });

    if (sent) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { emailSent: true, emailSentAt: new Date() },
      });
    }
  } catch (e) {
    // Notifications are best-effort; never fail the triggering action.
    console.error("[notify] failed:", e);
  }
}

/** Dispatch to many recipients, de-duplicated (multi-project ticket fan-out). */
export async function notifyMany(
  recipientIds: string[],
  input: Omit<NotifyInput, "recipientId">
): Promise<void> {
  const unique = Array.from(new Set(recipientIds));
  await Promise.all(unique.map((recipientId) => notify({ ...input, recipientId })));
}
