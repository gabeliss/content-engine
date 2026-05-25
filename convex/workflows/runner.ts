import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { storeGeneratedAsset } from "../content/assetStorage";
import { getModelProvider } from "../providers";
import type {
  GeneratedAsset,
  ModelProvider,
  ModelProviderName,
  ReferenceAsset,
} from "../providers/model";
import { artifactLifecycleValidator, workflowGraphValidator } from "../validators";
import {
  buildWorkflowAgentPrompt,
  getWorkflowAgentPreset,
  type WorkflowAgentOutputKind,
} from "./agentPresets";

type WorkflowGraphForRun = typeof workflowGraphValidator.type;
type WorkflowGraphNodeForRun = WorkflowGraphForRun["nodes"][number];
type ArtifactLifecycleForRun = typeof artifactLifecycleValidator.type;
type NodeRetentionModeForRun = "inherit" | "keep" | "discard" | "keep_on_failure";
type ResolvedInputsForRun = {
  inputs?: Record<string, {
    source?: string;
    value?: unknown;
    artifactIds?: string[];
    metadata?: Record<string, unknown>;
  }>;
  summary?: Record<string, unknown>;
};
type MediaKindForRun = "image" | "video" | "audio" | "media";

type MediaNodeItemForRun = {
  id: string;
  source: "artifact" | "brand_asset" | "persona_asset" | "uploaded";
  kind: MediaKindForRun;
  title?: string;
  storageUrl?: string;
  data?: unknown;
  metadata?: unknown;
};

function adjacencyForGraph(graph: WorkflowGraphForRun): Map<string, string[]> {
  const adjacency = new Map(graph.nodes.map((node) => [node.id, [] as string[]]));

  for (const edge of graph.edges) {
    adjacency.get(edge.sourceNodeId)?.push(edge.targetNodeId);
  }

  return adjacency;
}

function reachableNodeIdsFromRunner(graph: WorkflowGraphForRun): Set<string> {
  const runnerNode = graph.nodes.find((node) => node.type === "runner") ?? graph.nodes[0];
  if (!runnerNode) return new Set();

  const adjacency = adjacencyForGraph(graph);
  const reachableNodeIds = new Set<string>();
  const stack = [runnerNode.id];

  while (stack.length) {
    const nodeId = stack.pop();
    if (!nodeId || reachableNodeIds.has(nodeId)) continue;

    reachableNodeIds.add(nodeId);
    stack.push(...(adjacency.get(nodeId) ?? []));
  }

  return reachableNodeIds;
}

function dependencyNodeIdsForGraph(graph: WorkflowGraphForRun): Map<string, string[]> {
  const dependenciesByNodeId = new Map(
    graph.nodes.map((node) => [node.id, new Set<string>()])
  );

  for (const edge of graph.edges) {
    const dependencies = dependenciesByNodeId.get(edge.targetNodeId);
    if (dependencies) dependencies.add(edge.sourceNodeId);
  }

  return new Map(
    [...dependenciesByNodeId.entries()].map(([nodeId, dependencies]) => [
      nodeId,
      [...dependencies].sort(),
    ])
  );
}

function readyNodesForPass(
  nodes: WorkflowGraphNodeForRun[],
  dependencyNodeIdsByNode: Map<string, string[]>,
  pendingNodeIds: Set<string>,
  completedNodeIds: Set<string>
): WorkflowGraphNodeForRun[] {
  return nodes.filter((node) => {
    if (!pendingNodeIds.has(node.id)) return false;
    const dependencyNodeIds = dependencyNodeIdsByNode.get(node.id) ?? [];
    return dependencyNodeIds.every((nodeId) => completedNodeIds.has(nodeId));
  });
}

function outboundPortsForNode(
  graph: WorkflowGraphForRun,
  nodeId: string
): string[] {
  return [
    ...new Set(
      graph.edges
        .filter((edge) => edge.sourceNodeId === nodeId)
        .map((edge) => edge.sourcePort)
    ),
  ].sort();
}

function mediaNodeOutputPorts(): string[] {
  return ["media", "image", "video", "audio"];
}

function retentionModeForNode(node: WorkflowGraphNodeForRun): NodeRetentionModeForRun {
  const retention = node.retention;
  if (!retention || typeof retention !== "object" || Array.isArray(retention)) return "inherit";
  const mode = (retention as Record<string, unknown>).mode;

  if (
    mode === "inherit" ||
    mode === "keep" ||
    mode === "discard" ||
    mode === "keep_on_failure"
  ) {
    return mode;
  }

  return "inherit";
}

function placeholderLifecycleForNode(
  graph: WorkflowGraphForRun,
  node: WorkflowGraphNodeForRun
): ArtifactLifecycleForRun {
  const retentionMode = retentionModeForNode(node);
  const runMode = graph.runSettings?.mode ?? "production";
  const graphRetention = graph.runSettings?.artifactRetention;

  if (retentionMode === "keep") return "saved";
  if (retentionMode === "discard") return "discarded";
  if (retentionMode === "keep_on_failure") return "discarded";
  if (runMode === "test" || graphRetention === "keep_all") return "debug";
  return "discarded";
}

function isPostPackageNode(node: WorkflowGraphNodeForRun): boolean {
  return node.type === "post_compiler";
}

function isTerminalPackageConsumer(node: WorkflowGraphNodeForRun): boolean {
  return node.type === "export" || node.type === "auto_post";
}

function isMediaNode(node: WorkflowGraphNodeForRun): boolean {
  return node.type === "media";
}

function isLlmNode(node: WorkflowGraphNodeForRun): boolean {
  return node.type === "llm";
}

function isAiAgentNode(node: WorkflowGraphNodeForRun): boolean {
  return node.type === "ai_agent";
}

function isImageGenerationNode(node: WorkflowGraphNodeForRun): boolean {
  return node.type === "image_generation";
}

function isVideoGenerationNode(node: WorkflowGraphNodeForRun): boolean {
  return node.type === "video_generation";
}

function isImplementedNode(node: WorkflowGraphNodeForRun): boolean {
  return isMediaNode(node) ||
    isLlmNode(node) ||
    isAiAgentNode(node) ||
    isImageGenerationNode(node) ||
    isVideoGenerationNode(node);
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringFromValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const data = value as Record<string, unknown>;
  for (const key of ["caption", "text", "content", "prompt"]) {
    const candidate = data[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }

  return undefined;
}

function textFromInputValue(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const text = value.flatMap((item) => {
      const itemText = textFromInputValue(item);
      return itemText ? [itemText] : [];
    }).join("\n\n");
    return text.trim() || undefined;
  }
  if (!value || typeof value !== "object") return undefined;

  const data = value as Record<string, unknown>;
  for (const key of ["prompt", "text", "content", "caption", "script"]) {
    const candidate = textFromInputValue(data[key]);
    if (candidate) return candidate;
  }

  if (data.data && typeof data.data === "object") {
    const nestedText = textFromInputValue(data.data);
    if (nestedText) return nestedText;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return undefined;
  }
}

function numberFromInputValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function modelProviderNameForNode(node: WorkflowGraphNodeForRun): ModelProviderName {
  switch (node.provider) {
    case "bulkapis":
    case "gemini":
    case "fal":
    case "openrouter":
    case "manual":
      return node.provider;
    default:
      return "bulkapis";
  }
}

function llmResponseFormat(value: unknown): "text" | "json" {
  return value === "json" ||
    value === "json_object" ||
    value === "structured" ||
    value === "schema"
    ? "json"
    : "text";
}

function providerOverridesFromConfig(config: Record<string, unknown>) {
  const overrides = {
    ...objectValue(config.bulkapisInput),
    ...objectValue(config.providerInput),
  };
  const seed = numberFromInputValue(config.seed);
  if (seed !== undefined) overrides.seed = seed;
  return overrides;
}

function generationProviderInputFromConfig(
  config: Record<string, unknown>,
  excludedKeys: string[]
) {
  const overrides = {
    ...objectValue(config.bulkapisInput),
    ...objectValue(config.providerInput),
  };
  const excluded = new Set([
    ...excludedKeys,
    "bulkapisInput",
    "providerInput",
    "model",
  ]);

  for (const [key, value] of Object.entries(config)) {
    if (excluded.has(key) || value === undefined || value === "") continue;
    overrides[key] = value;
  }

  return overrides;
}

