/** Room information owns private membership controls and independent pin-history navigation. */
import React, { useEffect, useState } from "react";
import { Channel, User, ChannelMember, Message } from "../types/chat";
import { api } from "../services/api";
import { IconClose, IconUsers } from "./icons/Icons";
import { useDirectory } from "./useDirectory";
import { DirectoryControls } from "./DirectoryControls";
interface ContextDrawerProps {
  channel: Channel;
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  pins: Message[];
  pinsLoading: boolean;
  pinsReady: boolean;
  pinsHasMore: boolean;
  pinsHasNewer: boolean;
  pinsArchive: boolean;
  onLoadMorePins: () => void;
  onLoadNewerPins: () => void;
  onReloadPins: () => void;
  onMembershipChanged: (leftRoom: boolean) => Promise<void>;
  onMessageActions: (message: Message) => void;
}
export const ContextDrawer: React.FC<ContextDrawerProps> = ({
  channel,
  currentUser,
  isOpen,
  onClose,
  pins,
  pinsLoading,
  pinsReady,
  pinsHasMore,
  pinsHasNewer,
  pinsArchive,
  onLoadMorePins,
  onLoadNewerPins,
  onReloadPins,
  onMembershipChanged,
  onMessageActions,
}) => {
  const canManage = channel.canManageMembers === true;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [removing, setRemoving] = useState<User | null>(null);
  const [roomName, setRoomName] = useState(channel.name);
  const [roomTopic, setRoomTopic] = useState(channel.topic);
  const [transferId, setTransferId] = useState("");
  const [confirmationName, setConfirmationName] = useState("");
  const [roomAction, setRoomAction] = useState<"transfer" | "delete" | null>(
    null,
  );
  const roster = useDirectory<ChannelMember>(
    (query) => api.fetchChannelMembers(channel.id, query),
    channel.id,
    isOpen,
  );
  const candidates = useDirectory<User>(
    (query) => api.fetchMemberCandidates(channel.id, query),
    channel.id,
    isOpen && channel.isPrivate === true && canManage,
  );
  const members = roster.data;
  const loading = roster.loading;
  const ready = !loading && !roster.error;
  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setRemoving(null);
    setSelectedUser("");
    setRoomName(channel.name);
    setRoomTopic(channel.topic);
    setTransferId("");
    setRoomAction(null);
    setConfirmationName("");
    const timer = window.setInterval(() => {
      if (!document.hidden) {
        roster.refresh();
        if (canManage && channel.isPrivate) candidates.refresh();
      }
    }, 15000);
    return () => clearInterval(timer);
  }, [channel.id, isOpen, canManage, channel.isPrivate]);
  const manageRoom = async (action: "save" | "transfer" | "delete") => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      if (action === "save")
        await api.updateChannel(channel.id, {
          name: roomName.trim(),
          topic: roomTopic.trim(),
        });
      if (action === "transfer")
        await api.transferChannel(channel.id, transferId);
      if (action === "delete")
        await api.deleteChannel(channel.id, confirmationName);
      await onMembershipChanged(action === "delete");
      setRoomAction(null);
      setConfirmationName("");
      if (action === "transfer") roster.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The room could not be updated.",
      );
    } finally {
      setPending(false);
    }
  };
  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedUser || pending) return;
    setPending(true);
    setError("");
    try {
      await api.addChannelMember(channel.id, selectedUser);
      await onMembershipChanged(false);
      setSelectedUser("");
      roster.first();
      candidates.first();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Member could not be added.",
      );
    } finally {
      setPending(false);
    }
  };
  const remove = async () => {
    if (!removing || pending) return;
    setPending(true);
    setError("");
    const leftRoom = removing.id === currentUser.id;
    try {
      await api.removeChannelMember(channel.id, removing.id);
      await onMembershipChanged(leftRoom);
      setRemoving(null);
      if (!leftRoom) {
        roster.first();
        candidates.first();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Member could not be removed.",
      );
    } finally {
      setPending(false);
    }
  };
  if (!isOpen) return null;
  return (
    <aside
      aria-label="Room information"
      className="context-drawer w-72 h-full bg-[var(--bg-sidebar)] border-l-[3px] border-[var(--border)] flex flex-col shrink-0 z-20"
    >
      <div className="h-16 px-4 border-b-[3px] border-[var(--border)] flex items-center justify-between bg-[var(--bg-card)] shrink-0">
        <div className="flex items-center gap-2">
          <IconUsers size={15} />
          <h3 className="font-display text-sm">INSPECTOR</h3>
        </div>
        <button
          aria-label="Close room information"
          className="brutal-btn brutal-btn-outline brutal-btn-sm p-1.5"
          onClick={onClose}
        >
          <IconClose size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-6">
        <section className="space-y-2">
          <h4 className="font-display text-xs">ROOM</h4>
          <div className="brutal-card p-3">
            <p className="font-bold text-sm">#{channel.name}</p>
            <p className="text-xs mt-1">{channel.topic}</p>
            <p className="text-xs mt-2">
              {channel.isPrivate ? "Private room" : "Workspace room"}
            </p>
          </div>
          {channel.canManageChannel && (
            <div className="border-[2px] p-3 space-y-3">
              <h5 className="font-display text-xs">Manage room</h5>
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void manageRoom("save");
                }}
              >
                <label className="block text-xs font-bold">
                  Room name
                  <input
                    className="brutal-input mt-1"
                    value={roomName}
                    maxLength={80}
                    required
                    disabled={pending}
                    onChange={(event) => setRoomName(event.target.value)}
                  />
                </label>
                <label className="block text-xs font-bold">
                  Topic
                  <textarea
                    className="brutal-input mt-1"
                    value={roomTopic}
                    maxLength={500}
                    disabled={pending}
                    onChange={(event) => setRoomTopic(event.target.value)}
                  />
                </label>
                <button
                  className="brutal-btn brutal-btn-sm"
                  disabled={
                    pending ||
                    !roomName.trim() ||
                    (roomName.trim() === channel.name &&
                      roomTopic.trim() === channel.topic)
                  }
                >
                  Save room
                </button>
              </form>
              <button
                className="brutal-btn brutal-btn-outline brutal-btn-sm"
                disabled={pending}
                onClick={() => setRoomAction("transfer")}
              >
                Transfer ownership
              </button>
              <button
                className="brutal-btn brutal-btn-outline brutal-btn-sm"
                disabled={pending}
                onClick={() => setRoomAction("delete")}
              >
                Delete room
              </button>
              {roomAction === "transfer" && (
                <div className="space-y-2 border-t-[2px] pt-2">
                  <p className="text-xs">
                    Choose a member from the room directory below. Ownership
                    gives them room management access.
                  </p>
                  <label className="block text-xs font-bold">
                    New room owner
                    <select
                      className="brutal-input mt-1"
                      value={transferId}
                      disabled={pending || roster.loading}
                      onChange={(event) => setTransferId(event.target.value)}
                    >
                      <option value="">Choose room member</option>
                      {members
                        .filter((member) => member.id !== channel.createdById)
                        .map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <button
                    className="brutal-btn brutal-btn-sm"
                    disabled={pending || !transferId}
                    onClick={() => void manageRoom("transfer")}
                  >
                    Confirm transfer
                  </button>
                  <button
                    className="brutal-btn brutal-btn-outline brutal-btn-sm"
                    disabled={pending}
                    onClick={() => setRoomAction(null)}
                  >
                    Cancel
                  </button>
                </div>
              )}
              {roomAction === "delete" && (
                <div className="space-y-2 border-t-[2px] pt-2">
                  <p className="text-xs">
                    Permanently delete this room and all its messages, pins and
                    reactions. This cannot be undone.
                  </p>
                  <label className="block text-xs font-bold">
                    Type {channel.name} to confirm
                    <input
                      className="brutal-input mt-1"
                      value={confirmationName}
                      maxLength={80}
                      disabled={pending}
                      autoComplete="off"
                      onChange={(event) =>
                        setConfirmationName(event.target.value)
                      }
                    />
                  </label>
                  <button
                    className="brutal-btn brutal-btn-pink brutal-btn-sm"
                    disabled={pending || confirmationName !== channel.name}
                    onClick={() => void manageRoom("delete")}
                  >
                    Permanently delete room
                  </button>
                  <button
                    className="brutal-btn brutal-btn-outline brutal-btn-sm"
                    disabled={pending}
                    onClick={() => setRoomAction(null)}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
        <section className="space-y-3">
          <h4 className="font-display text-xs">
            ROOM MEMBERS {ready ? `(${roster.total})` : ""}
          </h4>
          <section aria-label="Room member directory">
            <DirectoryControls label="Search room members" directory={roster} />
          </section>
          {loading && (
            <p role="status" className="text-xs">
              Loading room members...
            </p>
          )}
          {error && (
            <div>
              <p role="alert" className="text-xs">
                {error}
              </p>
              <button
                className="brutal-btn brutal-btn-sm mt-2"
                onClick={roster.refresh}
              >
                Retry members
              </button>
            </div>
          )}
          {ready &&
            members.map((member) => (
              <div
                key={member.id}
                className="border-[2px] bg-[var(--bg-card)] p-2 space-y-2"
              >
                <div className="flex gap-2 items-center">
                  <span className="border-[2px] p-1 font-mono-code text-xs">
                    {member.monogram}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{member.name}</p>
                    <p className="text-[10px]">
                      {member.channelRole === "creator"
                        ? "Room creator"
                        : member.workspaceRole === "owner"
                          ? "Workspace owner"
                          : member.workspaceRole === "admin"
                            ? "Workspace admin"
                            : "Member"}
                    </p>
                  </div>
                </div>
                {channel.isPrivate &&
                  canManage &&
                  member.canRemove &&
                  member.id !== currentUser.id && (
                    <button
                      className="brutal-btn brutal-btn-outline brutal-btn-sm"
                      disabled={pending}
                      aria-label={`Remove ${member.name}`}
                      onClick={() => setRemoving(member)}
                    >
                      Remove member
                    </button>
                  )}
              </div>
            ))}
          {ready && !members.length && (
            <p className="text-xs">No room members.</p>
          )}
          {ready && channel.isPrivate && canManage && (
            <form onSubmit={add} className="space-y-2">
              <section aria-label="Available workspace members">
                <DirectoryControls
                  label="Search workspace members"
                  directory={candidates}
                />
              </section>
              <label className="block text-xs font-bold">
                Add workspace member
                <select
                  aria-label="Add workspace member"
                  className="brutal-input mt-2"
                  value={selectedUser}
                  onChange={(event) => setSelectedUser(event.target.value)}
                  disabled={pending || candidates.loading}
                >
                  <option value="">Select workspace member</option>
                  {candidates.data.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="brutal-btn brutal-btn-sm"
                disabled={pending || candidates.loading || !selectedUser}
              >
                {pending ? "Saving..." : "Add member"}
              </button>
            </form>
          )}
          {ready && channel.isPrivate && channel.canLeave && (
            <button
              className="brutal-btn brutal-btn-outline brutal-btn-sm"
              disabled={pending}
              onClick={() => setRemoving(currentUser)}
            >
              Leave room
            </button>
          )}
          {removing && (
            <div
              role="group"
              aria-label="Membership confirmation"
              className="border-[3px] bg-[var(--bg-card-alt)] p-3 space-y-3"
            >
              <p className="text-xs">
                {removing.id === currentUser.id
                  ? "Leave this private room? You will lose access to its messages."
                  : "Remove this member from the private room?"}
              </p>
              <p className="text-xs font-bold">{removing.name}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  className="brutal-btn brutal-btn-pink brutal-btn-sm"
                  disabled={pending}
                  onClick={remove}
                >
                  {pending
                    ? "Saving..."
                    : removing.id === currentUser.id
                      ? "Leave room"
                      : "Remove member"}
                </button>
                <button
                  className="brutal-btn brutal-btn-outline brutal-btn-sm"
                  disabled={pending}
                  onClick={() => setRemoving(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
        <section className="space-y-3">
          <h4 className="font-display text-xs">PINNED MESSAGES</h4>
          {pinsLoading && (
            <p role="status" className="text-xs">
              Loading pinned messages...
            </p>
          )}
          {!pinsLoading && !pinsReady && (
            <button className="brutal-btn brutal-btn-sm" onClick={onReloadPins}>
              Retry pinned messages
            </button>
          )}
          {pins.map((message) => (
            <div
              key={message.id}
              data-pin-id={message.id}
              className="brutal-card p-3 space-y-2"
            >
              <p className="text-xs break-words">{message.content}</p>
              <p className="text-xs">{message.sender.name}</p>
              <button
                className="brutal-btn brutal-btn-sm brutal-btn-outline"
                onClick={() => onMessageActions(message)}
              >
                Message actions
              </button>
            </div>
          ))}
          {pinsReady && !pinsLoading && !pins.length && (
            <p className="text-xs">No pinned messages.</p>
          )}
          {pinsHasMore && (
            <button
              className="brutal-btn brutal-btn-sm"
              disabled={pinsLoading}
              onClick={onLoadMorePins}
            >
              Earlier pins
            </button>
          )}
          {pinsHasNewer && (
            <button
              className="brutal-btn brutal-btn-sm"
              disabled={pinsLoading}
              onClick={onLoadNewerPins}
            >
              Newer pins
            </button>
          )}
          {pinsArchive && (
            <button
              className="brutal-btn brutal-btn-sm"
              disabled={pinsLoading}
              onClick={onReloadPins}
            >
              Latest pins
            </button>
          )}
        </section>
      </div>
    </aside>
  );
};
