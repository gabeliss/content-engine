import { useUser } from "@clerk/clerk-react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  BriefcaseBusiness,
  Check,
  Copy,
  KeyRound,
  Plus,
  Shield,
  Trash2,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Page } from "../components/ui";
import { useWorkspace } from "../contexts/WorkspaceContext";

const DEFAULT_MCP_KEY_NAME = "Codex";

type SettingsTab = "workspace" | "team" | "admin" | "account" | "mcp";
type WorkspaceRole = "admin" | "member" | "viewer";

const settingsTabs: Array<{
  id: SettingsTab;
  label: string;
  description: string;
  icon: typeof BriefcaseBusiness;
}> = [
  {
    id: "workspace",
    label: "Workspace",
    description: "Scope, naming, and workspace switching.",
    icon: BriefcaseBusiness,
  },
  {
    id: "team",
    label: "Team",
    description: "Members and roles for the current workspace.",
    icon: UsersRound,
  },
  {
    id: "admin",
    label: "Admin",
    description: "Security model and ownership rules.",
    icon: Shield,
  },
  {
    id: "account",
    label: "Account",
    description: "Signed-in user details from Clerk.",
    icon: Check,
  },
  {
    id: "mcp",
    label: "MCP Access",
    description: "External agent connection keys.",
    icon: KeyRound,
  },
];

const inputClass =
  "min-h-[2.85rem] w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] text-[0.95rem] font-[520] text-[var(--color-ink)] outline-none transition focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_oklch(57%_0.14_166_/_0.13)] disabled:cursor-not-allowed disabled:bg-[var(--color-surface-muted)]";

const selectClass =
  "min-h-[2.85rem] w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] text-[0.95rem] font-[520] text-[var(--color-ink)] outline-none transition focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_oklch(57%_0.14_166_/_0.13)] disabled:cursor-not-allowed disabled:bg-[var(--color-surface-muted)]";

const smallSelectClass =
  "min-h-[2.4rem] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-2)] text-[0.84rem] font-[620] text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]";

function workspaceKindLabel(type?: string) {
  return type === "team" ? "Team workspace" : "Personal workspace";
}

function roleLabel(role?: string) {
  if (!role) return "Member";
  return role[0].toUpperCase() + role.slice(1);
}

