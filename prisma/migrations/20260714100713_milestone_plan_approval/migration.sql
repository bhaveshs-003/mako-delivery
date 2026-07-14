-- CreateEnum
CREATE TYPE "MilestonePlanStatus" AS ENUM ('draft', 'pending_approval', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "milestonePlanDecidedAt" TIMESTAMP(3),
ADD COLUMN     "milestonePlanDecidedBy" TEXT,
ADD COLUMN     "milestonePlanDecisionComment" TEXT,
ADD COLUMN     "milestonePlanStatus" "MilestonePlanStatus" NOT NULL DEFAULT 'draft',
ADD COLUMN     "milestonePlanSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "milestonePlanSubmittedBy" TEXT;
