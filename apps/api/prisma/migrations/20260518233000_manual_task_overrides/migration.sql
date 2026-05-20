ALTER TABLE "MaintenanceTask" ADD COLUMN IF NOT EXISTS "manualOverride" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MaintenanceTask" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "MaintenanceTask_manualOverride_idx" ON "MaintenanceTask"("manualOverride");
CREATE INDEX IF NOT EXISTS "MaintenanceTask_deletedAt_idx" ON "MaintenanceTask"("deletedAt");