function formatDate(timestamp?: number) {
  if (!timestamp) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function TabButton({
  active,
  description,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  description: string;
  icon: typeof BriefcaseBusiness;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={[
        "grid min-h-[3.75rem] grid-cols-[1.35rem_minmax(0,1fr)] items-center gap-[var(--space-3)] rounded-[var(--radius-sm)] px-[var(--space-3)] text-left transition",
        active
          ? "bg-[oklch(95%_0.025_185)] text-[var(--color-ink)] shadow-[inset_0_0_0_1px_oklch(78%_0.055_195)]"
          : "text-[var(--color-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]",
      ].join(" ")}
      type="button"
      onClick={onClick}
    >
      <Icon size={18} strokeWidth={1.8} />
      <span className="min-w-0">
        <span className="block truncate text-[0.93rem] font-[760] leading-[1.2]">{label}</span>
        <span className="mt-[0.18rem] block text-[0.74rem] font-[560] leading-[1.3] text-[var(--color-muted)]">
          {description}
        </span>
      </span>
    </button>
  );
}

function Section({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="border-t border-[var(--color-border)] pt-[var(--space-5)] first:border-t-0 first:pt-0">
      <header className="mb-[var(--space-2)] grid gap-[var(--space-1)]">
        <h2 className="text-[1.15rem] font-[820] leading-[1.2] text-[var(--color-ink)]">{title}</h2>
        <p className="max-w-[54rem] text-[0.92rem] leading-[1.55] text-[var(--color-muted)]">{description}</p>
      </header>
      <div className="divide-y divide-[var(--color-border)]">{children}</div>
    </section>
  );
}

function SettingRow({
  children,
  label,
  note,
}: {
  children: React.ReactNode;
  label: string;
  note: string;
}) {
  return (
    <div className="grid gap-[var(--space-3)] py-[var(--space-4)] md:grid-cols-[13.5rem_minmax(0,1fr)] md:items-start">
      <div>
        <div className="text-[0.86rem] font-[780] leading-[1.25] text-[var(--color-ink)]">{label}</div>
        <p className="mt-[0.3rem] text-[0.8rem] leading-[1.45] text-[var(--color-muted)]">{note}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function QuietNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[var(--radius-sm)] bg-[var(--color-surface-muted)] px-[var(--space-3)] py-[var(--space-2)] text-[0.84rem] leading-[1.5] text-[var(--color-muted)]">
      {children}
    </p>
  );
}

export function SettingsPage() {
  const { user } = useUser();
  const {
    activeMembership,
    activeWorkspace,
    activeWorkspaceId,
    isWorkspaceAdmin,
    setActiveWorkspaceId,
    workspaces,
  } = useWorkspace();
  const members = useQuery(
    api.workspaces.workspaces.listMembers,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip"
  );
  const apiKeys = useQuery(api.mcp.apiKeys.list);
  const createTeam = useMutation(api.workspaces.workspaces.createTeam);
  const updateWorkspace = useMutation(api.workspaces.workspaces.update);
  const addMemberByEmail = useMutation(api.workspaces.workspaces.upsertMemberByEmail);
  const setMemberRole = useMutation(api.workspaces.workspaces.setMemberRole);
  const removeMember = useMutation(api.workspaces.workspaces.removeMember);
  const createMcpKey = useAction(api.mcp.apiKeys.create);
  const revokeMcpKey = useMutation(api.mcp.apiKeys.revoke);

  const [activeTab, setActiveTab] = useState<SettingsTab>("workspace");
  const [workspaceName, setWorkspaceName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("member");
  const [keyName, setKeyName] = useState(DEFAULT_MCP_KEY_NAME);
  const [generatedKey, setGeneratedKey] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const mcpEndpoint = useMemo(() => {
    const siteUrl = import.meta.env.VITE_CONVEX_SITE_URL as string | undefined;
    return siteUrl ? `${siteUrl.replace(/\/$/, "")}/mcp` : "/mcp";
  }, []);

  const sortedWorkspaces = useMemo(
    () =>
      [...(workspaces ?? [])].sort((first, second) => {
        if (first.workspace.workspaceType !== second.workspace.workspaceType) {
          return first.workspace.workspaceType === "personal" ? -1 : 1;
        }
        return first.workspace.name.localeCompare(second.workspace.name);
      }),
    [workspaces]
  );

  const handleCopy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setStatusMessage("Copied to clipboard.");
  };

  const saveWorkspaceName = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeWorkspaceId) return;
    const name = workspaceName.trim();
    if (!name) return;
    setStatusMessage("Saving workspace...");
    try {
      await updateWorkspace({ id: activeWorkspaceId, name });
      setWorkspaceName("");
      setStatusMessage("Workspace name updated.");
    } catch (error) {
      setStatusMessage(errorMessage(error, "Workspace update failed."));
    }
  };

  const createTeamWorkspace = async (event: FormEvent) => {
    event.preventDefault();
    const name = teamName.trim();
    if (!name) return;
    setStatusMessage("Creating team workspace...");
    try {
      const workspaceId = await createTeam({ name });
      setActiveWorkspaceId(workspaceId);
      setTeamName("");
      setStatusMessage("Team workspace created.");
    } catch (error) {
      setStatusMessage(errorMessage(error, "Team creation failed."));
    }
  };

  const inviteMember = async (event: FormEvent) => {
    event.preventDefault();
    const email = inviteEmail.trim();
    if (!activeWorkspaceId || !email) return;
    setStatusMessage("Updating member access...");
    try {
      await addMemberByEmail({
        workspaceId: activeWorkspaceId,
        email,
        role: inviteRole,
      });
      setInviteEmail("");
      setInviteRole("member");
      setStatusMessage("Member access updated.");
    } catch (error) {
      setStatusMessage(errorMessage(error, "Member update failed."));
    }
  };

  const changeMemberRole = async (userId: string, role: string) => {
    if (!activeWorkspaceId) return;
    setStatusMessage("Updating member role...");
    try {
      await setMemberRole({
        workspaceId: activeWorkspaceId,
        userId,
        role: role as WorkspaceRole,
      });
      setStatusMessage("Member role updated.");
    } catch (error) {
      setStatusMessage(errorMessage(error, "Role update failed."));
    }
  };

  const removeWorkspaceMember = async (userId: string, name: string) => {
    if (!activeWorkspaceId) return;
    if (!window.confirm(`Remove ${name} from this workspace?`)) return;
    setStatusMessage("Removing member...");
    try {
      await removeMember({ workspaceId: activeWorkspaceId, userId });
      setStatusMessage("Member removed.");
    } catch (error) {
      setStatusMessage(errorMessage(error, "Member removal failed."));
    }
  };

  const handleCreateKey = async (event: FormEvent) => {
    event.preventDefault();
    const name = keyName.trim();
    if (!name) return;
    setStatusMessage("Creating MCP key...");
    try {
      const result = await createMcpKey({ name });
      setGeneratedKey(result.key);
      setKeyName(DEFAULT_MCP_KEY_NAME);
      setStatusMessage("MCP key created. Copy it now, because it will not be shown again.");
    } catch (error) {
      setStatusMessage(errorMessage(error, "MCP key creation failed."));
    }
  };

  const memberRows = members ?? [];
  const activeMemberCount = memberRows.filter((row) => row.membership.status === "active").length;
  const currentWorkspaceName = activeWorkspace?.name ?? "Workspace";
  const memberCount = activeMemberCount || 1;
  const memberCountLabel = `${memberCount} member${memberCount === 1 ? "" : "s"}`;
  const activeTabMeta = settingsTabs.find((tab) => tab.id === activeTab) ?? settingsTabs[0];

  return (
    <Page
      title="Settings"
      description="Manage workspace scope, team access, account details, and external agent keys."
    >
      <div className="grid gap-[var(--space-6)] xl:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="xl:sticky xl:top-[var(--space-5)]">
          <div className="grid gap-[var(--space-1)] border-b border-[var(--color-border)] pb-[var(--space-3)] xl:border-b-0 xl:pb-0">
            {settingsTabs.map((tab) => (
              <TabButton
                active={activeTab === tab.id}
                description={tab.description}
                icon={tab.icon}
                key={tab.id}
                label={tab.label}
                onClick={() => setActiveTab(tab.id)}
              />
            ))}
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-[var(--space-6)] border-b border-[var(--color-border)] pb-[var(--space-5)]">
            <div className="grid gap-[var(--space-4)] lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
              <div className="min-w-0">
                <div className="mb-[var(--space-2)] flex flex-wrap items-center gap-[var(--space-2)]">
                  <span className="rounded-full bg-[oklch(95%_0.025_185)] px-[var(--space-2)] py-[0.22rem] text-[0.72rem] font-[760] uppercase tracking-[0.04em] text-[var(--color-accent-strong)]">
                    {workspaceKindLabel(activeWorkspace?.workspaceType)}
                  </span>
                  <span className="text-[0.82rem] font-[650] text-[var(--color-muted)]">
                    {roleLabel(activeMembership?.role)}
                  </span>
                  <span className="text-[0.82rem] font-[650] text-[var(--color-muted)]">
                    {memberCountLabel}
                  </span>
                </div>
                <h2 className="truncate text-[1.7rem] font-[850] leading-[1.08] text-[var(--color-ink)]">
                  {currentWorkspaceName}
                </h2>
                <p className="mt-[var(--space-2)] max-w-[44rem] text-[0.94rem] leading-[1.55] text-[var(--color-muted)]">
                  {activeTabMeta.description}
                </p>
              </div>

              <label className="grid gap-[var(--space-2)]">
                <span className="text-[0.74rem] font-[780] uppercase tracking-[0.06em] text-[var(--color-muted)]">
                  Current workspace
                </span>
                <select
                  className={selectClass}
                  disabled={!sortedWorkspaces.length}
                  value={activeWorkspaceId ?? ""}
                  onChange={(event) =>
                    setActiveWorkspaceId(event.target.value as Id<"workspaces">)
                  }
                >
                  {!activeWorkspaceId ? <option value="">Loading</option> : null}
                  {sortedWorkspaces.map(({ workspace }) => (
                    <option key={workspace._id} value={workspace._id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {statusMessage ? (
              <p className="mt-[var(--space-4)] text-[0.84rem] font-[680] text-[var(--color-accent-strong)]">
                {statusMessage}
              </p>
            ) : null}
          </div>

          {activeTab === "workspace" ? (
            <div className="grid gap-[var(--space-7)]">
              <Section
                title="Workspace"
                description="Choose where work is scoped, rename the current workspace, or create a team space when collaboration needs a boundary."
              >
                <SettingRow
                  label="Active workspace"
                  note="Content, brands, workflows, assets, and analytics load from this selection."
                >
                  <select
                    className={selectClass}
                    disabled={!sortedWorkspaces.length}
                    value={activeWorkspaceId ?? ""}
                    onChange={(event) =>
                      setActiveWorkspaceId(event.target.value as Id<"workspaces">)
                    }
                  >
                    {!activeWorkspaceId ? <option value="">Loading</option> : null}
                    {sortedWorkspaces.map(({ workspace }) => (
                      <option key={workspace._id} value={workspace._id}>
                        {workspace.name} ({workspaceKindLabel(workspace.workspaceType)})
                      </option>
                    ))}
                  </select>
                </SettingRow>

                <SettingRow
                  label="Workspace name"
                  note="Use a short, recognizable name. Team spaces should match the group that owns the content."
                >
                  <form className="grid gap-[var(--space-3)] sm:grid-cols-[minmax(0,22rem)_12rem]" onSubmit={saveWorkspaceName}>
                    <input
                      className={inputClass}
                      disabled={!isWorkspaceAdmin}
                      placeholder={activeWorkspace?.name ?? "Workspace name"}
                      value={workspaceName}
                      onChange={(event) => setWorkspaceName(event.target.value)}
                    />
                    <button className="primary-button" disabled={!isWorkspaceAdmin} type="submit">
                      Save name
                    </button>
                  </form>
                </SettingRow>

                <SettingRow
                  label="Create team workspace"
                  note="Use team spaces when other people should see a shared project area that stays separate from your personal work."
                >
                  <form className="grid gap-[var(--space-3)] sm:grid-cols-[minmax(0,22rem)_12rem]" onSubmit={createTeamWorkspace}>
                    <input
                      className={inputClass}
                      placeholder="Acme Growth Team"
                      value={teamName}
                      onChange={(event) => setTeamName(event.target.value)}
                    />
                    <button className="secondary-button" type="submit">
                      <Plus size={16} />
                      Create
                    </button>
                  </form>
                </SettingRow>

                <SettingRow
                  label="Boundary"
                  note="Personal and team spaces intentionally do not share operating data."
                >
                  <QuietNote>
                    Switching workspaces changes the visible brands, personas, workflows, library
                    assets, publishing plans, and metrics. Your personal workspace remains private
                    unless you move work into a team workspace.
                  </QuietNote>
                </SettingRow>
              </Section>
            </div>
          ) : null}

          {activeTab === "team" ? (
            <div className="grid gap-[var(--space-7)]">
              <Section
                title="Team access"
                description="Invite people who have already signed in once, then assign the least powerful role that lets them do the work."
              >
                <SettingRow
                  label="Add member"
                  note="Owners and admins can add existing users by email."
                >
                  <form className="grid gap-[var(--space-3)] lg:grid-cols-[minmax(0,1fr)_11rem_11rem]" onSubmit={inviteMember}>
                    <input
                      className={inputClass}
                      disabled={!isWorkspaceAdmin}
                      placeholder="teammate@company.com"
                      type="email"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                    />
                    <select
                      className={selectClass}
                      disabled={!isWorkspaceAdmin}
                      value={inviteRole}
                      onChange={(event) => setInviteRole(event.target.value as WorkspaceRole)}
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button className="primary-button" disabled={!isWorkspaceAdmin} type="submit">
                      <UserPlus size={16} />
                      Add member
                    </button>
                  </form>
                </SettingRow>

                <SettingRow
                  label="Members"
                  note="Roles apply only inside the current workspace."
                >
                  <div className="overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)]">
                    <div className="grid grid-cols-[minmax(0,1fr)_8rem_8.5rem_2.75rem] gap-[var(--space-3)] bg-[var(--color-surface-muted)] px-[var(--space-3)] py-[var(--space-2)] text-[0.72rem] font-[780] uppercase tracking-[0.06em] text-[var(--color-muted)] max-md:hidden">
                      <span>Person</span>
                      <span>Role</span>
                      <span>Status</span>
                      <span />
                    </div>

                    {members === undefined ? (
                      <div className="px-[var(--space-3)] py-[var(--space-4)] text-[0.9rem] text-[var(--color-muted)]">
                        Loading members...
                      </div>
                    ) : memberRows.length === 0 ? (
                      <div className="px-[var(--space-3)] py-[var(--space-4)] text-[0.9rem] text-[var(--color-muted)]">
                        No members yet.
                      </div>
                    ) : (
                      memberRows.map((row) => {
                        const { membership } = row;
                        const displayName =
                          row.user?.name ?? row.user?.email ?? membership.userId;
                        const isSelf = membership.userId === user?.id;
                        const canEditMember =
                          isWorkspaceAdmin && membership.role !== "owner" && !isSelf;

                        return (
                          <div
                            className="grid gap-[var(--space-3)] border-t border-[var(--color-border)] px-[var(--space-3)] py-[var(--space-3)] first:border-t-0 md:grid-cols-[minmax(0,1fr)_8rem_8.5rem_2.75rem] md:items-center"
                            key={membership._id}
                          >
                            <div className="min-w-0">
                              <div className="truncate text-[0.94rem] font-[720] text-[var(--color-ink)]">
                                {displayName}
                              </div>
                              <div className="truncate text-[0.8rem] text-[var(--color-muted)]">
                                {row.user?.email ?? membership.userId}
                              </div>
                            </div>
                            <select
                              className={smallSelectClass}
                              disabled={!canEditMember}
                              value={membership.role}
                              onChange={(event) =>
                                changeMemberRole(membership.userId, event.target.value)
                              }
                            >
                              <option value="owner">Owner</option>
                              <option value="admin">Admin</option>
                              <option value="member">Member</option>
                              <option value="viewer">Viewer</option>
                            </select>
                            <span className="text-[0.83rem] font-[650] capitalize text-[var(--color-muted)]">
                              {membership.status}
                            </span>
                            <button
                              aria-label={`Remove ${displayName}`}
                              className="icon-button justify-self-start md:justify-self-end"
                              disabled={!canEditMember}
                              type="button"
                              onClick={() => removeWorkspaceMember(membership.userId, displayName)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </SettingRow>
              </Section>
            </div>
          ) : null}

          {activeTab === "admin" ? (
            <Section
              title="Admin"
              description="A concise map of how identity and data boundaries work in this app."
            >
              <SettingRow
                label="Identity"
                note="Clerk authenticates the person. Convex stores the app-specific user record."
              >
                <QuietNote>
                  Clerk is the login provider and source for identity. Convex mirrors the signed-in
                  user into the users table so app data can reference stable user records.
                </QuietNote>
              </SettingRow>

              <SettingRow
                label="Organizations"
                note="Workspace ownership lives in Convex today."
              >
                <QuietNote>
                  Team workspaces are tracked in Convex. A Clerk organization id can be attached
                  later, but the app currently enforces access through workspace memberships.
                </QuietNote>
              </SettingRow>

              <SettingRow label="Roles" note="Role checks gate team administration and writes.">
                <div className="grid gap-[var(--space-3)] sm:grid-cols-3">
                  {[
                    ["Owner/Admin", "Manage workspace settings and team access."],
                    ["Member", "Create and edit workspace content."],
                    ["Viewer", "Read workspace content without changing it."],
                  ].map(([role, description]) => (
                    <div className="border-t border-[var(--color-border)] pt-[var(--space-3)]" key={role}>
                      <div className="text-[0.86rem] font-[780] text-[var(--color-ink)]">{role}</div>
                      <p className="mt-[0.22rem] text-[0.8rem] leading-[1.45] text-[var(--color-muted)]">
                        {description}
                      </p>
                    </div>
                  ))}
                </div>
              </SettingRow>
            </Section>
          ) : null}

          {activeTab === "account" ? (
            <Section
              title="Account"
              description="The signed-in Clerk account used for this Content Engine session."
            >
              <SettingRow label="Profile" note="Profile details come from Clerk.">
                <div className="flex min-w-0 items-center gap-[var(--space-3)]">
                  <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--color-accent)] text-[1rem] font-[820] text-white">
                    {user?.imageUrl ? (
                      <img
                        alt={user.fullName ?? "User"}
                        className="size-full object-cover"
                        src={user.imageUrl}
                      />
                    ) : (
                      <span>{user?.fullName?.[0] ?? "U"}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[1rem] font-[780] text-[var(--color-ink)]">
                      {user?.fullName ?? "User"}
                    </div>
                    <div className="truncate text-[0.86rem] text-[var(--color-muted)]">
                      {user?.primaryEmailAddress?.emailAddress ?? "No email"}
                    </div>
                  </div>
                </div>
              </SettingRow>
            </Section>
          ) : null}

          {activeTab === "mcp" ? (
            <Section
              title="MCP access"
              description="Create personal API keys for external agents that need to connect to this app."
            >
              <SettingRow label="Endpoint" note="Use this URL when configuring an MCP client.">
                <div className="grid gap-[var(--space-3)] sm:grid-cols-[minmax(0,1fr)_2.85rem]">
                  <input className={inputClass} readOnly value={mcpEndpoint} />
                  <button
                    aria-label="Copy MCP endpoint"
                    className="icon-button min-h-[2.85rem]"
                    type="button"
                    onClick={() => handleCopy(mcpEndpoint)}
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </SettingRow>

              <SettingRow
                label="Create key"
                note="New keys are shown once. Store the key before leaving this page."
              >
                <form className="grid gap-[var(--space-3)] sm:grid-cols-[minmax(0,22rem)_12rem]" onSubmit={handleCreateKey}>
                  <input
                    className={inputClass}
                    placeholder={DEFAULT_MCP_KEY_NAME}
                    value={keyName}
                    onChange={(event) => setKeyName(event.target.value)}
                  />
                  <button className="primary-button" type="submit">
                    <KeyRound size={16} />
                    Create key
                  </button>
                </form>
                {generatedKey ? (
                  <div className="mt-[var(--space-3)] grid gap-[var(--space-2)] rounded-[var(--radius-sm)] bg-[oklch(95%_0.025_185)] p-[var(--space-3)]">
                    <div className="text-[0.78rem] font-[780] uppercase tracking-[0.06em] text-[var(--color-accent-strong)]">
                      New key
                    </div>
                    <div className="grid gap-[var(--space-2)] sm:grid-cols-[minmax(0,1fr)_2.5rem]">
                      <code className="min-w-0 overflow-x-auto whitespace-nowrap rounded-[var(--radius-sm)] bg-[oklch(100%_0_0_/_0.62)] px-[var(--space-2)] py-[var(--space-2)] text-[0.8rem] text-[var(--color-ink)]">
                        {generatedKey}
                      </code>
                      <button
                        aria-label="Copy generated key"
                        className="icon-button"
                        type="button"
                        onClick={() => handleCopy(generatedKey)}
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>
                ) : null}
              </SettingRow>

              <SettingRow label="Keys" note="Revoke keys you no longer use.">
                <div className="overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)]">
                  {apiKeys === undefined ? (
                    <div className="px-[var(--space-3)] py-[var(--space-4)] text-[0.9rem] text-[var(--color-muted)]">
                      Loading keys...
                    </div>
                  ) : apiKeys.length === 0 ? (
                    <div className="px-[var(--space-3)] py-[var(--space-4)] text-[0.9rem] text-[var(--color-muted)]">
                      No keys created yet.
                    </div>
                  ) : (
                    apiKeys.map((key) => (
                      <div
                        className="grid gap-[var(--space-3)] border-t border-[var(--color-border)] px-[var(--space-3)] py-[var(--space-3)] first:border-t-0 md:grid-cols-[minmax(0,1fr)_8rem_2.75rem] md:items-center"
                        key={key.id}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-[0.94rem] font-[720] text-[var(--color-ink)]">
                            {key.name}
                          </div>
                          <div className="truncate text-[0.8rem] text-[var(--color-muted)]">
                            {key.keyPrefix} / Created {formatDate(key.createdAt)}
                          </div>
                        </div>
                        <span className="text-[0.83rem] font-[650] text-[var(--color-muted)]">
                          {key.revokedAt ? "Revoked" : "Active"}
                        </span>
                        <button
                          aria-label={`Revoke ${key.name}`}
                          className="icon-button justify-self-start md:justify-self-end"
                          disabled={Boolean(key.revokedAt)}
                          type="button"
                          onClick={() => revokeMcpKey({ id: key.id as Id<"mcpApiKeys"> })}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </SettingRow>
            </Section>
          ) : null}
        </div>
      </div>
    </Page>
  );
}
