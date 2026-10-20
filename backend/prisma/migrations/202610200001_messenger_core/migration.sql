BEGIN;
ALTER TABLE "Channel" ADD COLUMN "directKey" TEXT;
CREATE UNIQUE INDEX "Channel_directKey_key" ON "Channel"("directKey");
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_direct_private_check" CHECK ("directKey" IS NULL OR ("isPrivate" = true AND "type" = 'text'));
ALTER TABLE "ChannelMember" ADD COLUMN "typingUntil" TIMESTAMPTZ(3);
ALTER TABLE "Message" ADD COLUMN "replyToId" TEXT;
ALTER TABLE "Message" ADD CONSTRAINT "Message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Message_replyToId_idx" ON "Message"("replyToId");
CREATE TABLE "Call" (
  "id" TEXT PRIMARY KEY,
  "channelId" TEXT NOT NULL REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "callerId" TEXT NOT NULL,
  "calleeId" TEXT NOT NULL,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('audio', 'video')),
  "status" TEXT NOT NULL DEFAULT 'ringing' CHECK ("status" IN ('ringing', 'active', 'ended', 'declined')),
  "offer" TEXT,
  "answer" TEXT,
  "callerSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "calleeSeenAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Call_distinct_participants_check" CHECK ("callerId" <> "calleeId")
);
CREATE INDEX "Call_channelId_createdAt_id_idx" ON "Call"("channelId", "createdAt", "id");
CREATE INDEX "Call_calleeId_status_expiresAt_idx" ON "Call"("calleeId", "status", "expiresAt");
CREATE INDEX "Call_callerId_status_expiresAt_idx" ON "Call"("callerId", "status", "expiresAt");
COMMIT;
