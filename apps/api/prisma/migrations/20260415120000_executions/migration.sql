-- ExecStatus enum
CREATE TYPE "ExecStatus" AS ENUM ('PENDING', 'DONE', 'OVERDUE', 'SKIPPED');

-- MaintenanceTask: discrepancy flag
ALTER TABLE "MaintenanceTask" ADD COLUMN "hasDiscrepancy" BOOLEAN NOT NULL DEFAULT false;

-- MonthlySchedule: source column (EXCEL | CALC)
ALTER TABLE "MonthlySchedule" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'EXCEL';

-- TaskExecution
CREATE TABLE "TaskExecution" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "doneDate" TIMESTAMP(3),
    "hhPlanned" DECIMAL(10,2) NOT NULL,
    "hhActual" DECIMAL(10,2),
    "status" "ExecStatus" NOT NULL DEFAULT 'PENDING',
    "operator" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TaskExecution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaskExecution_taskId_dueDate_key" ON "TaskExecution"("taskId", "dueDate");
CREATE INDEX "TaskExecution_dueDate_idx" ON "TaskExecution"("dueDate");
CREATE INDEX "TaskExecution_status_idx" ON "TaskExecution"("status");
CREATE INDEX "TaskExecution_taskId_status_idx" ON "TaskExecution"("taskId", "status");

ALTER TABLE "TaskExecution" ADD CONSTRAINT "TaskExecution_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "MaintenanceTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
