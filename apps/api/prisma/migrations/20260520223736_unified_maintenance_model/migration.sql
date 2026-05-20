-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('PREVENTIVA', 'CORRECTIVA', 'PREDICTIVA');

-- AlterTable
ALTER TABLE "Evidence" ADD COLUMN     "taskExecutionId" TEXT,
ALTER COLUMN "executionId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MaintenanceTask" ADD COLUMN     "descripcion" TEXT,
ADD COLUMN     "responsable" TEXT,
ADD COLUMN     "tipo" "MaintenanceType" NOT NULL DEFAULT 'PREVENTIVA',
ADD COLUMN     "titulo" TEXT;

-- CreateIndex
CREATE INDEX "Evidence_taskExecutionId_idx" ON "Evidence"("taskExecutionId");

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_taskExecutionId_fkey" FOREIGN KEY ("taskExecutionId") REFERENCES "TaskExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: el título de la mantención parte de la descripción de posición importada.
UPDATE "MaintenanceTask"
SET "titulo" = "descPosicionMant"
WHERE "titulo" IS NULL AND "descPosicionMant" IS NOT NULL;
