/**
 * Auto-scheduling of milestone due dates. Due dates are derived, not hand-typed:
 * each main-scope milestone's due date is the previous milestone's completion
 * plus its own allocated days, chained from the project's start anchor. Called
 * whenever milestones, their allocated days, or their order change.
 */
import type { Prisma } from "@prisma/client";
import { chainDueDates, scheduleAnchor } from "@/lib/allocation";

type Tx = Prisma.TransactionClient;

/**
 * Recompute and persist due dates for a project's non-archived milestones in
 * sortOrder. No-op if the project has no start anchor set.
 */
export async function recomputeDueDates(tx: Tx, projectId: string): Promise<void> {
  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: {
      rlStartDate: true,
      rlCommittedDeadline: true,
      makoStartDate: true,
      makoInternalDeadline: true,
    },
  });
  const anchor = project ? scheduleAnchor(project) : null;
  if (!anchor) return;

  const milestones = await tx.milestone.findMany({
    where: { projectId, isArchived: false },
    orderBy: { sortOrder: "asc" },
    select: { id: true, allocatedDays: true, dueDate: true },
  });

  const due = chainDueDates(anchor, milestones);
  await Promise.all(
    milestones.map((m, i) => {
      const next = due[i];
      // Skip the write when nothing changed (avoids churn / updatedAt bumps).
      if ((m.dueDate?.getTime() ?? null) === (next?.getTime() ?? null)) return null;
      return tx.milestone.update({ where: { id: m.id }, data: { dueDate: next } });
    })
  );
}
