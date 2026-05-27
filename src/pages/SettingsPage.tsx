import { useAction, useMutation, useQuery } from "convex/react";
import { Copy, KeyRound, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Field, Page, Panel } from "../components/ui";

const DEFAULT_MCP_KEY_NAME = "Codex";

export function SettingsPage() {
  const apiKeys = useQuery(api.mcp.apiKeys.list);
  const createMcpKey = useAction(api.mcp.apiKeys.create);
  const revokeMcpKey = useMutation(api.mcp.apiKeys.revoke);
  const [keyName, setKeyName] = useState(DEFAULT_MCP_KEY_NAME);
  const [generatedKey, setGeneratedKey] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const mcpEndpoint = useMemo(() => {
    const siteUrl = import.meta.env.VITE_CONVEX_SITE_URL as string | undefined;
    return siteUrl ? `${siteUrl.replace(/\/$/, "")}/mcp` : "/mcp";
  }, []);

  const handleCreateKey = async () => {
    if (!keyName.trim()) return;

    setStatusMessage("Creating MCP key");
    const result = await createMcpKey({ name: keyName.trim() });
    setGeneratedKey(result.key);
    setKeyName(DEFAULT_MCP_KEY_NAME);
    setStatusMessage("MCP key created");
  };

  const handleCopy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setStatusMessage("Copied");
  };

  return (
    <Page title="Settings" description="MCP access for connecting external agents to this workspace.">
      <Panel title="MCP Access" className="settings-mcp-panel">
        <div className="settings-access-grid">
          <label className="field settings-endpoint-field">
            <span>MCP endpoint</span>
            <div className="inline-field">
              <input readOnly value={mcpEndpoint} />
              <button type="button" className="icon-button" onClick={() => void handleCopy(mcpEndpoint)} title="Copy endpoint">
                <Copy size={16} />
              </button>
            </div>
          </label>
          <Field
            label="Key name"
            value={keyName}
            onChange={setKeyName}
            placeholder="Codex"
          />
          <button className="primary-button" type="button" onClick={() => void handleCreateKey()}>
            <KeyRound size={16} />
            Create MCP key
          </button>
          {generatedKey && (
            <label className="field settings-generated-key-field">
              <span>New key</span>
              <div className="inline-field">
                <input readOnly value={generatedKey} />
                <button type="button" className="icon-button" onClick={() => void handleCopy(generatedKey)} title="Copy key">
                  <Copy size={16} />
                </button>
              </div>
            </label>
          )}
          {statusMessage && <p className="muted">{statusMessage}</p>}
        </div>
        <div className="entity-list compact-list">
          {!apiKeys && <p className="muted">Loading MCP keys...</p>}
          {apiKeys?.length === 0 && <p className="muted">No MCP keys yet.</p>}
          {apiKeys?.map((key) => (
            <article className="entity-row" key={key.id}>
              <div>
                <strong>{key.name}</strong>
                <p>{key.keyPrefix} · {key.revokedAt ? "Revoked" : "Active"}</p>
              </div>
              {!key.revokedAt && (
                <button
                  type="button"
                  className="icon-button danger"
                  onClick={() => void revokeMcpKey({ id: key.id as Id<"mcpApiKeys"> })}
                  title="Revoke key"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </article>
          ))}
        </div>
      </Panel>
    </Page>
  );
}
