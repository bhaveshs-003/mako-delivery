-- CreateEnum
CREATE TYPE "ScopeDocumentKind" AS ENUM ('scope', 'change_request');

-- AlterTable
ALTER TABLE "scope_documents" ADD COLUMN     "kind" "ScopeDocumentKind" NOT NULL DEFAULT 'scope',
ADD COLUMN     "title" TEXT;
