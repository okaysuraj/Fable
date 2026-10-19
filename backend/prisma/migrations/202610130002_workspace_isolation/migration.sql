BEGIN;
-- Preserve obsolete display/call metadata before removing denormalized columns.
CREATE TABLE "LegacyArchive" (
  "id" TEXT PRIMARY KEY, "kind" TEXT NOT NULL, "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "LegacyArchive" ("id", "kind", "payload")
SELECT 'channel_' || "id", 'channel', to_jsonb(c) FROM "Channel" c;
INSERT INTO "LegacyArchive" ("id", "kind", "payload")
SELECT 'message_' || "id", 'message-metadata', jsonb_build_object('id', "id", 'timestamp', "timestamp") FROM "Message";
-- Obsolete bcrypt credentials are intentionally removed. Firebase UIDs require explicit administrator migration.
-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_senderId_fkey";

-- AlterTable
ALTER TABLE "Account" DROP COLUMN "password",
ADD COLUMN     "firebaseUid" TEXT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'Member',
ALTER COLUMN "status" SET DEFAULT 'offline';

-- AlterTable
ALTER TABLE "Channel" DROP COLUMN "activeCall",
DROP COLUMN "memberCount",
DROP COLUMN "unreadCount",
ADD COLUMN     "workspaceId" TEXT,
ALTER COLUMN "topic" SET DEFAULT '';

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "timestamp";

-- AlterTable
ALTER TABLE "WorkspaceSetting" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("workspaceId","userId")
);

-- CreateTable
CREATE TABLE "ChannelMember" (
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelMember_pkey" PRIMARY KEY ("channelId","userId")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_createdAt_idx" ON "WorkspaceMember"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ChannelMember_userId_idx" ON "ChannelMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_workspaceId_email_idx" ON "Invitation"("workspaceId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_firebaseUid_key" ON "Account"("firebaseUid");

-- CreateIndex
CREATE INDEX "Channel_workspaceId_createdAt_idx" ON "Channel"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_workspaceId_name_key" ON "Channel"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "Message_channelId_createdAt_id_idx" ON "Message"("channelId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "Reaction_userId_idx" ON "Reaction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceSetting_userId_key" ON "WorkspaceSetting"("userId");

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey


-- AddForeignKey
ALTER TABLE "ChannelMember" ADD CONSTRAINT "ChannelMember_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMember" ADD CONSTRAINT "ChannelMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceSetting" ADD CONSTRAINT "WorkspaceSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing channels are quarantined with no members; never grant historic shared data to new accounts.
INSERT INTO "Workspace" ("id", "name", "updatedAt")
SELECT 'legacy_' || "id", 'Archived channel: ' || "name", CURRENT_TIMESTAMP FROM "Channel";
UPDATE "Channel" SET "workspaceId" = 'legacy_' || "id" WHERE "workspaceId" IS NULL;
ALTER TABLE "Channel" ALTER COLUMN "workspaceId" SET NOT NULL;
-- Preserve old account records, provision an empty personal workspace, and require explicit Firebase UID linking.
INSERT INTO "Workspace" ("id", "name", "updatedAt")
SELECT 'personal_' || u."id", u."name" || '''s workspace', CURRENT_TIMESTAMP FROM "User" u INNER JOIN "Account" a ON a."userId" = u."id";
INSERT INTO "WorkspaceMember" ("workspaceId", "userId", "role")
SELECT 'personal_' || "userId", "userId", 'owner' FROM "Account";
INSERT INTO "Channel" ("id", "workspaceId", "name", "topic", "type", "updatedAt")
SELECT 'general_' || "userId", 'personal_' || "userId", 'general', '', 'text', CURRENT_TIMESTAMP FROM "Account";
INSERT INTO "ChannelMember" ("channelId", "userId") SELECT 'general_' || "userId", "userId" FROM "Account";
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_type_check" CHECK ("type" IN ('text', 'audio', 'video'));
ALTER TABLE "User" ADD CONSTRAINT "User_status_check" CHECK ("status" IN ('online', 'idle', 'in-huddle', 'offline'));
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_role_check" CHECK ("role" IN ('owner', 'admin', 'member'));
ALTER TABLE "WorkspaceSetting" ADD CONSTRAINT "WorkspaceSetting_volume_check" CHECK ("inputVolume" BETWEEN 0 AND 100 AND "outputVolume" BETWEEN 0 AND 100);
ALTER TABLE "WorkspaceSetting" ADD CONSTRAINT "WorkspaceSetting_theme_check" CHECK ("theme" IN ('light', 'dark'));
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;