function looksLikeUrl(value: string): boolean {
  return value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:");
}

function referenceAssetMimeType(
  value: Record<string, unknown>,
  fallbackMimeType = "image/png"
): string {
  const data = objectValue(value.data);
  const metadata = objectValue(value.metadata);
  const mimeType = value.mimeType ?? data.mimeType ?? metadata.mimeType;
  return typeof mimeType === "string" && mimeType.trim()
    ? mimeType.trim()
    : fallbackMimeType;
}

function collectReferenceAssetsFromValue(
  value: unknown,
  output: ReferenceAsset[],
  seenUrls: Set<string>,
  options: {
    acceptedKinds: string[];
    defaultMimeType: string;
    mimePrefix: string;
  } = {
    acceptedKinds: ["image"],
    defaultMimeType: "image/png",
    mimePrefix: "image/",
  }
) {
  if (typeof value === "string") {
    const url = value.trim();
    if (looksLikeUrl(url) && !seenUrls.has(url)) {
      seenUrls.add(url);
      output.push({ url, mimeType: options.defaultMimeType });
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectReferenceAssetsFromValue(item, output, seenUrls, options);
    }
    return;
  }

  if (!value || typeof value !== "object") return;

  const record = value as Record<string, unknown>;
  if (Array.isArray(record.items)) {
    for (const item of record.items) {
      collectReferenceAssetsFromValue(item, output, seenUrls, options);
    }
  }

  const url = record.storageUrl ?? record.url;
  const kind = typeof record.kind === "string" ? record.kind : undefined;
  const mimeType = referenceAssetMimeType(record, options.defaultMimeType);
  if (
    typeof url === "string" &&
    looksLikeUrl(url.trim()) &&
    !seenUrls.has(url.trim()) &&
    (kind === undefined ||
      options.acceptedKinds.includes(kind) ||
      mimeType.startsWith(options.mimePrefix))
  ) {
    const trimmedUrl = url.trim();
    seenUrls.add(trimmedUrl);
    output.push({
      url: trimmedUrl,
      mimeType,
      description:
        typeof record.title === "string"
          ? record.title
          : typeof record.name === "string"
            ? record.name
            : undefined,
    });
  }

  if (record.data && typeof record.data === "object") {
    collectReferenceAssetsFromValue(record.data, output, seenUrls, options);
  }
}

function referenceAssetsFromInputs(
  resolvedInputs: ResolvedInputsForRun,
  preferredKeys: string[]
): ReferenceAsset[] {
  const inputs = resolvedInputs.inputs ?? {};
  const seenUrls = new Set<string>();
  const referenceAssets: ReferenceAsset[] = [];

  for (const key of preferredKeys) {
    collectReferenceAssetsFromValue(inputs[key]?.value, referenceAssets, seenUrls);
  }

  return referenceAssets;
}

function referenceVideoAssetsFromInputs(
  resolvedInputs: ResolvedInputsForRun,
  preferredKeys: string[]
): ReferenceAsset[] {
  const inputs = resolvedInputs.inputs ?? {};
  const seenUrls = new Set<string>();
  const referenceAssets: ReferenceAsset[] = [];

  for (const key of preferredKeys) {
    collectReferenceAssetsFromValue(inputs[key]?.value, referenceAssets, seenUrls, {
      acceptedKinds: ["video"],
      defaultMimeType: "video/mp4",
      mimePrefix: "video/",
    });
  }

  return referenceAssets;
}

function uniqueReferenceAssets(assets: ReferenceAsset[]): ReferenceAsset[] {
  const seen = new Set<string>();
  const uniqueAssets: ReferenceAsset[] = [];

  for (const asset of assets) {
    const key = asset.url ?? asset.base64Data;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniqueAssets.push(asset);
  }

  return uniqueAssets;
}

