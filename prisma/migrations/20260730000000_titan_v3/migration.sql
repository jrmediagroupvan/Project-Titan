-- Project TITAN v3.0 additive upgrade.
-- Existing customers, quotes, orders, payments, inventory and users are preserved.

CREATE TYPE "PermissionKey" AS ENUM (
  'CUSTOMERS_VIEW','CUSTOMERS_EDIT','CUSTOMERS_DELETE','QUOTES_VIEW','QUOTES_EDIT',
  'ORDERS_VIEW','ORDERS_EDIT','PRODUCTION_VIEW','PRODUCTION_EDIT','INVENTORY_VIEW',
  'INVENTORY_EDIT','TASKS_VIEW','TASKS_EDIT','EXPENSES_VIEW','EXPENSES_EDIT',
  'REPORTS_VIEW','USERS_MANAGE','INTEGRATIONS_MANAGE','AUDIT_VIEW'
);
CREATE TYPE "EmailProvider" AS ENUM ('GOOGLE','SMTP');
CREATE TYPE "PriceSourceType" AS ENUM ('JSON_FEED','MANUAL');

ALTER TABLE "BusinessSetting" ADD COLUMN "quoteMarkupPercent" DOUBLE PRECISION NOT NULL DEFAULT 13;
ALTER TABLE "QuoteItem" ADD COLUMN "baseCostCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "QuoteItem" ADD COLUMN "markupPercent" DOUBLE PRECISION NOT NULL DEFAULT 13;
ALTER TABLE "QuoteItem" ADD COLUMN "priceSource" TEXT;

CREATE TABLE "UserPermission" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "permission" "PermissionKey" NOT NULL,
  "allowed" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserPermission_userId_permission_key" ON "UserPermission"("userId","permission");
CREATE INDEX "UserPermission_userId_idx" ON "UserPermission"("userId");
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EmailAccount" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "provider" "EmailProvider" NOT NULL DEFAULT 'GOOGLE',
  "emailAddress" TEXT NOT NULL,
  "displayName" TEXT,
  "encryptedAccessToken" TEXT,
  "encryptedRefreshToken" TEXT,
  "tokenExpiresAt" TIMESTAMP(3),
  "scopes" TEXT,
  "isTeamMailbox" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastSyncAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailAccount_provider_emailAddress_key" ON "EmailAccount"("provider","emailAddress");
CREATE INDEX "EmailAccount_ownerId_idx" ON "EmailAccount"("ownerId");
ALTER TABLE "EmailAccount" ADD CONSTRAINT "EmailAccount_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MailboxAccess" (
  "id" TEXT NOT NULL,
  "emailAccountId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "canRead" BOOLEAN NOT NULL DEFAULT true,
  "canSend" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MailboxAccess_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MailboxAccess_emailAccountId_userId_key" ON "MailboxAccess"("emailAccountId","userId");
CREATE INDEX "MailboxAccess_userId_idx" ON "MailboxAccess"("userId");
ALTER TABLE "MailboxAccess" ADD CONSTRAINT "MailboxAccess_emailAccountId_fkey" FOREIGN KEY ("emailAccountId") REFERENCES "EmailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MailboxAccess" ADD CONSTRAINT "MailboxAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MaterialPriceSource" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sourceType" "PriceSourceType" NOT NULL DEFAULT 'MANUAL',
  "endpointUrl" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "currency" TEXT NOT NULL DEFAULT 'CAD',
  "priceJsonPath" TEXT,
  "materialType" TEXT,
  "brand" TEXT,
  "spoolGrams" DOUBLE PRECISION NOT NULL DEFAULT 1000,
  "lastCheckedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MaterialPriceSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaterialMarketPrice" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "materialId" TEXT,
  "materialType" TEXT NOT NULL,
  "priceCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CAD',
  "spoolGrams" DOUBLE PRECISION NOT NULL DEFAULT 1000,
  "productUrl" TEXT,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaterialMarketPrice_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MaterialMarketPrice_materialType_observedAt_idx" ON "MaterialMarketPrice"("materialType","observedAt");
CREATE INDEX "MaterialMarketPrice_sourceId_observedAt_idx" ON "MaterialMarketPrice"("sourceId","observedAt");
ALTER TABLE "MaterialMarketPrice" ADD CONSTRAINT "MaterialMarketPrice_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "MaterialPriceSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaterialMarketPrice" ADD CONSTRAINT "MaterialMarketPrice_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PortalAccessToken" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "label" TEXT,
  "tokenHash" TEXT NOT NULL,
  "encryptedToken" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortalAccessToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PortalAccessToken_tokenHash_key" ON "PortalAccessToken"("tokenHash");
CREATE INDEX "PortalAccessToken_customerId_idx" ON "PortalAccessToken"("customerId");
ALTER TABLE "PortalAccessToken" ADD CONSTRAINT "PortalAccessToken_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
