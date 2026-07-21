-- AlterTable
ALTER TABLE "scope_documents" ADD COLUMN     "proposedMakoInternalDeadline" TIMESTAMP(3),
ADD COLUMN     "proposedMakoStartDate" TIMESTAMP(3),
ADD COLUMN     "proposedRlCommittedDeadline" TIMESTAMP(3),
ADD COLUMN     "proposedRlStartDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "timeline_proposals" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "rlStartDate" TIMESTAMP(3),
    "rlCommittedDeadline" TIMESTAMP(3),
    "makoStartDate" TIMESTAMP(3),
    "makoInternalDeadline" TIMESTAMP(3),
    "note" TEXT,
    "status" "ScopeStatus" NOT NULL DEFAULT 'pending',
    "submittedById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionComment" TEXT,
    "approvalDurationDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timeline_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "timeline_proposals_projectId_idx" ON "timeline_proposals"("projectId");

-- CreateIndex
CREATE INDEX "timeline_proposals_status_idx" ON "timeline_proposals"("status");

-- AddForeignKey
ALTER TABLE "timeline_proposals" ADD CONSTRAINT "timeline_proposals_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
