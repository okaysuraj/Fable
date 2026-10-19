/** Workspace creation, invitations and role changes use the same authorized API as mobile. */
import { useEffect, useRef, useState } from "react";
import { api, Workspace } from "../services/api";
import { User } from "../types/chat";
import { DirectoryControls } from "./DirectoryControls";
import { useDirectory } from "./useDirectory";
import { useDialog } from "./useDialog";
import { WorkspaceActivity } from "./WorkspaceActivity";

type Confirmation =
  | {
      kind: "remove" | "role" | "transfer";
      member: User;
      role?: "admin" | "member";
    }
  | { kind: "leave" }
  | { kind: "revoke"; id: string; email: string };
interface Props {
  workspace?: Workspace;
  currentUser: User;
  onClose: () => void;
  onSwitch: (id: string) => void;
  onChanged: () => Promise<void>;
}

export function WorkspaceDialog({
  workspace,
  currentUser,
  onClose,
  onSwitch,
  onChanged,
}: Props) {
  const [tab, setTab] = useState<
    "overview" | "members" | "invitations" | "activity"
  >("overview");
  const [name, setName] = useState(workspace?.name || "");
  const [newName, setNewName] = useState("");
  const [email, setEmail] = useState("");
  const [joinToken, setJoinToken] = useState("");
  const [issued, setIssued] = useState<{
    token: string;
    expiresAt: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const managed = workspace?.role === "owner" || workspace?.role === "admin";
  const owner = workspace?.role === "owner";
  const members = useDirectory(
    api.fetchTeamDirectory,
    workspace?.id || "",
    tab === "members" && !!workspace,
  );
  const invitations = useDirectory(
    api.fetchInvitations,
    workspace?.id || "",
    tab === "invitations" && !!workspace && managed,
  );
  useDialog(true, dialogRef, () => {
    if (!busy) onClose();
  });
  useEffect(() => {
    setName(workspace?.name || "");
  }, [workspace?.name]);

  const run = async (action: () => Promise<void>, success?: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      if (success) setNotice(success);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "The change could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  };
  const switchTo = (id: string) => {
    onSwitch(id);
    onClose();
  };
  const confirm = () =>
    void run(async () => {
      if (!confirmation || !workspace) return;
      if (confirmation.kind === "leave") {
        await api.leaveWorkspace(workspace.id);
        const available = await api.fetchWorkspaces();
        if (!available.currentWorkspaceId)
          throw new Error("Choose or create a workspace to continue.");
        switchTo(available.currentWorkspaceId);
        return;
      }
      if (confirmation.kind === "revoke") {
        await api.revokeInvitation(confirmation.id);
        setIssued(null);
        invitations.refresh();
      } else {
        if (confirmation.kind === "remove")
          await api.removeWorkspaceMember(workspace.id, confirmation.member.id);
        if (confirmation.kind === "role" && confirmation.role)
          await api.setWorkspaceRole(
            workspace.id,
            confirmation.member.id,
            confirmation.role,
          );
        if (confirmation.kind === "transfer")
          await api.transferWorkspace(workspace.id, confirmation.member.id);
        await onChanged();
        members.refresh();
      }
      setConfirmation(null);
    }, "Workspace updated.");
  const description =
    confirmation?.kind === "leave"
      ? "Leave this workspace? You will lose access to all its rooms and messages."
      : confirmation?.kind === "remove"
        ? `Remove ${confirmation.member.name} from the workspace and all of its private rooms?`
        : confirmation?.kind === "role"
          ? `Change ${confirmation.member.name} to ${confirmation.role}? Their permissions will change immediately.`
          : confirmation?.kind === "transfer"
            ? `Make ${confirmation.member.name} the workspace owner? You will become an administrator and lose ownership controls.`
            : confirmation?.kind === "revoke"
              ? `Revoke the invitation for ${confirmation.email}? Its token will stop working.`
              : "";
  const controls = (
    directory: typeof members | typeof invitations,
    label: string,
  ) => <DirectoryControls label={label} directory={directory} />;

  return (
    <div
      className="fixed inset-0 z-50 p-4 bg-black/50 flex items-center justify-center"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-dialog-title"
        className="brutal-card p-5 sm:p-6 max-w-2xl w-full max-h-[90dvh] overflow-auto space-y-5"
        onClick={(event) => event.stopPropagation()}
        aria-busy={busy}
      >
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0">
            <h2 id="workspace-dialog-title" className="font-display text-xl">
              Workspace management
            </h2>
            <p className="text-sm break-words">
              {workspace?.name || "Your workspaces"}
              {workspace && ` · ${workspace.role}`}
            </p>
          </div>
          <button
            className="brutal-btn brutal-btn-sm"
            disabled={busy}
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <nav aria-label="Workspace sections" className="flex flex-wrap gap-2">
          <button
            className={`brutal-btn brutal-btn-sm ${tab === "overview" ? "" : "brutal-btn-outline"}`}
            aria-pressed={tab === "overview"}
            disabled={busy}
            onClick={() => setTab("overview")}
          >
            Overview
          </button>
          {workspace && (
            <button
              className={`brutal-btn brutal-btn-sm ${tab === "members" ? "" : "brutal-btn-outline"}`}
              aria-pressed={tab === "members"}
              disabled={busy}
              onClick={() => setTab("members")}
            >
              Members
            </button>
          )}
          {managed && (
            <button
              className={`brutal-btn brutal-btn-sm ${tab === "invitations" ? "" : "brutal-btn-outline"}`}
              aria-pressed={tab === "invitations"}
              disabled={busy}
              onClick={() => setTab("invitations")}
            >
              Invitations
            </button>
          )}
          {managed && (
            <button
              className={`brutal-btn brutal-btn-sm ${tab === "activity" ? "" : "brutal-btn-outline"}`}
              aria-pressed={tab === "activity"}
              disabled={busy}
              onClick={() => setTab("activity")}
            >
              Activity
            </button>
          )}
        </nav>
        {error && (
          <p role="alert" className="border-[2px] p-3 text-sm">
            {error}
          </p>
        )}
        {(notice || busy) && (
          <p role="status" className="text-sm">
            {busy ? "Saving…" : notice}
          </p>
        )}
        {confirmation && (
          <section
            aria-label="Confirm workspace change"
            className="border-[3px] bg-[var(--bg-card-alt)] p-4 space-y-3"
          >
            <p className="text-sm">{description}</p>
            <div className="flex flex-wrap gap-2">
              <button
                className="brutal-btn brutal-btn-pink brutal-btn-sm"
                disabled={busy}
                onClick={confirm}
              >
                Confirm change
              </button>
              <button
                className="brutal-btn brutal-btn-outline brutal-btn-sm"
                disabled={busy}
                onClick={() => setConfirmation(null)}
              >
                Cancel
              </button>
            </div>
          </section>
        )}
        <fieldset
          disabled={busy || !!confirmation}
          className="space-y-5 min-w-0"
        >
          {tab === "activity" && managed && workspace && (
            <WorkspaceActivity workspaceId={workspace.id} />
          )}
          {tab === "overview" && (
            <>
              {workspace && managed && (
                <form
                  className="space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(async () => {
                      await api.renameWorkspace(workspace.id, name.trim());
                      await onChanged();
                    }, "Workspace name saved.");
                  }}
                >
                  <label className="block text-sm font-bold">
                    Workspace name
                    <input
                      className="brutal-input mt-2"
                      value={name}
                      maxLength={80}
                      required
                      onChange={(event) => setName(event.target.value)}
                    />
                  </label>
                  <button
                    className="brutal-btn brutal-btn-sm"
                    disabled={!name.trim() || name.trim() === workspace.name}
                  >
                    Save name
                  </button>
                </form>
              )}
              <form
                className="space-y-3 border-t-[2px] pt-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    switchTo(
                      (await api.createWorkspace(newName.trim())).data.id,
                    );
                  });
                }}
              >
                <h3 className="font-display">Create a workspace</h3>
                <p className="text-xs">
                  A separate space with its own members and rooms.
                </p>
                <label className="block text-sm font-bold">
                  New workspace name
                  <input
                    className="brutal-input mt-2"
                    value={newName}
                    maxLength={80}
                    required
                    onChange={(event) => setNewName(event.target.value)}
                  />
                </label>
                <button
                  className="brutal-btn brutal-btn-sm"
                  disabled={!newName.trim()}
                >
                  Create workspace
                </button>
              </form>
              <form
                className="space-y-3 border-t-[2px] pt-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    switchTo(
                      (await api.joinWorkspace(joinToken.trim())).data
                        .workspaceId,
                    );
                  });
                }}
              >
                <h3 className="font-display">Join a workspace</h3>
                <label className="block text-sm font-bold">
                  Invitation token
                  <input
                    className="brutal-input mt-2"
                    value={joinToken}
                    maxLength={512}
                    required
                    autoComplete="off"
                    onChange={(event) => setJoinToken(event.target.value)}
                  />
                </label>
                <p className="text-xs">
                  Your verified account email must match the invitation.
                </p>
                <button
                  className="brutal-btn brutal-btn-sm"
                  disabled={!joinToken.trim()}
                >
                  Join workspace
                </button>
              </form>
              {workspace && (
                <section className="border-t-[2px] pt-4 space-y-2">
                  <h3 className="font-display">Leave workspace</h3>
                  {owner ? (
                    <p className="text-sm">
                      Transfer ownership to another member before leaving.
                    </p>
                  ) : (
                    <>
                      <p className="text-sm">
                        You will lose access to the workspace and its
                        conversations. Transfer any rooms you own first.
                      </p>
                      <button
                        className="brutal-btn brutal-btn-outline brutal-btn-sm"
                        onClick={() => setConfirmation({ kind: "leave" })}
                      >
                        Leave workspace
                      </button>
                    </>
                  )}
                </section>
              )}
            </>
          )}
          {tab === "members" && (
            <section className="space-y-3">
              {controls(members, "Search workspace members")}
              {!members.loading && !members.error && !members.data.length && (
                <p className="text-sm">No matching members.</p>
              )}
              {members.data.map((member) => (
                <article key={member.id} className="border-[2px] p-3 space-y-3">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold break-words">
                        {member.name}
                        {member.id === currentUser.id ? " (you)" : ""}
                      </p>
                      <p className="text-xs">
                        {member.statusText || member.handle}
                      </p>
                    </div>
                    <span className="text-xs font-bold">
                      {member.workspaceRole || "member"}
                    </span>
                  </div>
                  {member.id !== currentUser.id &&
                    member.workspaceRole !== "owner" && (
                      <div className="flex flex-wrap gap-2">
                        {owner && (
                          <button
                            className="brutal-btn brutal-btn-outline brutal-btn-sm"
                            onClick={() =>
                              setConfirmation({
                                kind: "role",
                                member,
                                role:
                                  member.workspaceRole === "admin"
                                    ? "member"
                                    : "admin",
                              })
                            }
                          >
                            {member.workspaceRole === "admin"
                              ? "Make member"
                              : "Make admin"}
                          </button>
                        )}
                        {owner && (
                          <button
                            className="brutal-btn brutal-btn-outline brutal-btn-sm"
                            onClick={() =>
                              setConfirmation({ kind: "transfer", member })
                            }
                          >
                            Transfer ownership
                          </button>
                        )}
                        {managed &&
                          (owner || member.workspaceRole === "member") && (
                            <button
                              className="brutal-btn brutal-btn-outline brutal-btn-sm"
                              onClick={() =>
                                setConfirmation({ kind: "remove", member })
                              }
                            >
                              Remove member
                            </button>
                          )}
                      </div>
                    )}
                </article>
              ))}
            </section>
          )}
          {tab === "invitations" && managed && (
            <section className="space-y-4">
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    const result = await api.invite(email.trim());
                    setIssued(result.data);
                    setEmail("");
                    invitations.first();
                  }, "Invitation created. Share the token privately.");
                }}
              >
                <label className="block text-sm font-bold">
                  Invite email
                  <input
                    type="email"
                    className="brutal-input mt-2"
                    value={email}
                    maxLength={254}
                    required
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
                <button
                  className="brutal-btn brutal-btn-sm"
                  disabled={!email.trim()}
                >
                  Create invitation
                </button>
              </form>
              {issued && (
                <div className="border-[2px] p-3 space-y-2">
                  <p className="text-sm">
                    Share this one-use token privately. Expires{" "}
                    {new Date(issued.expiresAt).toLocaleString()}. No email was
                    sent.
                  </p>
                  <textarea
                    aria-label="Invitation token"
                    className="brutal-input"
                    value={issued.token}
                    readOnly
                  />
                  <button
                    className="brutal-btn brutal-btn-outline brutal-btn-sm"
                    onClick={() => setIssued(null)}
                  >
                    Hide token
                  </button>
                </div>
              )}
              {controls(invitations, "Search invitations")}
              {!invitations.loading &&
                !invitations.error &&
                !invitations.data.length && (
                  <p className="text-sm">No invitations.</p>
                )}
              {invitations.data.map((invitation) => (
                <article
                  key={invitation.id}
                  className="border-[2px] p-3 space-y-2"
                >
                  <p className="font-bold break-all text-sm">
                    {invitation.email}
                  </p>
                  <p className="text-xs">
                    {invitation.status} · Expires{" "}
                    {new Date(invitation.expiresAt).toLocaleString()}
                  </p>
                  {invitation.status !== "accepted" && (
                    <button
                      className="brutal-btn brutal-btn-outline brutal-btn-sm"
                      onClick={() =>
                        setConfirmation({
                          kind: "revoke",
                          id: invitation.id,
                          email: invitation.email,
                        })
                      }
                    >
                      Revoke invitation
                    </button>
                  )}
                </article>
              ))}
            </section>
          )}
        </fieldset>
      </div>
    </div>
  );
}
