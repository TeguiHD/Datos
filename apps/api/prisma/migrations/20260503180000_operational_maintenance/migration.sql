-- Operational maintenance platform
-- Adds plants, equipment, maintenance plan tasks, executions, and evidence.
-- Legacy Excel-backed MaintenanceTask/TaskExecution tables are intentionally kept.

CREATE TYPE "PlantStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "EquipmentType" AS ENUM ('MOTOR', 'PUMP', 'FILTER', 'PANEL', 'OTHER');
CREATE TYPE "PlanFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'CUSTOM');
CREATE TYPE "OperationalExecutionStatus" AS ENUM (
  'SCHEDULED',
  'IN_PROGRESS',
  'DONE_PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'SKIPPED',
  'POSTPONED'
);
CREATE TYPE "ExecutionOutcome" AS ENUM ('DONE', 'DONE_WITH_OBSERVATIONS', 'NOT_DONE');

CREATE TABLE "Plant" (
  "id" TEXT NOT NULL,
  "psr" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "area" TEXT,
  "color" TEXT,
  "status" "PlantStatus" NOT NULL DEFAULT 'ACTIVE',
  "visibleToViewer" BOOLEAN NOT NULL DEFAULT true,
  "inactiveReason" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Plant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Equipment" (
  "id" TEXT NOT NULL,
  "plantId" TEXT NOT NULL,
  "type" "EquipmentType" NOT NULL DEFAULT 'OTHER',
  "name" TEXT NOT NULL,
  "model" TEXT,
  "serial" TEXT,
  "notes" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaintenancePlanTask" (
  "id" TEXT NOT NULL,
  "plantId" TEXT NOT NULL,
  "equipmentId" TEXT,
  "abc" TEXT,
  "description" TEXT NOT NULL,
  "frequency" "PlanFrequency" NOT NULL,
  "cronExpression" TEXT,
  "hhPlan" DECIMAL(10,2) NOT NULL,
  "responsibleId" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MaintenancePlanTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OperationalExecution" (
  "id" TEXT NOT NULL,
  "planTaskId" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3),
  "doneDate" TIMESTAMP(3),
  "status" "OperationalExecutionStatus" NOT NULL DEFAULT 'SCHEDULED',
  "outcome" "ExecutionOutcome",
  "hhPlan" DECIMAL(10,2) NOT NULL,
  "hhActual" DECIMAL(10,2),
  "comment" TEXT,
  "skipReason" TEXT,
  "postponedTo" TIMESTAMP(3),
  "reopenedReason" TEXT,
  "registeredById" TEXT,
  "approvedById" TEXT,
  "rejectedById" TEXT,
  "rejectedReason" TEXT,
  "registeredAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OperationalExecution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Evidence" (
  "id" TEXT NOT NULL,
  "executionId" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "originalName" TEXT,
  "mime" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "description" TEXT,
  "uploadedById" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Plant_psr_key" ON "Plant"("psr");
CREATE INDEX "Plant_status_idx" ON "Plant"("status");
CREATE INDEX "Plant_area_idx" ON "Plant"("area");
CREATE INDEX "Plant_deletedAt_idx" ON "Plant"("deletedAt");

CREATE INDEX "Equipment_plantId_idx" ON "Equipment"("plantId");
CREATE INDEX "Equipment_type_idx" ON "Equipment"("type");
CREATE INDEX "Equipment_deletedAt_idx" ON "Equipment"("deletedAt");

CREATE INDEX "MaintenancePlanTask_plantId_idx" ON "MaintenancePlanTask"("plantId");
CREATE INDEX "MaintenancePlanTask_equipmentId_idx" ON "MaintenancePlanTask"("equipmentId");
CREATE INDEX "MaintenancePlanTask_abc_idx" ON "MaintenancePlanTask"("abc");
CREATE INDEX "MaintenancePlanTask_frequency_idx" ON "MaintenancePlanTask"("frequency");
CREATE INDEX "MaintenancePlanTask_active_idx" ON "MaintenancePlanTask"("active");
CREATE INDEX "MaintenancePlanTask_deletedAt_idx" ON "MaintenancePlanTask"("deletedAt");

CREATE UNIQUE INDEX "OperationalExecution_planTaskId_dueDate_key" ON "OperationalExecution"("planTaskId", "dueDate");
CREATE INDEX "OperationalExecution_dueDate_idx" ON "OperationalExecution"("dueDate");
CREATE INDEX "OperationalExecution_status_idx" ON "OperationalExecution"("status");
CREATE INDEX "OperationalExecution_planTaskId_status_idx" ON "OperationalExecution"("planTaskId", "status");
CREATE INDEX "OperationalExecution_registeredById_idx" ON "OperationalExecution"("registeredById");
CREATE INDEX "OperationalExecution_approvedById_idx" ON "OperationalExecution"("approvedById");
CREATE INDEX "OperationalExecution_rejectedById_idx" ON "OperationalExecution"("rejectedById");

CREATE INDEX "Evidence_executionId_idx" ON "Evidence"("executionId");
CREATE INDEX "Evidence_uploadedById_idx" ON "Evidence"("uploadedById");
CREATE INDEX "Evidence_sha256_idx" ON "Evidence"("sha256");
CREATE INDEX "Evidence_deletedAt_idx" ON "Evidence"("deletedAt");

ALTER TABLE "Plant" ADD CONSTRAINT "Plant_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Plant" ADD CONSTRAINT "Plant_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_plantId_fkey"
  FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MaintenancePlanTask" ADD CONSTRAINT "MaintenancePlanTask_plantId_fkey"
  FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MaintenancePlanTask" ADD CONSTRAINT "MaintenancePlanTask_equipmentId_fkey"
  FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MaintenancePlanTask" ADD CONSTRAINT "MaintenancePlanTask_responsibleId_fkey"
  FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OperationalExecution" ADD CONSTRAINT "OperationalExecution_planTaskId_fkey"
  FOREIGN KEY ("planTaskId") REFERENCES "MaintenancePlanTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OperationalExecution" ADD CONSTRAINT "OperationalExecution_registeredById_fkey"
  FOREIGN KEY ("registeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OperationalExecution" ADD CONSTRAINT "OperationalExecution_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OperationalExecution" ADD CONSTRAINT "OperationalExecution_rejectedById_fkey"
  FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_executionId_fkey"
  FOREIGN KEY ("executionId") REFERENCES "OperationalExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
