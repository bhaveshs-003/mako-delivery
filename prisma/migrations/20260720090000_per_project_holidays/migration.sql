-- Per-project organisational holidays (previously global).
DROP INDEX "holidays_date_key";

ALTER TABLE "holidays" ADD COLUMN "projectId" TEXT NOT NULL;

ALTER TABLE "holidays" ADD CONSTRAINT "holidays_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "holidays_projectId_idx" ON "holidays"("projectId");
CREATE UNIQUE INDEX "holidays_projectId_date_key" ON "holidays"("projectId", "date");
