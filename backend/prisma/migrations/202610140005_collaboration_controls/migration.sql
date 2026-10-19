BEGIN;
-- AlterTable
ALTER TABLE "Channel" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "deletedAt" TIMESTAMPTZ(3),
ADD COLUMN     "editedAt" TIMESTAMPTZ(3),
ADD COLUMN     "updatedAt" TIMESTAMPTZ(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "MessageChange" (
    "sequence" BIGSERIAL NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageChange_pkey" PRIMARY KEY ("sequence")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageChange_channelId_sequence_idx" ON "MessageChange"("channelId", "sequence");

-- CreateIndex
CREATE INDEX "MessageChange_messageId_idx" ON "MessageChange"("messageId");

-- CreateIndex
CREATE INDEX "AuditEvent_workspaceId_createdAt_id_idx" ON "AuditEvent"("workspaceId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Message_channelId_isPinned_createdAt_id_idx" ON "Message"("channelId", "isPinned", "createdAt", "id");

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageChange" ADD CONSTRAINT "MessageChange_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageChange" ADD CONSTRAINT "MessageChange_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "Message" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "Message" ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE "Message" ADD CONSTRAINT "Message_version_check" CHECK ("version" > 0);
ALTER TABLE "Message" ADD CONSTRAINT "Message_tombstone_check" CHECK ("deletedAt" IS NULL OR ("content" = '' AND "codeSnippet" IS NULL AND "voiceNote" IS NULL AND "attachments" IS NULL AND "isPinned" = FALSE));
COMMIT;
