-- CreateTable
CREATE TABLE "HhDefault" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "plantId" TEXT,
    "frecuenciaCodigo" TEXT,
    "abc" TEXT,
    "hhPlan" DECIMAL(10,2) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HhDefault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "key" TEXT NOT NULL,
    "userId" TEXT,
    "scope" TEXT NOT NULL,
    "bodyHash" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ReportRun" (
    "id" TEXT NOT NULL,
    "generatedById" TEXT,
    "scope" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "format" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HhDefault_plantId_idx" ON "HhDefault"("plantId");

-- CreateIndex
CREATE INDEX "HhDefault_frecuenciaCodigo_idx" ON "HhDefault"("frecuenciaCodigo");

-- CreateIndex
CREATE INDEX "HhDefault_abc_idx" ON "HhDefault"("abc");

-- CreateIndex
CREATE UNIQUE INDEX "HhDefault_scope_plantId_frecuenciaCodigo_abc_key" ON "HhDefault"("scope", "plantId", "frecuenciaCodigo", "abc");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_userId_scope_idx" ON "IdempotencyRecord"("userId", "scope");

-- CreateIndex
CREATE INDEX "ReportRun_generatedById_generatedAt_idx" ON "ReportRun"("generatedById", "generatedAt");

-- CreateIndex
CREATE INDEX "ReportRun_scope_generatedAt_idx" ON "ReportRun"("scope", "generatedAt");

-- CreateIndex
CREATE INDEX "ReportRun_sha256_idx" ON "ReportRun"("sha256");
