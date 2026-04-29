CREATE TABLE "AiInsightThread" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiInsightThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiInsightMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiInsightMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiInsightThread_userId_updatedAt_idx" ON "AiInsightThread"("userId", "updatedAt");
CREATE INDEX "AiInsightMessage_threadId_createdAt_idx" ON "AiInsightMessage"("threadId", "createdAt");

ALTER TABLE "AiInsightThread" ADD CONSTRAINT "AiInsightThread_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AiInsightMessage" ADD CONSTRAINT "AiInsightMessage_threadId_fkey"
  FOREIGN KEY ("threadId") REFERENCES "AiInsightThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