async function waitForGeneratedImage(
  provider: ModelProvider,
  args: {
    jobId?: string;
    model: string;
    metadata?: Record<string, unknown>;
  },
  onStatus?: (status: string) => Promise<void>
): Promise<GeneratedAsset> {
  if (!args.jobId) throw new Error("Image generation did not return an image or job id");

  let lastStatus = "unknown";
  let lastError = "";
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = await provider.getJobStatus({
      jobId: args.jobId,
      model: args.model,
      metadata: args.metadata,
    });
    lastStatus = result.status;
    lastError = result.errorMessage ?? "";
    await onStatus?.(result.status);

    if (result.status === "succeeded") {
      const asset = result.assets?.find((candidate) =>
        candidate.mimeType.startsWith("image/")
      );
      if (asset) return asset;
      throw new Error(`Image job ${args.jobId} succeeded but returned no image assets`);
    }
    if (result.status === "failed" || result.status === "canceled") {
      throw new Error(`Image job ${args.jobId} ${result.status}${result.errorMessage ? `: ${result.errorMessage}` : ""}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  throw new Error(`Image job ${args.jobId} timed out after 5 minutes with status ${lastStatus}${lastError ? `: ${lastError}` : ""}`);
}

async function waitForGeneratedVideo(
  provider: ModelProvider,
  args: {
    jobId?: string;
    model: string;
    metadata?: Record<string, unknown>;
  },
  onStatus?: (status: string) => Promise<void>
): Promise<GeneratedAsset> {
  if (!args.jobId) throw new Error("Video generation did not return a job id");

  let lastStatus = "unknown";
  let lastError = "";
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = await provider.getJobStatus({
      jobId: args.jobId,
      model: args.model,
      metadata: args.metadata,
    });
    lastStatus = result.status;
    lastError = result.errorMessage ?? "";
    await onStatus?.(result.status);

    if (result.status === "succeeded") {
      const asset = result.assets?.find((candidate) =>
        candidate.mimeType.startsWith("video/")
      );
      if (asset) return asset;
      throw new Error(`Video job ${args.jobId} succeeded but returned no video assets`);
    }
    if (result.status === "failed" || result.status === "canceled") {
      throw new Error(`Video job ${args.jobId} ${result.status}${result.errorMessage ? `: ${result.errorMessage}` : ""}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  throw new Error(`Video job ${args.jobId} timed out after 10 minutes with status ${lastStatus}${lastError ? `: ${lastError}` : ""}`);
}

function llmOutputRefsForNode(args: {
  nodeId: string;
  artifactId: Id<"artifacts">;
  text: string;
  responseFormat: "text" | "json";
  object?: unknown;
}) {
  const baseValue = {
    artifactId: args.artifactId,
    text: args.text,
    prompt: args.text,
    responseFormat: args.responseFormat,
    ...(args.object !== undefined ? { json: args.object } : {}),
  };

  return [
    {
      nodeId: args.nodeId,
      port: "text",
      artifactIds: [args.artifactId],
      value: baseValue,
    },
    ...(args.object !== undefined
      ? [{
          nodeId: args.nodeId,
          port: "json",
          artifactIds: [args.artifactId],
          value: {
            artifactId: args.artifactId,
            json: args.object,
            text: args.text,
            responseFormat: args.responseFormat,
          },
        }]
      : []),
    {
      nodeId: args.nodeId,
      port: "prompt",
      artifactIds: [args.artifactId],
      value: {
        artifactId: args.artifactId,
        prompt: args.text,
        text: args.text,
        responseFormat: args.responseFormat,
      },
    },
  ];
}

function textFieldFromObject(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return textFromInputValue((value as Record<string, unknown>)[key]);
}

function agentOutputText(args: {
  object: unknown;
  fallbackText: string;
  outputKind: WorkflowAgentOutputKind;
}): string {
  return textFieldFromObject(args.object, args.outputKind) ??
    textFieldFromObject(args.object, "text") ??
    textFieldFromObject(args.object, "prompt") ??
    textFieldFromObject(args.object, "script") ??
    textFieldFromObject(args.object, "analysis") ??
    args.fallbackText.trim();
}

function agentOutputRefsForNode(args: {
  nodeId: string;
  artifactId: Id<"artifacts">;
  text: string;
  object: unknown;
  outputKind: WorkflowAgentOutputKind;
}) {
  const commonValue = {
    artifactId: args.artifactId,
    outputKind: args.outputKind,
    text: args.text,
    [args.outputKind]: args.text,
    ...(args.outputKind === "prompt" ? { prompt: args.text } : {}),
    json: args.object,
  };
  return [
    {
      nodeId: args.nodeId,
      port: "text",
      artifactIds: [args.artifactId],
      value: commonValue,
    },
    {
      nodeId: args.nodeId,
      port: "json",
      artifactIds: [args.artifactId],
      value: {
        artifactId: args.artifactId,
        outputKind: args.outputKind,
        json: args.object,
        text: args.text,
      },
    },
    {
      nodeId: args.nodeId,
      port: args.outputKind,
      artifactIds: [args.artifactId],
      value: commonValue,
    },
  ];
}

function imageOutputRefsForNode(
  nodeId: string,
  images: MediaNodeItemForRun[]
) {
  const artifactIds = images
    .filter((item) => item.source === "artifact")
    .map((item) => item.id as Id<"artifacts">);

  return [{
    nodeId,
    port: "image",
    ...(artifactIds.length ? { artifactIds } : {}),
    value: {
      kind: "image",
      items: images,
      count: images.length,
    },
  }];
}

function videoOutputRefsForNode(
  nodeId: string,
  videos: MediaNodeItemForRun[]
) {
  const artifactIds = videos
    .filter((item) => item.source === "artifact")
    .map((item) => item.id as Id<"artifacts">);

  return [{
    nodeId,
    port: "video",
    ...(artifactIds.length ? { artifactIds } : {}),
    value: {
      kind: "video",
      items: videos,
      count: videos.length,
    },
  }];
}

function artifactIdsFromInputs(
  resolvedInputs: ResolvedInputsForRun,
  preferredKeys: string[]
): Id<"artifacts">[] {
  const ids = new Set<string>();
  const inputs = resolvedInputs.inputs ?? {};
  const orderedInputs = [
    ...preferredKeys.flatMap((key) => (inputs[key] ? [[key, inputs[key]] as const] : [])),
    ...Object.entries(inputs).filter(([key]) => !preferredKeys.includes(key)),
  ];

  for (const [, input] of orderedInputs) {
    for (const artifactId of input.artifactIds ?? []) {
      ids.add(artifactId);
    }
  }

  return [...ids] as Id<"artifacts">[];
}

function postPackageArtifactIdsFromInputs(
  resolvedInputs: ResolvedInputsForRun
): Id<"artifacts">[] {
  const inputs = resolvedInputs.inputs ?? {};
  const ids = new Set<string>();
  if (inputs.post_package) {
    for (const artifactId of inputs.post_package.artifactIds ?? []) {
      ids.add(artifactId);
    }
  }

  for (const input of [inputs.post_package, inputs.input].filter(Boolean)) {
    const value = objectValue(input?.value);
    if (value.type === "publish_payload" && typeof value.artifactId === "string") {
      ids.add(value.artifactId);
    }
  }

  return [...ids] as Id<"artifacts">[];
}

function postPackageDataForNode(
  node: WorkflowGraphNodeForRun,
  resolvedInputs: ResolvedInputsForRun,
  sourceArtifactIds: Id<"artifacts">[]
) {
  const inputs = resolvedInputs.inputs ?? {};
  const config = objectValue(node.config);
  const metadataInput = objectValue(inputs.metadata?.value);
  const platformSettings = objectValue(config.platformSettings);
  const destinationPolicy = objectValue(config.destinationPolicy);
  const configuredCaption = stringFromValue(config.caption);
  const inputCaption =
    stringFromValue(inputs.caption?.value) ??
    stringFromValue(inputs.text?.value) ??
    stringFromValue(inputs.input?.value);
  const postType =
    typeof config.postType === "string" && config.postType.trim()
      ? config.postType.trim()
      : "video";

  return {
    schemaVersion: 1,
    kind: "post_package",
    postType,
    name:
      typeof config.name === "string" && config.name.trim()
        ? config.name.trim()
        : `${node.label} package`,
    caption: configuredCaption ?? inputCaption,
    mediaArtifactIds: sourceArtifactIds.map((artifactId) => String(artifactId)),
    platformSettings,
    destinationPolicy: {
      destination:
        typeof config.destination === "string" && config.destination.trim()
          ? config.destination.trim()
          : undefined,
      ...destinationPolicy,
    },
    metadata: {
      ...metadataInput,
      sourceNodeId: node.id,
      sourceNodeType: node.type,
      inputSummary: resolvedInputs.summary ?? {},
    },
  };
}

function mediaOutputRefsForNode(
  nodeId: string,
  items: MediaNodeItemForRun[]
) {
  return mediaNodeOutputPorts().flatMap((port) => {
    const matchingItems =
      port === "media"
        ? items
        : items.filter((item) => item.kind === port);
    if (!matchingItems.length) return [];

    const artifactIds = matchingItems
      .filter((item) => item.source === "artifact")
      .map((item) => item.id as Id<"artifacts">);

    return [{
      nodeId,
      port,
      ...(artifactIds.length ? { artifactIds } : {}),
      value: {
        kind: port,
        items: matchingItems,
        count: matchingItems.length,
      },
    }];
  });
}

function stringArrayFromConfig(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function mediaKindFromMimeType(mimeType?: string): MediaKindForRun {
  if (!mimeType) return "media";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "media";
}

function mediaKindFromArtifact(artifact: {
  type: string;
  data?: unknown;
}): MediaKindForRun {
  const data = objectValue(artifact.data);
  const mimeType = typeof data.mimeType === "string" ? data.mimeType : undefined;
  const mimeKind = mediaKindFromMimeType(mimeType);
  if (mimeKind !== "media") return mimeKind;

  if (artifact.type === "image" || artifact.type === "thumbnail") return "image";
  if (artifact.type === "video") return "video";
  return "media";
}

function uploadedMediaItemsFromConfig(value: unknown): MediaNodeItemForRun[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item, index): MediaNodeItemForRun[] => {
    if (typeof item === "string" && item.trim()) {
      return [{
        id: `uploaded:${index}`,
        source: "uploaded",
        kind: "media",
        storageUrl: item.trim(),
      } satisfies MediaNodeItemForRun];
    }

    const record = objectValue(item);
    const storageUrl = record.storageUrl ?? record.url;
    if (typeof storageUrl !== "string" || !storageUrl.trim()) return [];
    const mimeType = typeof record.mimeType === "string" ? record.mimeType : undefined;
    const configuredKind = record.kind;
    const kind =
      configuredKind === "image" ||
      configuredKind === "video" ||
      configuredKind === "audio" ||
      configuredKind === "media"
        ? configuredKind
        : mediaKindFromMimeType(mimeType);

    return [{
      id: typeof record.id === "string" && record.id.trim()
        ? record.id.trim()
        : `uploaded:${index}`,
      source: "uploaded",
      kind,
      title: typeof record.title === "string" ? record.title : undefined,
      storageUrl: storageUrl.trim(),
      metadata: record,
    } satisfies MediaNodeItemForRun];
  });
}

export const executeRun = internalAction({
  args: { runId: v.id("workflowRuns") },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internal.workflows.runs.getExecutionContext, {
      runId: args.runId,
    });
    if (!context) {
      throw new Error("Workflow run context not found");
    }

    const graph = context.workflow.graph;
    const reachableNodeIds = reachableNodeIdsFromRunner(graph);
    const runnableNodes = graph.nodes.filter((node) => reachableNodeIds.has(node.id));
    const dependencyNodeIdsByNode = dependencyNodeIdsForGraph(graph);
    const pendingNodeIds = new Set(runnableNodes.map((node) => node.id));
    const completedNodeIds = new Set<string>();
    const emittedArtifactIds = new Set<Id<"artifacts">>();
    const finalPackageArtifactIds = new Set<Id<"artifacts">>();
    let executedNodeCount = 0;
    let passCount = 0;
    let totalCostUsd = 0;

    await ctx.runMutation(internal.workflows.runs.transitionRun, {
      runId: context.run._id,
      status: "running",
      ...(runnableNodes[0] ? { currentNodeId: runnableNodes[0].id } : {}),
    });

    if (!runnableNodes.length) {
      const message = "Workflow graph has no nodes reachable from the runner.";
      await ctx.runMutation(internal.workflows.runs.recordEvent, {
        userId: context.run.userId,
        workflowRunId: context.run._id,
        workflowId: context.workflow._id,
        type: "error",
        message,
      });
      await ctx.runMutation(internal.workflows.runs.transitionRun, {
        runId: context.run._id,
        status: "failed",
        errorMessage: message,
        completedAt: Date.now(),
      });
      return;
    }

    while (pendingNodeIds.size) {
      passCount += 1;
      const readyNodes = readyNodesForPass(
        runnableNodes,
        dependencyNodeIdsByNode,
        pendingNodeIds,
        completedNodeIds
      );

      if (!readyNodes.length) {
        const message =
          "Workflow graph executor could not find a runnable node. Check for invalid dependencies.";
        await ctx.runMutation(internal.workflows.runs.recordEvent, {
          userId: context.run.userId,
          workflowRunId: context.run._id,
          workflowId: context.workflow._id,
          type: "error",
          message,
          data: {
            pendingNodeIds: [...pendingNodeIds].sort(),
            completedNodeIds: [...completedNodeIds].sort(),
          },
        });
        await ctx.runMutation(internal.workflows.runs.transitionRun, {
          runId: context.run._id,
          status: "failed",
          errorMessage: message,
          completedAt: Date.now(),
        });
        return;
      }

      for (const node of readyNodes) {
        await ctx.runMutation(internal.workflows.runs.transitionNodeState, {
          runId: context.run._id,
          nodeId: node.id,
          status: "queued",
        });
      }

      for (const node of readyNodes) {
        try {
          const resolvedInputs = await ctx.runQuery(
            internal.workflows.inputResolver.resolveForNode,
            {
              runId: context.run._id,
              nodeId: node.id,
            }
          );

          await ctx.runMutation(internal.workflows.runs.transitionRun, {
            runId: context.run._id,
            status: "running",
            currentNodeId: node.id,
          });
          await ctx.runMutation(internal.workflows.runs.transitionNodeState, {
            runId: context.run._id,
            nodeId: node.id,
            status: "running",
          });
          await ctx.runMutation(internal.workflows.runs.recordEvent, {
            userId: context.run.userId,
            workflowRunId: context.run._id,
            workflowId: context.workflow._id,
            type: "node_started",
            nodeId: node.id,
            message: `${node.label} started.`,
            data: {
              nodeType: node.type,
              inputSummary: resolvedInputs.summary,
              placeholderExecution: !isImplementedNode(node),
            },
          });

          if (isMediaNode(node)) {
            const mediaItems = await ctx.runQuery(
              internal.workflows.runner.resolveMediaNodeItems,
              {
                runId: context.run._id,
                nodeId: node.id,
              }
            );
            const outputRefs = mediaOutputRefsForNode(node.id, mediaItems);

            await ctx.runMutation(internal.workflows.runs.transitionNodeState, {
              runId: context.run._id,
              nodeId: node.id,
              status: "succeeded",
              outputRefs,
              costUsd: 0,
            });
            await ctx.runMutation(internal.workflows.runs.recordEvent, {
              userId: context.run.userId,
              workflowRunId: context.run._id,
              workflowId: context.workflow._id,
              type: "node_completed",
              nodeId: node.id,
              message: `${node.label} exposed ${mediaItems.length} media reference${mediaItems.length === 1 ? "" : "s"}.`,
              data: {
                nodeType: node.type,
                mediaCount: mediaItems.length,
                outputPorts: outputRefs.map((outputRef) => outputRef.port),
                placeholderExecution: false,
              },
            });

            pendingNodeIds.delete(node.id);
            completedNodeIds.add(node.id);
            executedNodeCount += 1;
            continue;
          }

          if (isLlmNode(node)) {
            const config = objectValue(node.config);
            const inputs = resolvedInputs.inputs ?? {};
            const providerName = modelProviderNameForNode(node);
            const provider = getModelProvider(providerName);
            const responseFormat = llmResponseFormat(inputs.responseFormat?.value);
            const prompt = textFromInputValue(inputs.prompt?.value);
            const contextText = textFromInputValue(inputs.context?.value);
            const systemPrompt = textFromInputValue(inputs.systemPrompt?.value);
            const userPrompt = [contextText ? `Context:\n${contextText}` : undefined, prompt]
              .filter(Boolean)
              .join("\n\n");
            const model =
              typeof node.model === "string" && node.model.trim()
                ? node.model.trim()
                : textFromInputValue(inputs.model?.value);
            const temperature = numberFromInputValue(inputs.temperature?.value);
            const maxTokens = numberFromInputValue(inputs.maxTokens?.value);
            const providerOverrides = providerOverridesFromConfig(config);
            const providerMetadata = {
              workflowId: String(context.workflow._id),
              workflowRunId: String(context.run._id),
              nodeId: node.id,
              nodeType: node.type,
              ...(Object.keys(providerOverrides).length
                ? { bulkapisInput: providerOverrides }
                : {}),
            };

            if (!userPrompt.trim()) {
              throw new Error(`${node.label} needs a prompt or context input.`);
            }
            if (!provider.capabilities.text) {
              throw new Error(`${provider.displayName} does not support text generation.`);
            }
            if (responseFormat === "json" && !provider.capabilities.structured) {
              throw new Error(`${provider.displayName} does not support structured generation.`);
            }

            const textResult =
              responseFormat === "json"
                ? await provider.generateStructured<unknown>({
                    prompt: userPrompt,
                    systemPrompt,
                    model,
                    temperature,
                    maxTokens,
                    schema: config.schema ?? config.jsonSchema ?? config.outputSchema,
                    schemaName:
                      typeof config.schemaName === "string" && config.schemaName.trim()
                        ? config.schemaName.trim()
                        : "workflow_llm_output",
                    metadata: providerMetadata,
                  })
                : await provider.generateText({
                    prompt: userPrompt,
                    systemPrompt,
                    model,
                    temperature,
                    maxTokens,
                    metadata: providerMetadata,
                  });
            const outputText = textResult.text.trim();
            const outputObject = "object" in textResult ? textResult.object : undefined;
            const lifecycle = placeholderLifecycleForNode(graph, node);
            const artifactId = await ctx.runMutation(
              internal.artifacts.records.createFromRunner,
              {
                userId: context.run.userId,
                brandId: context.run.brandId,
                workflowId: context.workflow._id,
                workflowRunId: context.run._id,
                parentArtifactIds: artifactIdsFromInputs(resolvedInputs, [
                  "context",
                  "input",
                ]),
                type: "text_draft",
                title: `${node.label} output`,
                data: {
                  nodeId: node.id,
                  nodeType: node.type,
                  responseFormat,
                  text: outputText,
                  ...(outputObject !== undefined ? { json: outputObject } : {}),
                  inputSummary: resolvedInputs.summary,
                  providerMetadata: textResult.metadata,
                },
                provider: textResult.metadata.provider,
                model: textResult.metadata.model,
                prompt: userPrompt,
                lifecycle,
                reviewStatus: "not_required",
              }
            );
            emittedArtifactIds.add(artifactId);

            const outputRefs = llmOutputRefsForNode({
              nodeId: node.id,
              artifactId,
              text: outputText,
              responseFormat,
              object: outputObject,
            });
            const costUsd = textResult.metadata.costUsd ?? 0;
            totalCostUsd += costUsd;

            await ctx.runMutation(internal.workflows.runs.transitionNodeState, {
              runId: context.run._id,
              nodeId: node.id,
              status: "succeeded",
              outputRefs,
              costUsd,
            });
            await ctx.runMutation(internal.workflows.runs.recordEvent, {
              userId: context.run.userId,
              workflowRunId: context.run._id,
              workflowId: context.workflow._id,
              type: "model_call",
              nodeId: node.id,
              message: `${node.label} called ${provider.displayName}.`,
              data: {
                provider: textResult.metadata.provider,
                model: textResult.metadata.model,
                usage: textResult.metadata.usage,
                costUsd,
              },
            });
            await ctx.runMutation(internal.workflows.runs.recordEvent, {
              userId: context.run.userId,
              workflowRunId: context.run._id,
              workflowId: context.workflow._id,
              type: "node_completed",
              nodeId: node.id,
              message: `${node.label} generated ${responseFormat === "json" ? "structured output" : "text"}.`,
              data: {
                nodeType: node.type,
                lifecycle,
                artifactId,
                provider: textResult.metadata.provider,
                model: textResult.metadata.model,
                outputPorts: outputRefs.map((outputRef) => outputRef.port),
                placeholderExecution: false,
              },
            });

            pendingNodeIds.delete(node.id);
            completedNodeIds.add(node.id);
            executedNodeCount += 1;
            continue;
          }

          if (isAiAgentNode(node)) {
            const config = objectValue(node.config);
            const inputs = resolvedInputs.inputs ?? {};
            const preset = getWorkflowAgentPreset(inputs.agentMode?.value);
            const providerName = modelProviderNameForNode(node);
            const provider = getModelProvider(providerName);
            const request = textFromInputValue(inputs.request?.value);
            const contextText = textFromInputValue(inputs.context?.value);
            const mediaText = textFromInputValue(inputs.media?.value);
            const model =
              typeof node.model === "string" && node.model.trim()
                ? node.model.trim()
                : textFromInputValue(inputs.model?.value);
            const temperature = numberFromInputValue(inputs.temperature?.value);
            const maxTokens = numberFromInputValue(inputs.maxTokens?.value);
            const customSystemPrompt = textFromInputValue(inputs.systemPrompt?.value);
            const systemPrompt = [preset.systemPrompt, customSystemPrompt]
              .filter(Boolean)
              .join("\n\n");
            const userPrompt = buildWorkflowAgentPrompt(preset, {
              request,
              contextText,
              mediaText,
              config,
            });
            const providerOverrides = providerOverridesFromConfig(config);
            const providerMetadata = {
              workflowId: String(context.workflow._id),
              workflowRunId: String(context.run._id),
              nodeId: node.id,
              nodeType: node.type,
              agentPreset: preset.id,
              ...(Object.keys(providerOverrides).length
                ? { bulkapisInput: providerOverrides }
                : {}),
            };

            if (![request, contextText, mediaText].some((value) => value?.trim())) {
              throw new Error(`${node.label} needs a request, context, or media input.`);
            }
            if (!provider.capabilities.structured) {
              throw new Error(`${provider.displayName} does not support structured generation.`);
            }

            const structuredResult = await provider.generateStructured<unknown>({
              prompt: userPrompt,
              systemPrompt,
              model,
              temperature,
              maxTokens,
              schemaName: `${preset.id}_agent_output`,
              metadata: providerMetadata,
            });
            const outputText = agentOutputText({
              object: structuredResult.object,
              fallbackText: structuredResult.text,
              outputKind: preset.outputKind,
            });
            const lifecycle = placeholderLifecycleForNode(graph, node);
            const artifactId = await ctx.runMutation(
              internal.artifacts.records.createFromRunner,
              {
                userId: context.run.userId,
                brandId: context.run.brandId,
                workflowId: context.workflow._id,
                workflowRunId: context.run._id,
                parentArtifactIds: artifactIdsFromInputs(resolvedInputs, [
                  "media",
                  "context",
                  "input",
                ]),
                type: preset.artifactType,
                title: `${node.label} ${preset.label} output`,
                data: {
                  nodeId: node.id,
                  nodeType: node.type,
                  agentPreset: preset.id,
                  outputKind: preset.outputKind,
                  text: outputText,
                  json: structuredResult.object,
                  inputSummary: resolvedInputs.summary,
                  providerMetadata: structuredResult.metadata,
                },
                provider: structuredResult.metadata.provider,
                model: structuredResult.metadata.model,
                prompt: userPrompt,
                lifecycle,
                reviewStatus: "not_required",
              }
            );
            emittedArtifactIds.add(artifactId);

            const outputRefs = agentOutputRefsForNode({
              nodeId: node.id,
              artifactId,
              text: outputText,
              object: structuredResult.object,
              outputKind: preset.outputKind,
            });
            const costUsd = structuredResult.metadata.costUsd ?? 0;
            totalCostUsd += costUsd;

            await ctx.runMutation(internal.workflows.runs.transitionNodeState, {
              runId: context.run._id,
              nodeId: node.id,
              status: "succeeded",
              outputRefs,
              costUsd,
            });
            await ctx.runMutation(internal.workflows.runs.recordEvent, {
              userId: context.run.userId,
              workflowRunId: context.run._id,
              workflowId: context.workflow._id,
              type: "model_call",
              nodeId: node.id,
              message: `${node.label} ran ${preset.label}.`,
              data: {
                provider: structuredResult.metadata.provider,
                model: structuredResult.metadata.model,
                usage: structuredResult.metadata.usage,
                costUsd,
                agentPreset: preset.id,
              },
            });
            await ctx.runMutation(internal.workflows.runs.recordEvent, {
              userId: context.run.userId,
              workflowRunId: context.run._id,
              workflowId: context.workflow._id,
              type: "node_completed",
              nodeId: node.id,
              message: `${node.label} produced ${preset.outputKind} output.`,
              data: {
                nodeType: node.type,
                lifecycle,
                artifactId,
                provider: structuredResult.metadata.provider,
                model: structuredResult.metadata.model,
                agentPreset: preset.id,
                outputKind: preset.outputKind,
                outputPorts: outputRefs.map((outputRef) => outputRef.port),
                placeholderExecution: false,
              },
            });

            pendingNodeIds.delete(node.id);
            completedNodeIds.add(node.id);
            executedNodeCount += 1;
            continue;
          }

          if (isImageGenerationNode(node)) {
            const config = objectValue(node.config);
            const inputs = resolvedInputs.inputs ?? {};
            const providerName = modelProviderNameForNode(node);
            const provider = getModelProvider(providerName);
            const prompt = textFromInputValue(inputs.prompt?.value);
            const model =
              typeof node.model === "string" && node.model.trim()
                ? node.model.trim()
                : textFromInputValue(inputs.model?.value);
            const aspectRatio = textFromInputValue(inputs.aspectRatio?.value);
            const count = Math.max(1, Math.floor(numberFromInputValue(inputs.count?.value) ?? 1));
            const referenceImages = referenceAssetsFromInputs(resolvedInputs, [
              "reference_image",
              "image",
              "media",
              "referenceImageUrl",
            ]);
            const sourceArtifactIds = artifactIdsFromInputs(resolvedInputs, [
              "reference_image",
              "image",
              "media",
              "input",
            ]);
            const providerInput = generationProviderInputFromConfig(config, [
              "prompt",
              "aspectRatio",
              "count",
              "referenceImageUrl",
            ]);

            if (!prompt) {
              throw new Error(`${node.label} needs a prompt input.`);
            }
            if (!provider.capabilities.image) {
              throw new Error(`${provider.displayName} does not support image generation.`);
            }

            const imageResult = await provider.generateImage({
              prompt,
              model,
              aspectRatio,
              count,
              referenceImages: referenceImages.length ? referenceImages : undefined,
              metadata: {
                workflowId: String(context.workflow._id),
                workflowRunId: String(context.run._id),
                nodeId: node.id,
                nodeType: node.type,
                referenceImageCount: referenceImages.length,
                ...(Object.keys(providerInput).length ? { bulkapisInput: providerInput } : {}),
              },
            });
            const providerJob = imageResult.jobId
              ? {
                  provider: imageResult.metadata.provider,
                  model: imageResult.metadata.model,
                  externalJobId: imageResult.jobId,
                  status: imageResult.status ?? "queued",
                  submittedAt: Date.now(),
                  raw: imageResult.raw,
                }
              : undefined;

            if (providerJob) {
              await ctx.runMutation(internal.workflows.runs.transitionNodeState, {
                runId: context.run._id,
                nodeId: node.id,
                status: "running",
                providerJob,
              });
            }

            const generatedAssets = [...imageResult.images];
            if (!generatedAssets.length && imageResult.jobId) {
              generatedAssets.push(
                await waitForGeneratedImage(
                  provider,
                  {
                    jobId: imageResult.jobId,
                    model: imageResult.metadata.model,
                    metadata: imageResult.metadata,
                  },
                  async (status) => {
                    await ctx.runMutation(internal.workflows.runs.transitionNodeState, {
                      runId: context.run._id,
                      nodeId: node.id,
                      status: "running",
                      providerJob: {
                        provider: imageResult.metadata.provider,
                        model: imageResult.metadata.model,
                        externalJobId: imageResult.jobId!,
                        status,
                        ...(status === "succeeded" ? { completedAt: Date.now() } : {}),
                      },
                    });
                  }
                )
              );
            }

            if (!generatedAssets.length) {
              throw new Error(`${node.label} did not return any images.`);
            }

            const lifecycle = placeholderLifecycleForNode(graph, node);
            const imageItems: MediaNodeItemForRun[] = [];
            for (const [index, image] of generatedAssets.entries()) {
              if (!image.mimeType.startsWith("image/")) continue;

              const stored = await storeGeneratedAsset(ctx, image);
              const artifactId = await ctx.runMutation(
                internal.artifacts.records.createFromRunner,
                {
                  userId: context.run.userId,
                  brandId: context.run.brandId,
                  workflowId: context.workflow._id,
                  workflowRunId: context.run._id,
                  parentArtifactIds: sourceArtifactIds.length ? sourceArtifactIds : undefined,
                  type: "image",
                  title: `${node.label} image ${index + 1}`,
                  storageUrl: stored.storageUrl,
                  data: {
                    storageId: stored.storageId,
                    mimeType: stored.mimeType,
                    fileSize: stored.byteLength,
                    aspectRatio,
                    sourceMimeType: image.mimeType,
                    jobId: imageResult.jobId,
                    status: "succeeded",
                    referenceImageCount: referenceImages.length,
                    inputSummary: resolvedInputs.summary,
                    providerMetadata: imageResult.metadata,
                  },
                  provider: imageResult.metadata.provider,
                  model: imageResult.metadata.model,
                  prompt,
                  lifecycle,
                  reviewStatus: "not_required",
                }
              );
              emittedArtifactIds.add(artifactId);
              imageItems.push({
                id: String(artifactId),
                source: "artifact",
                kind: "image",
                title: `${node.label} image ${index + 1}`,
                storageUrl: stored.storageUrl,
                metadata: {
                  mimeType: stored.mimeType,
                  fileSize: stored.byteLength,
                  provider: imageResult.metadata.provider,
                  model: imageResult.metadata.model,
                },
              });
            }

            if (!imageItems.length) {
              throw new Error(`${node.label} returned assets but none were images.`);
            }

            const outputRefs = imageOutputRefsForNode(node.id, imageItems);
            const costUsd = imageResult.metadata.costUsd ?? 0;
            totalCostUsd += costUsd;

            await ctx.runMutation(internal.workflows.runs.transitionNodeState, {
              runId: context.run._id,
              nodeId: node.id,
              status: "succeeded",
              outputRefs,
              costUsd,
              ...(imageResult.jobId
                ? {
                    providerJob: {
                      provider: imageResult.metadata.provider,
                      model: imageResult.metadata.model,
                      externalJobId: imageResult.jobId,
                      status: "succeeded",
                      completedAt: Date.now(),
                    },
                  }
                : {}),
            });
            await ctx.runMutation(internal.workflows.runs.recordEvent, {
              userId: context.run.userId,
              workflowRunId: context.run._id,
              workflowId: context.workflow._id,
              type: "model_call",
              nodeId: node.id,
              message: `${node.label} generated ${imageItems.length} image${imageItems.length === 1 ? "" : "s"}.`,
              data: {
                provider: imageResult.metadata.provider,
                model: imageResult.metadata.model,
                usage: imageResult.metadata.usage,
                costUsd,
                jobId: imageResult.jobId,
                status: imageResult.status,
                referenceImageCount: referenceImages.length,
              },
            });
            await ctx.runMutation(internal.workflows.runs.recordEvent, {
              userId: context.run.userId,
              workflowRunId: context.run._id,
              workflowId: context.workflow._id,
              type: "node_completed",
              nodeId: node.id,
              message: `${node.label} produced ${imageItems.length} image output${imageItems.length === 1 ? "" : "s"}.`,
              data: {
                nodeType: node.type,
                lifecycle,
                artifactIds: imageItems.map((item) => item.id),
                provider: imageResult.metadata.provider,
                model: imageResult.metadata.model,
                outputPorts: outputRefs.map((outputRef) => outputRef.port),
                placeholderExecution: false,
              },
            });

            pendingNodeIds.delete(node.id);
            completedNodeIds.add(node.id);
            executedNodeCount += 1;
            continue;
          }

          if (isVideoGenerationNode(node)) {
            const config = objectValue(node.config);
            const inputs = resolvedInputs.inputs ?? {};
            const providerName = modelProviderNameForNode(node);
            const provider = getModelProvider(providerName);
            const prompt = textFromInputValue(inputs.prompt?.value);
            const model =
              typeof node.model === "string" && node.model.trim()
                ? node.model.trim()
                : textFromInputValue(inputs.model?.value);
            const aspectRatio = textFromInputValue(inputs.aspectRatio?.value);
            const durationSeconds = numberFromInputValue(inputs.durationSeconds?.value);
            const startFrameAssets = referenceAssetsFromInputs(resolvedInputs, [
              "start_frame",
              "startFrameUrl",
            ]);
            const endFrameAssets = referenceAssetsFromInputs(resolvedInputs, [
              "end_frame",
              "endFrameUrl",
            ]);
            const imageAssets = referenceAssetsFromInputs(resolvedInputs, [
              "image",
              "imageUrl",
              "reference_image",
              "media",
            ]);
            const referenceImages = uniqueReferenceAssets([
              ...startFrameAssets,
              ...endFrameAssets,
              ...imageAssets,
            ]);
            const referenceVideos = referenceVideoAssetsFromInputs(resolvedInputs, [
              "reference_video",
              "referenceVideoUrl",
              "video",
              "videoUrl",
              "media",
            ]);
            const sourceArtifactIds = artifactIdsFromInputs(resolvedInputs, [
              "image",
              "start_frame",
              "end_frame",
              "reference_video",
              "video",
              "media",
              "input",
            ]);
            const providerInput = generationProviderInputFromConfig(config, [
              "prompt",
              "aspectRatio",
              "durationSeconds",
              "imageUrl",
              "startFrameUrl",
              "endFrameUrl",
              "referenceVideoUrl",
              "videoUrl",
            ]);
            const startFrameUrl = startFrameAssets[0]?.url;
            const endFrameUrl = endFrameAssets[0]?.url;
            const referenceVideoUrl = referenceVideos[0]?.url;
            if (startFrameUrl) {
              providerInput.start_frame_url = startFrameUrl;
              providerInput.start_image_url = startFrameUrl;
            }
            if (endFrameUrl) {
              providerInput.end_frame_url = endFrameUrl;
              providerInput.end_image_url = endFrameUrl;
            }
            if (referenceVideoUrl) {
              providerInput.reference_video_url = referenceVideoUrl;
              providerInput.video_url = providerInput.video_url ?? referenceVideoUrl;
            }
            if (referenceVideos.length > 1) {
              providerInput.reference_video_urls = referenceVideos.flatMap((asset) =>
                asset.url ? [asset.url] : []
              );
            }

            if (!prompt) {
              throw new Error(`${node.label} needs a prompt input.`);
            }
            if (!provider.capabilities.video) {
              throw new Error(`${provider.displayName} does not support video generation.`);
            }

            const providerMetadata = {
              workflowId: String(context.workflow._id),
              workflowRunId: String(context.run._id),
              nodeId: node.id,
              nodeType: node.type,
              referenceImageCount: referenceImages.length,
              referenceVideoCount: referenceVideos.length,
              ...(Object.keys(providerInput).length
                ? {
                    arguments: providerInput,
                    bulkapisInput: providerInput,
                  }
                : {}),
            };
            const videoResult = await provider.generateVideo({
              prompt,
              model,
              aspectRatio,
              durationSeconds,
              referenceImages: referenceImages.length ? referenceImages : undefined,
              metadata: providerMetadata,
            });
            await ctx.runMutation(internal.workflows.runs.transitionNodeState, {
              runId: context.run._id,
              nodeId: node.id,
              status: "running",
              providerJob: {
                provider: videoResult.metadata.provider,
                model: videoResult.metadata.model,
                externalJobId: videoResult.jobId,
                status: videoResult.status,
                submittedAt: Date.now(),
                raw: videoResult.raw,
              },
            });

            const videoAsset = await waitForGeneratedVideo(
              provider,
              {
                jobId: videoResult.jobId,
                model: videoResult.metadata.model,
                metadata: videoResult.metadata,
              },
              async (status) => {
                await ctx.runMutation(internal.workflows.runs.transitionNodeState, {
                  runId: context.run._id,
                  nodeId: node.id,
                  status: "running",
                  providerJob: {
                    provider: videoResult.metadata.provider,
                    model: videoResult.metadata.model,
                    externalJobId: videoResult.jobId,
                    status,
                    ...(status === "succeeded" ? { completedAt: Date.now() } : {}),
                  },
                });
              }
            );
            const lifecycle = placeholderLifecycleForNode(graph, node);
            const stored = await storeGeneratedAsset(ctx, videoAsset);
            const artifactId = await ctx.runMutation(
              internal.artifacts.records.createFromRunner,
              {
                userId: context.run.userId,
                brandId: context.run.brandId,
                workflowId: context.workflow._id,
                workflowRunId: context.run._id,
                parentArtifactIds: sourceArtifactIds.length ? sourceArtifactIds : undefined,
                type: "video",
                title: `${node.label} video`,
                storageUrl: stored.storageUrl,
                data: {
                  storageId: stored.storageId,
                  mimeType: stored.mimeType,
                  fileSize: stored.byteLength,
                  aspectRatio,
                  durationSeconds,
                  sourceMimeType: videoAsset.mimeType,
                  jobId: videoResult.jobId,
                  status: "succeeded",
                  referenceImageCount: referenceImages.length,
                  referenceVideoCount: referenceVideos.length,
                  inputSummary: resolvedInputs.summary,
                  providerMetadata: videoResult.metadata,
                },
                provider: videoResult.metadata.provider,
                model: videoResult.metadata.model,
                prompt,
                lifecycle,
                reviewStatus: "not_required",
              }
            );
            emittedArtifactIds.add(artifactId);

            const videoItems: MediaNodeItemForRun[] = [{
              id: String(artifactId),
              source: "artifact",
              kind: "video",
              title: `${node.label} video`,
              storageUrl: stored.storageUrl,
              metadata: {
                mimeType: stored.mimeType,
                fileSize: stored.byteLength,
                provider: videoResult.metadata.provider,
                model: videoResult.metadata.model,
              },
            }];
            const outputRefs = videoOutputRefsForNode(node.id, videoItems);
            const costUsd = videoResult.metadata.costUsd ?? 0;
            totalCostUsd += costUsd;

            await ctx.runMutation(internal.workflows.runs.transitionNodeState, {
              runId: context.run._id,
              nodeId: node.id,
              status: "succeeded",
              outputRefs,
              costUsd,
              providerJob: {
                provider: videoResult.metadata.provider,
                model: videoResult.metadata.model,
                externalJobId: videoResult.jobId,
                status: "succeeded",
                completedAt: Date.now(),
              },
            });
            await ctx.runMutation(internal.workflows.runs.recordEvent, {
              userId: context.run.userId,
              workflowRunId: context.run._id,
              workflowId: context.workflow._id,
              type: "model_call",
              nodeId: node.id,
              message: `${node.label} generated a video.`,
              data: {
                provider: videoResult.metadata.provider,
                model: videoResult.metadata.model,
                usage: videoResult.metadata.usage,
                costUsd,
                jobId: videoResult.jobId,
                status: videoResult.status,
                referenceImageCount: referenceImages.length,
                referenceVideoCount: referenceVideos.length,
              },
            });
            await ctx.runMutation(internal.workflows.runs.recordEvent, {
              userId: context.run.userId,
              workflowRunId: context.run._id,
              workflowId: context.workflow._id,
              type: "node_completed",
              nodeId: node.id,
              message: `${node.label} produced a video output.`,
              data: {
                nodeType: node.type,
                lifecycle,
                artifactId,
                provider: videoResult.metadata.provider,
                model: videoResult.metadata.model,
                outputPorts: outputRefs.map((outputRef) => outputRef.port),
                placeholderExecution: false,
              },
            });

            pendingNodeIds.delete(node.id);
            completedNodeIds.add(node.id);
            executedNodeCount += 1;
            continue;
          }

          const outboundPorts = outboundPortsForNode(graph, node.id);
          const packageArtifactIds = postPackageArtifactIdsFromInputs(resolvedInputs);
          const shouldCreatePostPackage =
            isPostPackageNode(node) ||
            (isTerminalPackageConsumer(node) && packageArtifactIds.length === 0);
          const sourceArtifactIds = artifactIdsFromInputs(resolvedInputs, [
            "media",
            "video",
            "image",
            "audio",
            "input",
          ]);
          const createdPostPackageArtifactId = shouldCreatePostPackage
            ? await ctx.runMutation(internal.workflows.runner.createPostPackageArtifact, {
                userId: context.run.userId,
                brandId: context.run.brandId,
                workflowId: context.workflow._id,
                workflowRunId: context.run._id,
                nodeId: node.id,
                label: node.label,
                sourceArtifactIds,
                packageData: postPackageDataForNode(node, resolvedInputs, sourceArtifactIds),
              })
            : undefined;
          const consumedOrCreatedPackageIds = [
            ...packageArtifactIds,
            ...(createdPostPackageArtifactId ? [createdPostPackageArtifactId] : []),
          ];
          for (const artifactId of consumedOrCreatedPackageIds) {
            finalPackageArtifactIds.add(artifactId);
            emittedArtifactIds.add(artifactId);
          }
          const outputRefs = outboundPorts.map((port) => ({
            nodeId: node.id,
            port,
            value: {
              placeholderExecution: !createdPostPackageArtifactId,
              nodeId: node.id,
              nodeType: node.type,
              label: node.label,
              ...(createdPostPackageArtifactId
                ? {
                    kind: "post_package",
                    artifactId: createdPostPackageArtifactId,
                  }
                : {}),
              inputSummary: resolvedInputs.summary,
            },
          }));
          const lifecycle = placeholderLifecycleForNode(graph, node);
          const placeholderArtifactId = createdPostPackageArtifactId
            ? undefined
            : await ctx.runMutation(
                internal.workflows.runner.createPlaceholderArtifact,
                {
                  userId: context.run.userId,
                  brandId: context.run.brandId,
                  workflowId: context.workflow._id,
                  workflowRunId: context.run._id,
                  nodeId: node.id,
                  nodeType: node.type,
                  label: node.label,
                  lifecycle,
                  inputSummary: resolvedInputs.summary,
                  outputPorts: outputRefs.map((outputRef) => outputRef.port),
                }
              );
          if (placeholderArtifactId) emittedArtifactIds.add(placeholderArtifactId);
          const outputRefsWithArtifact = outputRefs.map((outputRef) => ({
            ...outputRef,
            ...(outputRef.port === "post_package"
              ? { artifactIds: consumedOrCreatedPackageIds }
              : createdPostPackageArtifactId
                ? { artifactIds: consumedOrCreatedPackageIds }
                : placeholderArtifactId
                  ? { artifactIds: [placeholderArtifactId] }
                  : {}),
          }));

          await ctx.runMutation(internal.workflows.runs.transitionNodeState, {
            runId: context.run._id,
            nodeId: node.id,
            status: "succeeded",
            ...(outputRefsWithArtifact.length ? { outputRefs: outputRefsWithArtifact } : {}),
            costUsd: 0,
          });
          await ctx.runMutation(internal.workflows.runs.recordEvent, {
            userId: context.run.userId,
            workflowRunId: context.run._id,
            workflowId: context.workflow._id,
            type: "node_completed",
            nodeId: node.id,
            message: `${node.label} completed with placeholder execution.`,
            data: {
              nodeType: node.type,
              lifecycle: createdPostPackageArtifactId ? "saved" : lifecycle,
              artifactId: createdPostPackageArtifactId ?? placeholderArtifactId,
              packageArtifactIds: consumedOrCreatedPackageIds,
              outputPorts: outputRefsWithArtifact.map((outputRef) => outputRef.port),
              placeholderExecution: !createdPostPackageArtifactId,
            },
          });

          pendingNodeIds.delete(node.id);
          completedNodeIds.add(node.id);
          executedNodeCount += 1;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : `${node.label} failed during execution.`;
          await ctx.runMutation(internal.workflows.runs.transitionNodeState, {
            runId: context.run._id,
            nodeId: node.id,
            status: "failed",
            errorMessage: message,
          });
          await ctx.runMutation(internal.workflows.runs.recordEvent, {
            userId: context.run.userId,
            workflowRunId: context.run._id,
            workflowId: context.workflow._id,
            type: "error",
            nodeId: node.id,
            message,
          });
          await ctx.runMutation(internal.workflows.runs.transitionRun, {
            runId: context.run._id,
            status: "failed",
            errorNodeId: node.id,
            errorMessage: message,
            completedAt: Date.now(),
          });
          return;
        }
      }
    }

    if (!finalPackageArtifactIds.size) {
      const fallbackPackageArtifactId = await ctx.runMutation(
        internal.workflows.runner.createPostPackageArtifact,
        {
          userId: context.run.userId,
          brandId: context.run.brandId,
          workflowId: context.workflow._id,
          workflowRunId: context.run._id,
          nodeId: "workflow",
          label: context.workflow.name,
          sourceArtifactIds: [...emittedArtifactIds],
          packageData: {
            schemaVersion: 1,
            kind: "post_package",
            postType: context.workflow.contentFormat,
            name: `${context.workflow.name} package`,
            mediaArtifactIds: [...emittedArtifactIds].map((artifactId) => String(artifactId)),
            platformSettings: {},
            destinationPolicy: {
              destination: "media_library",
            },
            metadata: {
              sourceNodeId: "workflow",
              sourceNodeType: "workflow_fallback",
              reason: "No reachable terminal node produced a post package.",
            },
          },
        }
      );
      finalPackageArtifactIds.add(fallbackPackageArtifactId);
      await ctx.runMutation(internal.workflows.runs.recordEvent, {
        userId: context.run.userId,
        workflowRunId: context.run._id,
        workflowId: context.workflow._id,
        type: "artifact_created",
        message: "Workflow fallback post package created.",
        data: {
          artifactId: fallbackPackageArtifactId,
        },
      });
    }

    await ctx.runMutation(internal.workflows.runs.recordEvent, {
      userId: context.run.userId,
      workflowRunId: context.run._id,
      workflowId: context.workflow._id,
      type: "node_completed",
      message: "Workflow graph completed execution.",
      data: {
        executedNodeCount,
        finalPackageArtifactIds: [...finalPackageArtifactIds],
        passCount,
        costUsd: totalCostUsd,
        skippedUnreachableNodeIds: graph.nodes
          .filter((node) => !reachableNodeIds.has(node.id))
          .map((node) => node.id),
      },
    });

    await ctx.runMutation(internal.workflows.runs.transitionRun, {
      runId: context.run._id,
      status: "completed",
      summary: `Executed ${executedNodeCount} workflow nodes.`,
      costUsd: totalCostUsd,
      completedAt: Date.now(),
    });
  },
});

