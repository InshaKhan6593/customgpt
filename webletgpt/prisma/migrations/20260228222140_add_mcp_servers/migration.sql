-- CreateEnum
CREATE TYPE "MCPAuthType" AS ENUM ('NONE', 'API_KEY', 'BEARER_TOKEN', 'OAUTH');

-- AlterTable
ALTER TABLE "UserFlow" ADD COLUMN     "defaultPrompt" TEXT;

-- AlterTable
ALTER TABLE "WebletVersion" ADD COLUMN     "openapiSchema" JSONB;

-- CreateTable
CREATE TABLE "WebletMCPServer" (
    "id" TEXT NOT NULL,
    "webletId" TEXT NOT NULL,
    "serverUrl" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "iconUrl" TEXT,
    "authType" "MCPAuthType" NOT NULL DEFAULT 'NONE',
    "authToken" TEXT,
    "tools" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "catalogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebletMCPServer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebletMCPServer_webletId_idx" ON "WebletMCPServer"("webletId");

-- CreateIndex
CREATE UNIQUE INDEX "WebletMCPServer_webletId_serverUrl_key" ON "WebletMCPServer"("webletId", "serverUrl");

-- AddForeignKey
ALTER TABLE "WebletMCPServer" ADD CONSTRAINT "WebletMCPServer_webletId_fkey" FOREIGN KEY ("webletId") REFERENCES "Weblet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
