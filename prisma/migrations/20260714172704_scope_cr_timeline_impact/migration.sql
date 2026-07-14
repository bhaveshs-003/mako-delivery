-- AlterTable
ALTER TABLE "scope_documents" ADD COLUMN     "timelineAdjusted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "timelineImpactDays" INTEGER;
