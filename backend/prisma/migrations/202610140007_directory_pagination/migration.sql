-- Scoped seek pagination includes deterministic ID tie breakers. Ordinary B-tree
-- indexes require no extension privilege on managed PostgreSQL providers.
CREATE INDEX "WorkspaceMember_userId_createdAt_workspaceId_idx" ON "WorkspaceMember"("userId", "createdAt", "workspaceId");
CREATE INDEX "WorkspaceMember_workspaceId_createdAt_userId_idx" ON "WorkspaceMember"("workspaceId", "createdAt", "userId");
CREATE INDEX "Channel_workspaceId_createdAt_id_idx" ON "Channel"("workspaceId", "createdAt", "id");
CREATE INDEX "ChannelMember_channelId_createdAt_userId_idx" ON "ChannelMember"("channelId", "createdAt", "userId");
DROP INDEX "WorkspaceMember_userId_createdAt_idx";
DROP INDEX "Channel_workspaceId_createdAt_idx";
