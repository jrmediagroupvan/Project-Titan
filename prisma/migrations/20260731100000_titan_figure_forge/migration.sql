CREATE TABLE "ForgeProject" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "customerId" TEXT,
  "title" TEXT NOT NULL,
  "style" TEXT NOT NULL,
  "baseStyle" TEXT NOT NULL,
  "nameplateText" TEXT,
  "instructions" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "sourceImageKey" TEXT NOT NULL,
  "sourceImageName" TEXT NOT NULL,
  "sourceMimeType" TEXT NOT NULL,
  "stlStorageKey" TEXT,
  "previewImageKey" TEXT,
  "provider" TEXT,
  "providerJobId" TEXT,
  "errorMessage" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ForgeProject_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ForgeProject_userId_createdAt_idx" ON "ForgeProject"("userId", "createdAt");
CREATE INDEX "ForgeProject_customerId_idx" ON "ForgeProject"("customerId");
CREATE INDEX "ForgeProject_status_idx" ON "ForgeProject"("status");
ALTER TABLE "ForgeProject" ADD CONSTRAINT "ForgeProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForgeProject" ADD CONSTRAINT "ForgeProject_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
