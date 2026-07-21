-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "includeWeekends" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "scope_documents" ADD COLUMN     "proposedIncludeWeekends" BOOLEAN;

-- AlterTable
ALTER TABLE "timeline_proposals" ADD COLUMN     "includeWeekends" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "label" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "holidays_date_key" ON "holidays"("date");
