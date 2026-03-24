-- CreateEnum
CREATE TYPE "EvalStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- AlterEnum
ALTER TYPE "FlowMode" ADD VALUE 'PARALLEL';

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "langfuseTraceId" TEXT;

-- AlterTable
ALTER TABLE "ChatSession" ADD COLUMN     "langfuseTraceId" TEXT;

-- AlterTable
ALTER TABLE "UserFlow" ADD COLUMN     "canvasState" JSONB;

-- AlterTable
ALTER TABLE "WebletMCPServer" ADD COLUMN     "requiresUserAuth" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "WebletVersion" ADD COLUMN     "abTestEndedAt" TIMESTAMP(3),
ADD COLUMN     "abTestStartedAt" TIMESTAMP(3),
ADD COLUMN     "abTestTrafficPct" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "abTestWinner" BOOLEAN,
ADD COLUMN     "avgScore" DOUBLE PRECISION,
ADD COLUMN     "isAbTest" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "UserMCPToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "tokenEnc" TEXT NOT NULL,
    "tokenIv" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "refreshTokenIv" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "tokenType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMCPToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthState" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "webletId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserWeblet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "webletId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserWeblet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationRun" (
    "id" TEXT NOT NULL,
    "webletId" TEXT NOT NULL,
    "tracesSampled" INTEGER NOT NULL,
    "tracesEvaluated" INTEGER NOT NULL,
    "dimensions" JSONB NOT NULL,
    "compositeScore" DOUBLE PRECISION NOT NULL,
    "judgeModel" TEXT NOT NULL,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "status" "EvalStatus" NOT NULL DEFAULT 'RUNNING',
    "errorMessage" TEXT,
    "triggeredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "EvaluationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserMCPToken_userId_idx" ON "UserMCPToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserMCPToken_userId_serverId_key" ON "UserMCPToken"("userId", "serverId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthState_state_key" ON "OAuthState"("state");

-- CreateIndex
CREATE INDEX "OAuthState_state_idx" ON "OAuthState"("state");

-- CreateIndex
CREATE INDEX "OAuthState_expiresAt_idx" ON "OAuthState"("expiresAt");

-- CreateIndex
CREATE INDEX "UserWeblet_userId_idx" ON "UserWeblet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserWeblet_userId_webletId_key" ON "UserWeblet"("userId", "webletId");

-- CreateIndex
CREATE INDEX "EvaluationRun_webletId_createdAt_idx" ON "EvaluationRun"("webletId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserMCPToken" ADD CONSTRAINT "UserMCPToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMCPToken" ADD CONSTRAINT "UserMCPToken_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "WebletMCPServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWeblet" ADD CONSTRAINT "UserWeblet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWeblet" ADD CONSTRAINT "UserWeblet_webletId_fkey" FOREIGN KEY ("webletId") REFERENCES "Weblet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
