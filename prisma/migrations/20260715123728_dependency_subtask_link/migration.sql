-- AlterTable
ALTER TABLE "dependencies" ADD COLUMN     "subtaskId" TEXT;

-- AddForeignKey
ALTER TABLE "dependencies" ADD CONSTRAINT "dependencies_subtaskId_fkey" FOREIGN KEY ("subtaskId") REFERENCES "subtasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
