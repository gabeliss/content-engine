import type { FormEvent } from "react";
import type { Doc } from "../../../convex/_generated/dataModel";
import { SettingRow, settingsInputClass } from "./settingsPrimitives";

export function GeneralSettingsSection({
  currentWorkspaceName,
  isWorkspaceAdmin,
  onSaveWorkspaceName,
  onWorkspaceNameChange,
  workspace,
  workspaceName,
}: {
  currentWorkspaceName: string;
  isWorkspaceAdmin: boolean;
  onSaveWorkspaceName: (event: FormEvent) => void;
  onWorkspaceNameChange: (value: string) => void;
  workspace: Doc<"workspaces"> | null | undefined;
  workspaceName: string;
}) {
  return (
    <section>
      <header className="mb-[var(--space-2)]">
        <h2 className="text-[1.3rem] font-[820] leading-[1.2] text-[var(--color-ink)]">
          General
        </h2>
        <p className="mt-[0.35rem] max-w-[42rem] text-[0.92rem] leading-[1.55] text-[var(--color-muted)]">
          Workspace settings for {currentWorkspaceName}.
        </p>
      </header>

      <SettingRow
        label="Workspace name"
        note="Use a short name people can recognize quickly."
      >
        <form
          className="grid max-w-[35rem] gap-[var(--space-3)] sm:grid-cols-[minmax(0,22rem)_11rem]"
          onSubmit={onSaveWorkspaceName}
        >
          <input
            className={settingsInputClass}
            disabled={!isWorkspaceAdmin}
            placeholder={workspace?.name ?? "Workspace name"}
            value={workspaceName}
            onChange={(event) => onWorkspaceNameChange(event.target.value)}
          />
          <button className="primary-button" disabled={!isWorkspaceAdmin} type="submit">
            Save
          </button>
        </form>
      </SettingRow>
    </section>
  );
}
