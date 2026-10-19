-- Exact read cursors retain the message ID alongside its creation timestamp.
-- Tombstones keep the original ID/time, so edited/deleted cursor messages stay valid.
ALTER TABLE "ChannelMember" ADD COLUMN "lastReadMessageId" TEXT;
