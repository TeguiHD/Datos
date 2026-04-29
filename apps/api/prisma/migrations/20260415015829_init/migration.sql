-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPERADMIN', 'ADMIN', 'EDITOR', 'VIEWER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "totpSecretEnc" TEXT,
    "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "backupCodesEnc" TEXT,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "mustChangePass" BOOLEAN NOT NULL DEFAULT false,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "lastLoginIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshHash" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceTask" (
    "id" TEXT NOT NULL,
    "andamios" TEXT,
    "materiales" TEXT,
    "comentarios" TEXT,
    "psr" TEXT,
    "centroPlanificacion" TEXT,
    "claseActividadPm" TEXT,
    "claseOrden" TEXT,
    "campoClasificacion" TEXT,
    "planMantPreventivo" TEXT,
    "estrategiaMantenim" TEXT,
    "descPosicionMant" TEXT,
    "ultimaOrden" TEXT,
    "indicadorAbc" TEXT,
    "ubicacionTecnica" TEXT,
    "denomUbicacionTecnica" TEXT,
    "posicionMant" TEXT,
    "ptoTbjoResponsable" TEXT,
    "equipo" TEXT,
    "denomObjetoTecnico" TEXT,
    "tipoHojaRuta" TEXT,
    "grupoHojasRuta" TEXT,
    "contGrupoHRuta" TEXT,
    "hojaRuta" TEXT,
    "creadoEl" TIMESTAMP(3),
    "claveModelo" TEXT,
    "frecuenciaCodigo" TEXT,
    "hhReal" DECIMAL(10,2),
    "frecuenciaMeses" INTEGER,
    "mesInicio" INTEGER,
    "sourceRowHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlySchedule" (
    "taskId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "hh" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "MonthlySchedule_pkey" PRIMARY KEY ("taskId","year","month")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "prevHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "filename" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "rowsTotal" INTEGER NOT NULL,
    "rowsOk" INTEGER NOT NULL,
    "rowsErr" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshHash_key" ON "Session"("refreshHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_familyId_idx" ON "Session"("familyId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "MaintenanceTask_indicadorAbc_idx" ON "MaintenanceTask"("indicadorAbc");

-- CreateIndex
CREATE INDEX "MaintenanceTask_frecuenciaCodigo_idx" ON "MaintenanceTask"("frecuenciaCodigo");

-- CreateIndex
CREATE INDEX "MaintenanceTask_psr_idx" ON "MaintenanceTask"("psr");

-- CreateIndex
CREATE INDEX "MaintenanceTask_centroPlanificacion_idx" ON "MaintenanceTask"("centroPlanificacion");

-- CreateIndex
CREATE INDEX "MaintenanceTask_ubicacionTecnica_idx" ON "MaintenanceTask"("ubicacionTecnica");

-- CreateIndex
CREATE INDEX "MaintenanceTask_equipo_idx" ON "MaintenanceTask"("equipo");

-- CreateIndex
CREATE INDEX "MonthlySchedule_year_month_idx" ON "MonthlySchedule"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_hash_key" ON "AuditLog"("hash");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlySchedule" ADD CONSTRAINT "MonthlySchedule_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "MaintenanceTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
