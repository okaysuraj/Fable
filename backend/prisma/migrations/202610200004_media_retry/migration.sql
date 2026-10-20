BEGIN;
ALTER TABLE "MediaAsset" ADD COLUMN "digest" TEXT;
CREATE INDEX "MediaAsset_ownerId_channelId_digest_idx" ON "MediaAsset"("ownerId", "channelId", "digest");
COMMIT;
