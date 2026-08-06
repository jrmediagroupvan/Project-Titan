ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'AI_STL_VIEW';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'AI_STL_CREATE';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'AI_STL_EDIT';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'AI_STL_DELETE';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'AI_STL_EXPORT';
ALTER TYPE "FeatureCategory" ADD VALUE IF NOT EXISTS 'AI_STL_DEVELOPER';

CREATE TABLE "AiStlDesign" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "customerId" TEXT,
  "title" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "summary" TEXT,
  "designJson" JSONB NOT NULL,
  "storageKey" TEXT NOT NULL,
  "bytes" INTEGER NOT NULL,
  "dimensions" JSONB NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiStlDesign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiStlDesign_userId_updatedAt_idx" ON "AiStlDesign"("userId", "updatedAt");
CREATE INDEX "AiStlDesign_customerId_updatedAt_idx" ON "AiStlDesign"("customerId", "updatedAt");

ALTER TABLE "AiStlDesign"
  ADD CONSTRAINT "AiStlDesign_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiStlDesign"
  ADD CONSTRAINT "AiStlDesign_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
