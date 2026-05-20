-- Minimal SAP PM plant catalog: aliases + task association.
ALTER TYPE "PlantStatus" ADD VALUE IF NOT EXISTS 'STANDBY';

ALTER TABLE "MaintenanceTask" ADD COLUMN IF NOT EXISTS "plantId" TEXT;

CREATE TABLE IF NOT EXISTS "PlantAlias" (
  "id" TEXT NOT NULL,
  "plantId" TEXT NOT NULL,
  "alias" TEXT NOT NULL,
  "normalizedAlias" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'SYSTEM',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlantAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlantAlias_normalizedAlias_key" ON "PlantAlias"("normalizedAlias");
CREATE INDEX IF NOT EXISTS "PlantAlias_plantId_idx" ON "PlantAlias"("plantId");
CREATE INDEX IF NOT EXISTS "MaintenanceTask_plantId_idx" ON "MaintenanceTask"("plantId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MaintenanceTask_plantId_fkey'
  ) THEN
    ALTER TABLE "MaintenanceTask"
      ADD CONSTRAINT "MaintenanceTask_plantId_fkey"
      FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PlantAlias_plantId_fkey'
  ) THEN
    ALTER TABLE "PlantAlias"
      ADD CONSTRAINT "PlantAlias_plantId_fkey"
      FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "TaskExecution" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'CALC';
CREATE INDEX IF NOT EXISTS "TaskExecution_source_idx" ON "TaskExecution"("source");