export const createPlaceholderArtifact = internalMutation({
  args: {
    userId: v.string(),
    brandId: v.id("brands"),
    workflowId: v.id("workflows"),
    workflowRunId: v.id("workflowRuns"),
    nodeId: v.string(),
    nodeType: v.string(),
    label: v.string(),
    lifecycle: artifactLifecycleValidator,
    inputSummary: v.any(),
    outputPorts: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("artifacts", {
      userId: args.userId,
      brandId: args.brandId,
      workflowId: args.workflowId,
      workflowRunId: args.workflowRunId,
      type: "text_draft",
      title: `${args.label} placeholder output`,
      data: {
        placeholderExecution: true,
        nodeId: args.nodeId,
        nodeType: args.nodeType,
        inputSummary: args.inputSummary,
        outputPorts: args.outputPorts,
      },
      lifecycle: args.lifecycle,
      reviewStatus: "not_required",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const resolveMediaNodeItems = internalQuery({
  args: {
    runId: v.id("workflowRuns"),
    nodeId: v.string(),
  },
  handler: async (ctx, args): Promise<MediaNodeItemForRun[]> => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Workflow run not found");

    const workflow = await ctx.db.get(run.workflowId);
    if (!workflow) throw new Error("Workflow not found");

    const node = workflow.graph.nodes.find((candidateNode) => candidateNode.id === args.nodeId);
    if (!node || node.type !== "media") throw new Error("Media node not found");

    const config = objectValue(node.config);
    const artifactIds = stringArrayFromConfig(config.artifactIds);
    const brandAssetIds = stringArrayFromConfig(config.brandAssetIds);
    const personaAssetIds = stringArrayFromConfig(config.personaAssetIds);
    const items: MediaNodeItemForRun[] = [];

    for (const artifactId of artifactIds) {
      const artifact = await ctx.db.get(artifactId as Id<"artifacts">);
      if (!artifact || artifact.userId !== run.userId) continue;

      items.push({
        id: String(artifact._id),
        source: "artifact",
        kind: mediaKindFromArtifact(artifact),
        title: artifact.title,
        storageUrl: artifact.storageUrl,
        data: artifact.data,
        metadata: {
          artifactType: artifact.type,
          reviewStatus: artifact.reviewStatus,
        },
      });
    }

    for (const assetId of brandAssetIds) {
      const asset = await ctx.db.get(assetId as Id<"brandAssets">);
      if (!asset || asset.userId !== run.userId) continue;

      items.push({
        id: String(asset._id),
        source: "brand_asset",
        kind: "image",
        title: asset.name,
        storageUrl: asset.storageUrl,
        metadata: {
          assetType: asset.type,
          description: asset.description,
          metadata: asset.metadata,
        },
      });
    }

    for (const personaId of personaAssetIds) {
      const persona = await ctx.db.get(personaId as Id<"brandAssets">);
      if (!persona || persona.userId !== run.userId) continue;

      items.push({
        id: String(persona._id),
        source: "persona_asset",
        kind: "image",
        title: persona.name,
        storageUrl: persona.storageUrl,
        metadata: {
          assetType: persona.type,
          description: persona.description,
          metadata: persona.metadata,
        },
      });
    }

    items.push(...uploadedMediaItemsFromConfig(config.uploadedMedia));

    return items;
  },
});

export const createPostPackageArtifact = internalMutation({
  args: {
    userId: v.string(),
    brandId: v.id("brands"),
    workflowId: v.id("workflows"),
    workflowRunId: v.id("workflowRuns"),
    nodeId: v.string(),
    label: v.string(),
    sourceArtifactIds: v.array(v.id("artifacts")),
    packageData: v.any(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("artifacts", {
      userId: args.userId,
      brandId: args.brandId,
      workflowId: args.workflowId,
      workflowRunId: args.workflowRunId,
      parentArtifactIds: args.sourceArtifactIds.length ? args.sourceArtifactIds : undefined,
      type: "publish_payload",
      title: `${args.label} post package`,
      data: args.packageData,
      lifecycle: "saved",
      reviewStatus: "not_required",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});
