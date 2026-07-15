-- AlterTable
ALTER TABLE "approval_requests" ADD COLUMN     "subtaskId" TEXT;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_subtaskId_fkey" FOREIGN KEY ("subtaskId") REFERENCES "subtasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
