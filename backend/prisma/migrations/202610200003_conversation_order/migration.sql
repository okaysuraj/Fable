BEGIN;
ALTER TABLE "Channel" ADD COLUMN "lastMessageAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "Channel" c SET "lastMessageAt" = COALESCE((SELECT max(m."createdAt") FROM "Message" m WHERE m."channelId" = c."id"), c."createdAt");
CREATE INDEX "Channel_workspaceId_lastMessageAt_id_idx" ON "Channel"("workspaceId", "lastMessageAt", "id");
COMMIT;
