import { Trash2, UserPlus } from "lucide-react";
import type { FormEvent } from "react";
import { CustomSelect } from "../../components/CustomSelect";
import { LoadingState } from "../../components/ui";
import {
  SettingRow,
  inviteRoleOptions,
  memberRoleOptions,
  settingsInputClass,
  type InviteRole,
} from "./settingsPrimitives";
import type { WorkspaceMemberRow } from "./settingsTypes";

const compactSelectClass =
  "min-h-[2.4rem] bg-[var(--color-surface)] px-[var(--space-2)] py-[0.35rem] text-[0.84rem] font-[620]";
const selectClass =
  "min-h-[2.85rem] bg-[var(--color-surface)] text-[0.95rem] font-[520]";

export function MembersSettingsSection({
  canInviteMembers,
  canTransferOwnership,
  currentUserId,
  currentWorkspaceName,
  inviteEmail,
  inviteRole,
  isWorkspaceAdmin,
  memberCountLabel,
  memberRows,
  membersLoaded,
  onChangeInviteEmail,
  onChangeInviteRole,
  onChangeMemberRole,
  onInviteMember,
  onRemoveMember,
}: {
  canInviteMembers: boolean;
  canTransferOwnership: boolean;
  currentUserId?: string;
  currentWorkspaceName: string;
  inviteEmail: string;
  inviteRole: InviteRole;
  isWorkspaceAdmin: boolean;
  memberCountLabel: string;
  memberRows: WorkspaceMemberRow[];
  membersLoaded: boolean;
  onChangeInviteEmail: (value: string) => void;
  onChangeInviteRole: (role: InviteRole) => void;
  onChangeMemberRole: (userId: string, role: string, name: string) => void;
  onInviteMember: (event: FormEvent) => void;
  onRemoveMember: (userId: string, name: string) => void;
}) {
  return (
    <section>
      <header className="mb-[var(--space-2)]">
        <h2 className="text-[1.3rem] font-[820] leading-[1.2] text-[var(--color-ink)]">
          Members
        </h2>
        <p className="mt-[0.35rem] max-w-[42rem] text-[0.92rem] leading-[1.55] text-[var(--color-muted)]">
          {memberCountLabel} in {currentWorkspaceName}.
        </p>
      </header>

      <SettingRow
        label="Invite member"
        note="Add someone who has already signed in once."
      >
        <form
          className="grid max-w-[44rem] gap-[var(--space-3)] lg:grid-cols-[minmax(0,1fr)_10rem_11rem]"
          onSubmit={onInviteMember}
        >
          <input
            className={settingsInputClass}
            disabled={!canInviteMembers}
            placeholder="teammate@company.com"
            type="email"
            value={inviteEmail}
            onChange={(event) => onChangeInviteEmail(event.target.value)}
          />
          <CustomSelect
            disabled={!canInviteMembers}
            onChange={(nextRole) => onChangeInviteRole(nextRole as InviteRole)}
            options={inviteRoleOptions}
            placeholder="Role"
            triggerClassName={selectClass}
            value={inviteRole}
          />
          <button className="primary-button" disabled={!canInviteMembers} type="submit">
            <UserPlus size={16} />
            Invite
          </button>
        </form>
      </SettingRow>

      <SettingRow label="Members" note="Roles apply only inside this workspace.">
        <div className="overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)]">
          <div className="grid grid-cols-[minmax(0,1fr)_9rem_2.75rem] gap-[var(--space-3)] bg-[var(--color-surface-muted)] px-[var(--space-3)] py-[var(--space-2)] text-[0.72rem] font-[780] uppercase tracking-[0.06em] text-[var(--color-muted)] max-md:hidden">
            <span>Person</span>
            <span>Role</span>
            <span />
          </div>

          {!membersLoaded ? (
            <LoadingState
              className="border-0 bg-transparent"
              compact
              detail="Fetching people with access to this workspace."
              title="Loading members"
            />
          ) : memberRows.length === 0 ? (
            <div className="px-[var(--space-3)] py-[var(--space-4)] text-[0.9rem] text-[var(--color-muted)]">
              No members yet.
            </div>
          ) : (
            memberRows.map((row) => {
              const { membership } = row;
              const displayName = row.user?.name ?? row.user?.email ?? membership.userId;
              const isSelf = membership.userId === currentUserId;
              const isOwner = membership.role === "owner";
              const canEditRole = isWorkspaceAdmin && !isSelf && !isOwner;
              const canRemoveMember = isWorkspaceAdmin && !isSelf && !isOwner;

              return (
                <div
                  className="grid gap-[var(--space-3)] border-t border-[var(--color-border)] px-[var(--space-3)] py-[var(--space-3)] first:border-t-0 md:grid-cols-[minmax(0,1fr)_9rem_2.75rem] md:items-center"
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
                  {canEditRole ? (
                    <CustomSelect
                      onChange={(nextRole) =>
                        onChangeMemberRole(membership.userId, nextRole, displayName)
                      }
                      options={
                        canTransferOwnership
                          ? memberRoleOptions
                          : memberRoleOptions.filter((option) => option.value !== "owner")
                      }
                      placeholder="Role"
                      triggerClassName={compactSelectClass}
                      value={membership.role}
                    />
                  ) : (
                    <span className="inline-flex min-h-[2.4rem] items-center text-[0.84rem] font-[720] capitalize text-[var(--color-ink)]">
                      {membership.role}
                    </span>
                  )}
                  {canRemoveMember ? (
                    <button
                      aria-label={`Remove ${displayName}`}
                      className="icon-button justify-self-start md:justify-self-end"
                      type="button"
                      onClick={() => onRemoveMember(membership.userId, displayName)}
                    >
                      <Trash2 size={16} />
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              );
            })
          )}
        </div>
      </SettingRow>
    </section>
  );
}
