CREATE TYPE "AiActionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'FAILED');

ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'AI_CRM_SEARCH';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'AI_WEB_SEARCH';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'AI_PRICING_USE';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'AI_FILES_ANALYZE';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'AI_ACTIONS_PROPOSE';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'AI_ACTIONS_APPROVE';

CREATE TABLE "AiToolRun" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT,
  "userId" TEXT,
  "toolName" TEXT NOT NULL,
  "success" BOOLEAN NOT NULL DEFAULT true,
  "durationMs" INTEGER NOT NULL DEFAULT 0,
  "inputJson" JSONB,
  "outputSummary" TEXT,
  "scopeKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiToolRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiActionProposal" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT,
  "proposedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "actionType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "AiActionStatus" NOT NULL DEFAULT 'PENDING',
  "resultSummary" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiActionProposal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiToolRun_conversationId_createdAt_idx" ON "AiToolRun"("conversationId", "createdAt");
CREATE INDEX "AiToolRun_userId_createdAt_idx" ON "AiToolRun"("userId", "createdAt");
CREATE INDEX "AiToolRun_scopeKey_createdAt_idx" ON "AiToolRun"("scopeKey", "createdAt");
CREATE INDEX "AiActionProposal_proposedById_status_createdAt_idx" ON "AiActionProposal"("proposedById", "status", "createdAt");
CREATE INDEX "AiActionProposal_status_createdAt_idx" ON "AiActionProposal"("status", "createdAt");

ALTER TABLE "AiToolRun" ADD CONSTRAINT "AiToolRun_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiToolRun" ADD CONSTRAINT "AiToolRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiActionProposal" ADD CONSTRAINT "AiActionProposal_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiActionProposal" ADD CONSTRAINT "AiActionProposal_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiActionProposal" ADD CONSTRAINT "AiActionProposal_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
