-- AlterTable
ALTER TABLE "User" ADD COLUMN     "photoStorageKey" TEXT;

-- AlterTable
-- Backfill existing call records without changing their IDs or history.
ALTER TABLE "Call" ADD COLUMN "nativeId" UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "Call" ALTER COLUMN "nativeId" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "storageKey" TEXT,
ALTER COLUMN "bytes" DROP NOT NULL;

-- AlterTable
ALTER TABLE "WorkspaceSetting" ADD COLUMN     "notificationPreviews" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "StorageObject" (
    "key" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorageObject_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "DeviceInstallation" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "voipToken" TEXT,
    "sandbox" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserEvent" (
    "id" BIGSERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "channelId" TEXT,
    "workspaceId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushDelivery" (
    "id" BIGSERIAL NOT NULL,
    "eventId" BIGINT NOT NULL,
    "deviceId" UUID NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMPTZ(3),
    "leaseOwner" UUID,
    "completedAt" TIMESTAMPTZ(3),
    "errorCode" TEXT,

    CONSTRAINT "PushDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationNotification" (
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "muted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ConversationNotification_pkey" PRIMARY KEY ("userId","channelId")
);

-- CreateIndex
CREATE INDEX "StorageObject_createdAt_key_idx" ON "StorageObject"("createdAt", "key");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceInstallation_token_key" ON "DeviceInstallation"("token");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceInstallation_voipToken_key" ON "DeviceInstallation"("voipToken");

-- CreateIndex
CREATE INDEX "DeviceInstallation_userId_enabled_idx" ON "DeviceInstallation"("userId", "enabled");

-- CreateIndex
CREATE INDEX "UserEvent_userId_id_idx" ON "UserEvent"("userId", "id");

-- CreateIndex
CREATE INDEX "UserEvent_createdAt_id_idx" ON "UserEvent"("createdAt", "id");

-- CreateIndex
CREATE INDEX "PushDelivery_completedAt_availableAt_leaseUntil_idx" ON "PushDelivery"("completedAt", "availableAt", "leaseUntil");

-- CreateIndex
CREATE UNIQUE INDEX "PushDelivery_eventId_deviceId_key" ON "PushDelivery"("eventId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "User_photoStorageKey_key" ON "User"("photoStorageKey");

-- CreateIndex
CREATE UNIQUE INDEX "Call_nativeId_key" ON "Call"("nativeId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_photoStorageKey_fkey" FOREIGN KEY ("photoStorageKey") REFERENCES "StorageObject"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_storageKey_fkey" FOREIGN KEY ("storageKey") REFERENCES "StorageObject"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceInstallation" ADD CONSTRAINT "DeviceInstallation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEvent" ADD CONSTRAINT "UserEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushDelivery" ADD CONSTRAINT "PushDelivery_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "UserEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushDelivery" ADD CONSTRAINT "PushDelivery_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "DeviceInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationNotification" ADD CONSTRAINT "ConversationNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationNotification" ADD CONSTRAINT "ConversationNotification_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Legacy database bytes remain readable until the explicit media migration finishes.
ALTER TABLE "User" DROP CONSTRAINT "User_photo_bounds";
ALTER TABLE "User" ADD CONSTRAINT "User_photo_bounds" CHECK (
  ("photoBytes" IS NULL AND "photoStorageKey" IS NULL AND "photoMimeType" IS NULL) OR
  ("photoMimeType" IS NOT NULL AND "photoMimeType" IN ('image/jpeg', 'image/png', 'image/webp') AND
   num_nonnulls("photoBytes", "photoStorageKey") = 1 AND
   ("photoBytes" IS NULL OR octet_length("photoBytes") BETWEEN 1 AND 2097152))
);
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_storage_check" CHECK (num_nonnulls("bytes", "storageKey") = 1);
ALTER TABLE "StorageObject" ADD CONSTRAINT "StorageObject_size_check" CHECK ("size" BETWEEN 1 AND 10485760);
ALTER TABLE "DeviceInstallation" ADD CONSTRAINT "DeviceInstallation_provider_check" CHECK ("provider" IN ('apns', 'fcm'));
ALTER TABLE "PushDelivery" ADD CONSTRAINT "PushDelivery_attempts_check" CHECK ("attempts" >= 0);
