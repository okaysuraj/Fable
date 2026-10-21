-- CreateTable
CREATE TABLE "GroupCall" (
    "id" UUID NOT NULL,
    "channelId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMPTZ(3),

    CONSTRAINT "GroupCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupCallParticipant" (
    "callId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" UUID NOT NULL,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMPTZ(3),

    CONSTRAINT "GroupCallParticipant_pkey" PRIMARY KEY ("callId","userId")
);

-- CreateIndex
CREATE INDEX "GroupCall_channelId_endedAt_idx" ON "GroupCall"("channelId", "endedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GroupCallParticipant_sessionId_key" ON "GroupCallParticipant"("sessionId");

-- CreateIndex
CREATE INDEX "GroupCallParticipant_userId_leftAt_lastSeenAt_idx" ON "GroupCallParticipant"("userId", "leftAt", "lastSeenAt");

-- AddForeignKey
ALTER TABLE "GroupCall" ADD CONSTRAINT "GroupCall_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupCallParticipant" ADD CONSTRAINT "GroupCallParticipant_callId_fkey" FOREIGN KEY ("callId") REFERENCES "GroupCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupCallParticipant" ADD CONSTRAINT "GroupCallParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "GroupCall_one_live_channel" ON "GroupCall" ("channelId") WHERE "endedAt" IS NULL;
ALTER TABLE "GroupCall" ADD CONSTRAINT "GroupCall_kind_check" CHECK ("kind" IN ('audio', 'video'));
