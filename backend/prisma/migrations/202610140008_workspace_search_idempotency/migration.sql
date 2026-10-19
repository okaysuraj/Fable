-- Additive migration. Existing content and memberships are preserved.
-- A normal GIN build takes a write lock on Message; schedule an appropriate
-- migration window, or prebuild this same index CONCURRENTLY outside a transaction
-- on a large installation before deploying this migration.
BEGIN;
ALTER TABLE "Message" ADD COLUMN "clientMutationId" TEXT, ADD COLUMN "clientMutationHash" TEXT;
ALTER TABLE "Message" ADD CONSTRAINT "Message_clientMutation_pair_check" CHECK (
  ("clientMutationId" IS NULL AND "clientMutationHash" IS NULL) OR
  ("clientMutationId" IS NOT NULL AND "clientMutationHash" IS NOT NULL
    AND "clientMutationId" ~ '^[A-Za-z0-9_-]{1,128}$' AND "clientMutationHash" ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX "Message_channelId_senderId_clientMutationId_key" ON "Message"("channelId", "senderId", "clientMutationId");
CREATE INDEX "Invitation_workspaceId_createdAt_id_idx" ON "Invitation"("workspaceId", "createdAt", "id");
CREATE INDEX IF NOT EXISTS "Message_search_live_idx" ON "Message" USING GIN (
  to_tsvector('simple', "content" || ' ' || COALESCE("codeSnippet"->>'code', ''))
) WHERE "deletedAt" IS NULL;
COMMIT;
