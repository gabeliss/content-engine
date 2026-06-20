import { useAction, useMutation, useQuery } from "convex/react";
import { Plus, RefreshCw } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import { EntityGrid, Field, FormPanel, Page, Select } from "../components/ui";
import { useWorkspace } from "../contexts/WorkspaceContext";
import {
  DEFAULT_PUBLISHING_PROVIDER,
  PUBLISHING_PROVIDER_ROUTES,
  publishingRouteForProvider,
} from "../lib/publishingRouting";
import type { BrandId, Platform, PublishingProvider } from "../types";

const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  x: "X / Twitter",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  threads: "Threads",
  pinterest: "Pinterest",
  bluesky: "Bluesky",
  google_business: "Google Business",
};

export function AccountsPage() {
  const { activeWorkspace, activeWorkspaceId } = useWorkspace();
  const workspaceArgs = activeWorkspaceId ? { workspaceId: activeWorkspaceId } : {};
  const brands = useQuery(api.accounts.brands.list, workspaceArgs);
  const accounts = useQuery(api.accounts.socialAccounts.list, workspaceArgs);
  const upsertAccount = useMutation(api.accounts.socialAccounts.upsertManual);
  const syncProviderAccounts = useAction(api.accounts.socialAccounts.syncProviderAccounts);
  const [brandId, setBrandId] = useState("");
  const [provider, setProvider] = useState<PublishingProvider>(DEFAULT_PUBLISHING_PROVIDER);
  const [platform, setPlatform] = useState<Platform>("tiktok");
  const [username, setUsername] = useState("");
  const [syncStatus, setSyncStatus] = useState("");
  const providerRoute = publishingRouteForProvider(provider);
  const canSyncProvider = provider !== "manual";
  const canAddManualAccount = provider === "manual";

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !canAddManualAccount) return;

    await upsertAccount({
      ...(activeWorkspaceId ? { workspaceId: activeWorkspaceId } : {}),
      brandId: brandId ? (brandId as BrandId) : undefined,
      provider,
      platform,
      externalAccountId: `${provider}:${platform}:${username.trim()}`,
      username: username.trim(),
      capabilities: ["publish", "schedule", "analytics"],
    });
    setUsername("");
  };

  const handleSync = async () => {
    if (!canSyncProvider) return;

    setSyncStatus(`Syncing ${providerRoute.label}`);
    try {
      const result = await syncProviderAccounts({
        provider,
        ...(activeWorkspaceId ? { workspaceId: activeWorkspaceId } : {}),
        brandId: brandId ? (brandId as BrandId) : undefined,
      });
      setSyncStatus(`Synced ${result.synced} ${providerRoute.label} accounts`);
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : "Sync failed");
    }
  };

  return (
    <Page
      title="Social Accounts"
      description={`Provider-backed accounts for ${activeWorkspace?.name ?? "this workspace"}.`}
    >
      <FormPanel title="Connected Accounts" onSubmit={handleSubmit}>
        <Select label="Brand" value={brandId} onChange={setBrandId}>
          <option value="">Unassigned</option>
          {brands?.map((brand) => (
            <option key={brand._id} value={brand._id}>
              {brand.name}
            </option>
          ))}
        </Select>
        <Select
          label="Provider"
          value={provider}
          onChange={(value) => {
            const nextProvider = value as PublishingProvider;
            setProvider(nextProvider);
            const nextRoute = publishingRouteForProvider(nextProvider);
            if (!nextRoute.platforms.includes(platform)) {
              setPlatform(nextRoute.platforms[0] ?? "tiktok");
            }
          }}
        >
          {PUBLISHING_PROVIDER_ROUTES.map((route) => (
            <option key={route.provider} value={route.provider}>
              {route.label}
            </option>
          ))}
        </Select>
        <div className="flex flex-wrap gap-2">
          <button
            className="primary-button"
            disabled={!canSyncProvider}
            type="button"
            onClick={() => void handleSync()}
          >
            <RefreshCw size={16} />
            Sync {providerRoute.label}
          </button>
        </div>
        {canAddManualAccount ? (
          <>
            <div className="mt-2 border-t border-[var(--color-border)] pt-3">
              <p className="m-0 text-[0.78rem] font-[760] uppercase tracking-[0.08em] text-[var(--color-ink-muted)]">
                Manual fallback
              </p>
            </div>
            <Select
              label="Platform"
              value={platform}
              onChange={(value) => setPlatform(value as Platform)}
            >
              {providerRoute.platforms.map((routePlatform) => (
                <option key={routePlatform} value={routePlatform}>
                  {PLATFORM_LABELS[routePlatform]}
                </option>
              ))}
            </Select>
            <Field label="Username" value={username} onChange={setUsername} placeholder="@account" />
            <button className="secondary-button" type="submit">
              <Plus size={16} />
              Add manual account
            </button>
          </>
        ) : (
          <p className="m-0 max-w-[42rem] text-[0.86rem] leading-relaxed text-[var(--color-ink-muted)]">
            Connected accounts are managed in {providerRoute.label}. Sync pulls the latest account
            IDs, platforms, usernames, and publishing capabilities into this workspace.
          </p>
        )}
        {syncStatus && <p className="muted">{syncStatus}</p>}
      </FormPanel>

      <EntityGrid
        empty="No social accounts connected yet."
        items={accounts?.map((account) => ({
          id: account._id,
          title: account.username,
          eyebrow: `${account.platform} via ${account.provider}`,
          body: account.capabilities?.join(", ") || "Capabilities will sync from the provider.",
          meta: account.status,
        }))}
      />
    </Page>
  );
}
