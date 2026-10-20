BEGIN;
CREATE TABLE "MediaAsset" (
  "id" TEXT PRIMARY KEY,
  "channelId" TEXT NOT NULL REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "ownerId" TEXT NOT NULL,
  "messageId" TEXT REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL CHECK ("size" > 0 AND "size" <= 10485760),
  "bytes" BYTEA NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MediaAsset_bytes_length_check" CHECK (octet_length("bytes") = "size")
);
CREATE INDEX "MediaAsset_channelId_ownerId_idx" ON "MediaAsset"("channelId", "ownerId");
CREATE INDEX "MediaAsset_messageId_idx" ON "MediaAsset"("messageId");
CREATE INDEX "MediaAsset_ownerId_createdAt_idx" ON "MediaAsset"("ownerId", "createdAt");
COMMIT;
