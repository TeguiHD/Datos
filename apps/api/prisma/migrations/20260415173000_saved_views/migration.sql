CREATE TABLE "ScheduleSavedView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScheduleSavedView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScheduleSavedView_userId_name_key" ON "ScheduleSavedView"("userId", "name");
CREATE INDEX "ScheduleSavedView_userId_updatedAt_idx" ON "ScheduleSavedView"("userId", "updatedAt");

ALTER TABLE "ScheduleSavedView" ADD CONSTRAINT "ScheduleSavedView_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
