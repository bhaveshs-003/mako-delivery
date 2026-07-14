-- CreateEnum
CREATE TYPE "MilestoneType" AS ENUM ('main_scope', 'change_request', 'delta_scope');

-- CreateEnum
CREATE TYPE "ScopeStatus" AS ENUM ('pending', 'approved', 'rejected', 'superseded');

-- AlterTable
ALTER TABLE "milestones" ADD COLUMN     "approvalDurationDays" INTEGER,
ADD COLUMN     "changeRequestId" TEXT,
ADD COLUMN     "type" "MilestoneType" NOT NULL DEFAULT 'main_scope';

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "milestonePlanApprovalDays" INTEGER,
ADD COLUMN     "scopeApproved" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "designation" TEXT;

-- CreateTable
CREATE TABLE "scope_documents" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "mimeType" TEXT NOT NULL,
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

    CONSTRAINT "scope_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scope_documents_projectId_idx" ON "scope_documents"("projectId");

-- CreateIndex
CREATE INDEX "scope_documents_status_idx" ON "scope_documents"("status");

-- AddForeignKey
ALTER TABLE "scope_documents" ADD CONSTRAINT "scope_documents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "change_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
