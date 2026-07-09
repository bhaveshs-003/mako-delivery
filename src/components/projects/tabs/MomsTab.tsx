import { prisma } from "@/lib/db";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AttributionBadge } from "@/components/shared/AttributionBadge";
import { LogMeetingForm } from "@/components/forms/LogMeetingForm";
import { SubmitMomForm } from "@/components/forms/SubmitMomForm";
import { formatDate } from "@/lib/utils";
import { CalendarClock } from "lucide-react";

export async function MomsTab({
  projectId,
  userId,
  canLog,
}: {
  projectId: string;
  userId: string;
  canLog: boolean;
}) {
  const now = new Date();
  const [meetings, attendeeOptions] = await Promise.all([
    prisma.meeting.findMany({
      where: { projectId },
      orderBy: { meetingDate: "desc" },
      include: { organizer: { select: { name: true } } },
    }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-navy">Meetings & MoMs</h2>
        {canLog && <LogMeetingForm projectId={projectId} attendeeOptions={attendeeOptions} />}
      </div>

      {meetings.length === 0 ? (
        <EmptyState icon={CalendarClock} title="No meetings logged" subtitle="Log meetings and capture minutes within 24 hours." />
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => {
            const overdue = m.momStatus === "pending" && m.momDeadline && now > m.momDeadline;
            const isOrganizer = m.organizerId === userId;
            return (
              <div key={m.id} className="rounded-lg border border-border bg-surface p-4 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-navy">{m.title}</span>
                    <StatusBadge status={overdue ? "overdue" : m.momStatus} />
                    {m.momLateReasonCategory === "rl_delay_compressed_timeline" && (
                      <AttributionBadge party="rl" />
                    )}
                  </div>
                  <span className="text-xs text-slate">{formatDate(m.meetingDate)}</span>
                </div>
                <p className="mt-1 text-xs text-slate">Organizer: {m.organizer.name}</p>

                {m.momContent ? (
                  <div className="mt-2 whitespace-pre-wrap rounded-md bg-bg px-3 py-2 text-sm text-navy" dangerouslySetInnerHTML={{ __html: m.momContent }} />
                ) : (
                  <p className="mt-2 text-sm text-slate">
                    MoM {overdue ? "overdue" : "pending"} · deadline {formatDate(m.momDeadline)}
                  </p>
                )}

                {m.momLateReasonComment && (
                  <p className="mt-1 text-xs text-danger">Late reason: {m.momLateReasonComment}</p>
                )}

                {isOrganizer && m.momStatus === "pending" && (
                  <div className="mt-3">
                    <SubmitMomForm meetingId={m.id} isLate={!!overdue} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
