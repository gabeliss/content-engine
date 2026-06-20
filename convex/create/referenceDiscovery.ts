import type { Doc } from "../_generated/dataModel";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  listSelectableLibraryAssets,
  type SelectableLibraryAsset,
  type SelectableMediaKind,
} from "../library/assets";
import { isRecord } from "./referenceResolution";

function mediaKindsFromInput(input: Record<string, unknown>) {
  const rawMediaTypes = input.mediaTypes;
  const values = Array.isArray(rawMediaTypes)
    ? rawMediaTypes
    : typeof rawMediaTypes === "string"
      ? [rawMediaTypes]
      : [];

  return new Set(
    values.filter((value): value is SelectableMediaKind =>
      value === "image" ||
      value === "video" ||
      value === "audio" ||
      value === "media"
    )
  );
}

function normalizedSearchText(asset: SelectableLibraryAsset) {
  return [
    asset.title,
    asset.prompt,
    asset.provider,
    asset.model,
    asset.source,
    asset.mediaKind,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function normalizedPersonaSearchText(persona: Doc<"personas">) {
  return [
    persona.name,
    persona.personaType,
    persona.description,
    persona.identityPrompt,
    persona.usageNotes,
    ...(persona.visualConstraints ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesQuery(asset: SelectableLibraryAsset, query?: string) {
  if (!query) return true;
  return normalizedSearchText(asset).includes(query.toLowerCase());
}

function matchesPersonaQuery(persona: Doc<"personas">, query?: string) {
  if (!query) return true;
  return normalizedPersonaSearchText(persona).includes(query.toLowerCase());
}

function mediaKindForCreativeAsset(asset: Doc<"creativeAssets">): SelectableMediaKind {
  if (asset.mediaType === "image" || asset.mediaType === "video" || asset.mediaType === "audio") {
    return asset.mediaType;
  }
  return "media";
}

async function personaReferenceAssets(
  ctx: MutationCtx,
  thread: Doc<"createThreads">,
  args: {
    mediaKinds: Set<SelectableMediaKind>;
    query?: string;
  }
) {
  const personas = thread.workspaceId
    ? await ctx.db
        .query("personas")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", thread.workspaceId))
        .collect()
    : await ctx.db
        .query("personas")
        .withIndex("by_user", (q) => q.eq("userId", thread.userId))
        .collect();

  const references = [];
  for (const persona of personas.filter((candidate) => matchesPersonaQuery(candidate, args.query))) {
    const assetIds = [
      ...persona.generatedAssetIds,
      ...persona.sourceAssetIds,
      ...persona.voiceAssetIds,
    ];
    for (const assetId of [...new Set(assetIds.map(String))] as Id<"creativeAssets">[]) {
      const asset = await ctx.db.get(assetId);
      if (!asset) continue;
      if (thread.workspaceId ? asset.workspaceId !== thread.workspaceId : asset.userId !== thread.userId) {
        continue;
      }
      const mediaKind = mediaKindForCreativeAsset(asset);
      if (args.mediaKinds.size && !args.mediaKinds.has(mediaKind)) continue;
      const metadata = isRecord(asset.metadata) ? asset.metadata : {};

      references.push({
        id: `persona:${String(persona._id)}:${String(asset._id)}`,
        source: "persona",
        sourceId: String(persona._id),
        creativeAssetId: String(asset._id),
        title: `${persona.name} - ${asset.name}`,
        mediaKind,
        storageUrl: asset.storageUrl,
        mimeType: typeof metadata.mimeType === "string" ? metadata.mimeType : undefined,
        prompt: [
          persona.identityPrompt,
          persona.description,
          persona.usageNotes,
          persona.visualConstraints?.length ? `Visual constraints: ${persona.visualConstraints.join(", ")}` : undefined,
          asset.usageNotes,
          asset.description,
        ]
          .map((value) => value?.trim())
          .filter(Boolean)
          .join("\n"),
        createdAt: Math.max(persona.createdAt, asset.createdAt),
      });
    }
  }

  return references;
}

export async function listReferencesForToolCall(
  ctx: MutationCtx,
  thread: Doc<"createThreads">,
  toolCall: Doc<"createToolCalls">
) {
  const input = isRecord(toolCall.input) ? toolCall.input : {};
  const query = typeof input.query === "string" ? input.query.trim() : undefined;
  const mediaKinds = mediaKindsFromInput(input);
  const limit = typeof input.limit === "number" && Number.isFinite(input.limit)
    ? Math.min(Math.max(Math.floor(input.limit), 1), 50)
    : 12;

  const libraryReferences = (await listSelectableLibraryAssets(ctx, {
    userId: thread.userId,
    workspaceId: thread.workspaceId,
  }))
    .filter((asset) => !mediaKinds.size || mediaKinds.has(asset.mediaKind))
    .filter((asset) => matchesQuery(asset, query))
    .slice(0, limit)
    .map((asset) => ({
      id: asset.id,
      source: asset.source,
      sourceId: asset.sourceId,
      title: asset.title,
      mediaKind: asset.mediaKind,
      storageUrl: asset.storageUrl,
      mimeType: asset.mimeType,
      prompt: asset.prompt,
      provider: asset.provider,
      model: asset.model,
      createdAt: asset.createdAt,
    }));
  const personaReferences = await personaReferenceAssets(ctx, thread, {
    mediaKinds,
    query,
  });
  const references = [...libraryReferences, ...personaReferences]
    .sort((first, second) => second.createdAt - first.createdAt)
    .slice(0, limit);

  const now = Date.now();
  await ctx.db.patch(toolCall._id, {
    status: "succeeded",
    output: {
      references,
      count: references.length,
      query,
      mediaTypes: [...mediaKinds],
    },
    completedAt: now,
    updatedAt: now,
  });

  return references;
}
