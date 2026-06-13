import { Copy, KeyRound, Trash2 } from "lucide-react";
import type { FormEvent } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { LoadingState } from "../../components/ui";
import {
  DEFAULT_MCP_KEY_NAME,
  SettingRow,
  formatSettingsDate,
  settingsInputClass,
} from "./settingsPrimitives";
import type { McpApiKeySummary } from "./settingsTypes";

export function AgentAccessSettingsSection({
  apiKeys,
  generatedKey,
  keyName,
  mcpEndpoint,
  onChangeKeyName,
  onCopy,
  onCreateKey,
  onRevokeKey,
}: {
  apiKeys: McpApiKeySummary[] | undefined;
  generatedKey: string;
  keyName: string;
  mcpEndpoint: string;
  onChangeKeyName: (value: string) => void;
  onCopy: (value: string) => void;
  onCreateKey: (event: FormEvent) => void;
  onRevokeKey: (id: Id<"mcpApiKeys">) => void;
}) {
  return (
    <section>
      <header className="mb-[var(--space-2)]">
        <h2 className="text-[1.3rem] font-[820] leading-[1.2] text-[var(--color-ink)]">
          Agent access
        </h2>
        <p className="mt-[0.35rem] max-w-[42rem] text-[0.92rem] leading-[1.55] text-[var(--color-muted)]">
          Connect external agents and revoke keys you no longer use.
        </p>
      </header>

      <SettingRow label="Endpoint" note="Use this URL when configuring an MCP client.">
        <div className="grid max-w-[44rem] gap-[var(--space-3)] sm:grid-cols-[minmax(0,1fr)_2.85rem]">
          <input className={settingsInputClass} readOnly value={mcpEndpoint} />
          <button
            aria-label="Copy MCP endpoint"
            className="icon-button min-h-[2.85rem]"
            type="button"
            onClick={() => onCopy(mcpEndpoint)}
          >
            <Copy size={16} />
          </button>
        </div>
      </SettingRow>

      <SettingRow
        label="Create key"
        note="New keys are shown once. Store the key before leaving this page."
      >
        <form
          className="grid max-w-[35rem] gap-[var(--space-3)] sm:grid-cols-[minmax(0,22rem)_11rem]"
          onSubmit={onCreateKey}
        >
          <input
            className={settingsInputClass}
            placeholder={DEFAULT_MCP_KEY_NAME}
            value={keyName}
            onChange={(event) => onChangeKeyName(event.target.value)}
          />
          <button className="primary-button" type="submit">
            <KeyRound size={16} />
            Create
          </button>
        </form>
        {generatedKey ? (
          <div className="mt-[var(--space-3)] grid max-w-[44rem] gap-[var(--space-2)] rounded-[var(--radius-sm)] bg-[oklch(95%_0.025_185)] p-[var(--space-3)]">
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
                onClick={() => onCopy(generatedKey)}
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
            <LoadingState
              className="border-0 bg-transparent"
              compact
              detail="Checking active agent access keys."
              title="Loading keys"
            />
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
                    {key.keyPrefix} / Created {formatSettingsDate(key.createdAt)}
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
                  onClick={() => onRevokeKey(key.id as Id<"mcpApiKeys">)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </SettingRow>
    </section>
  );
}
