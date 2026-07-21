import "server-only";
import { prisma } from "@/lib/db";

const isoOf = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

/** A project's holidays as a Set of ISO yyyy-mm-dd strings, for working-day math. */
export async function holidaySet(projectId: string): Promise<Set<string>> {
  const rows = await prisma.holiday.findMany({ where: { projectId }, select: { date: true } });
  return new Set(rows.map((r) => isoOf(r.date)));
}
