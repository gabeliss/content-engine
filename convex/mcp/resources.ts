import { v } from "convex/values";
import { query, type QueryCtx } from "../_generated/server";
import {
  WORKFLOW_GRAPH_SCHEMA_VERSION,
  WORKFLOW_NODE_TYPES,
} from "../../src/lib/workflowGraph";
import { listWorkflowNodeDefinitions } from "../../src/lib/workflowNodeCatalog";
import {
  WORKFLOW_AGENT_PRESETS,
  type WorkflowAgentPreset,
} from "../../src/lib/workflowAgentPresets";
import { listWorkflowTemplates } from "../../src/lib/workflowTemplates";

const JSON_MIME_TYPE = "application/json";
const MARKDOWN_MIME_TYPE = "text/markdown";

type McpResourceDescriptor = {
  uri: string;
  name: string;
  title: string;
  description: string;
  mimeType: string;
  annotations: {
    audience: ("assistant" | "user")[];
    priority: number;
  };
};

type McpResourceContent = {
  uri: string;
  mimeType: string;
  text: string;
};

type ResourceDefinition = McpResourceDescriptor & {
  access: "static" | "user";
};

const RESOURCE_DEFINITIONS = [
  {
    uri: "content-engine://architecture/guide",
    name: "content-engine-architecture",
    title: "Content Engine Architecture Guide",
    description: "Product direction, core workflow rules, provider decisions, and MCP strategy.",
    mimeType: MARKDOWN_MIME_TYPE,
    access: "static",
    annotations: { audience: ["assistant"], priority: 1 },
  },
  {
    uri: "content-engine://workflows/graph-schema",
    name: "workflow-graph-schema",
    title: "Workflow Graph Schema",
    description: "Typed graph model, node types, data types, edge rules, and validation invariants.",
    mimeType: JSON_MIME_TYPE,
    access: "static",
    annotations: { audience: ["assistant"], priority: 1 },
  },
  {
    uri: "content-engine://workflows/node-catalog",
    name: "workflow-node-catalog",
    title: "Workflow Node Catalog",
    description: "Available workflow node types, ports, defaults, provider requirements, and retention defaults.",
    mimeType: JSON_MIME_TYPE,
    access: "static",
    annotations: { audience: ["assistant"], priority: 1 },
  },
  {
    uri: "content-engine://workflows/templates",
    name: "workflow-templates",
    title: "Built-In Workflow Templates",
    description: "Starter workflow graphs and required inputs for reusable content automation patterns.",
    mimeType: JSON_MIME_TYPE,
    access: "static",
    annotations: { audience: ["assistant"], priority: 0.95 },
  },
  {
    uri: "content-engine://prompts/agent-recipes",
    name: "agent-prompt-recipes",
    title: "AI Agent Prompt Recipes",
    description: "Built-in AI agent modes and prompt-writing guidance for workflow builders.",
    mimeType: JSON_MIME_TYPE,
    access: "static",
    annotations: { audience: ["assistant"], priority: 0.9 },
  },
  {
    uri: "content-engine://providers/model-catalog",
    name: "provider-model-catalog",
    title: "Provider Model Catalog Snapshot",
    description: "Active provider models, capabilities, pricing metadata, and cached schema snapshots.",
    mimeType: JSON_MIME_TYPE,
    access: "user",
    annotations: { audience: ["assistant"], priority: 0.9 },
  },
  {
    uri: "content-engine://accounts/brands",
    name: "brand-summaries",
    title: "Brand Summaries",
    description: "Authenticated user's brands and content strategy context.",
    mimeType: JSON_MIME_TYPE,
    access: "user",
    annotations: { audience: ["assistant"], priority: 0.85 },
  },
  {
    uri: "content-engine://accounts/personas",
    name: "persona-summaries",
    title: "Persona Summaries",
    description: "Authenticated user's AI people, mascots, customer avatars, and attached asset references.",
    mimeType: JSON_MIME_TYPE,
    access: "user",
    annotations: { audience: ["assistant"], priority: 0.85 },
  },
  {
    uri: "content-engine://accounts/creative-assets",
    name: "creative-asset-summaries",
    title: "Creative Asset Summaries",
    description: "Authenticated user's reusable media references for workflow inputs.",
    mimeType: JSON_MIME_TYPE,
    access: "user",
    annotations: { audience: ["assistant"], priority: 0.8 },
  },
] satisfies ResourceDefinition[];

function requireUserId(identity: { subject: string } | null) {
  if (!identity) throw new Error("Not authenticated");
  return identity.subject;
}

function resourceDescriptor(resource: ResourceDefinition): McpResourceDescriptor {
  const { access: _access, ...descriptor } = resource;
  return descriptor;
}

function resourceContent(
  resource: ResourceDefinition,
  text: string
): { contents: McpResourceContent[] } {
  return {
    contents: [
      {
        uri: resource.uri,
        mimeType: resource.mimeType,
        text,
      },
    ],
  };
}

function jsonResource(resource: ResourceDefinition, value: unknown) {
  return resourceContent(resource, `${JSON.stringify(value, null, 2)}\n`);
}

function architectureGuide() {
  return [
    "# Content Engine MCP Architecture Guide",
    "",
    "Content Engine is a canvas-native content automation platform. External agents should build and operate workflows using the same domain model as the web app.",
    "",
    "Core rules:",
    "",
    "- Workflows are canvas-native graphs.",
    "- A workflow run produces one final post package.",
    "- Node execution is explicit only: manual run, schedule, or external MCP/API run.",
    "- Editing a workflow must never call providers or spend credits.",
    "- Graphs may branch and merge, but they must not contain cycles.",
    "- A graph should have one runner node.",
    "- Intermediate artifacts are retained according to workflow and node retention settings.",
    "- BulkAPIs is the default AI/media provider behind a swappable provider layer.",
    "- BulkAPIs should not be used for posting in the near-term platform plan.",
    "- Publishing should go through the publishing abstraction backed by Postiz or Post Bridge.",
    "- MCP resources are read-only context. MCP tools must enforce scopes before mutating data.",
    "",
    "Recommended workflow-building loop:",
    "",
    "1. Read the architecture guide, workflow graph schema, node catalog, and templates.",
    "2. Read brand, persona, creative asset, and model catalog summaries for the authenticated user.",
    "3. Choose the closest template or create a blank graph.",
    "4. Build a graph that starts at the runner, uses typed ports, and ends in export or auto_post.",
    "5. Validate the graph before saving.",
    "6. Run explicitly only when the user requests a run or a schedule fires.",
  ].join("\n");
}

function workflowGraphSchema() {
  return {
    schemaVersion: WORKFLOW_GRAPH_SCHEMA_VERSION,
    nodeTypes: WORKFLOW_NODE_TYPES,
    portDataTypes: [
      "any",
      "text",
      "json",
      "prompt",
      "image",
      "video",
      "audio",
      "media",
      "slide_spec",
      "slideshow",
      "post_package",
      "artifact",
    ],
    providerNames: [
      "bulkapis",
      "gemini",
      "fal",
      "openrouter",
      "postiz",
      "post_bridge",
      "manual",
    ],
    graphShape: {
      schemaVersion: "number",
      nodes: "WorkflowNode[]",
      edges: "WorkflowEdge[]",
      canvas: "optional viewport state",
      runSettings: "optional run mode and artifact retention settings",
    },
    nodeShape: {
      id: "stable string unique within graph",
      type: "one of nodeTypes",
      label: "human-readable canvas label",
      position: { x: "number", y: "number" },
      provider: "optional provider name",
      model: "optional provider model id",
      config: "node-specific JSON object",
      inputBindings: "optional map from input key to literal/node/artifact/media/persona binding",
      retention: "optional node retention override",
    },
    edgeShape: {
      id: "stable string unique within graph",
      sourceNodeId: "source node id",
      sourcePort: "source output port id",
      targetNodeId: "target node id",
      targetPort: "target input port id",
    },
    invariants: [
      "exactly one runner node",
      "runner nodes have no input ports",
      "comment nodes are annotations and should not be part of execution",
      "edges must reference existing nodes and valid ports",
      "graphs must be acyclic",
      "execution must be explicit and never triggered by graph edits",
      "terminal output nodes should be export or auto_post",
      "auto_post should keep autoPublish false unless the user explicitly configures publishing",
    ],
  };
}

function agentRecipes(presets: WorkflowAgentPreset[]) {
  return {
    guidance: [
      "AI Agent nodes should encode reusable creative judgment, not one-off chat replies.",
      "Prefer specific output contracts: one prompt, one script, one analysis, or structured JSON.",
      "Prompts should include constraints that prevent generic output, such as camera/source details, subject locks, platform target, and negative instructions.",
      "When an agent feeds a generation node, use the output port matching the intended downstream input, such as prompt or script.",
      "Keep provider/model settings configurable at the node level.",
    ],
    presets,
  };
}

async function modelCatalog(ctx: QueryCtx) {
  const models = await ctx.db.query("providerModels").collect();
  return models
    .filter((model) => model.isActive)
    .sort((a, b) => `${a.provider}:${a.displayName}`.localeCompare(`${b.provider}:${b.displayName}`))
    .map((model) => ({
      providerModelId: model._id,
      provider: model.provider,
      modelId: model.modelId,
      displayName: model.displayName,
      description: model.description,
      category: model.category,
      capabilities: model.capabilities,
      pricing: model.pricing,
      schemaSnapshot: model.schemaSnapshot,
      lastSyncedAt: model.lastSyncedAt,
    }));
}

async function brandSummaries(ctx: QueryCtx, userId: string) {
  const brands = await ctx.db
    .query("brands")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  return brands
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((brand) => ({
      brandId: brand._id,
      name: brand.name,
      description: brand.description,
      niche: brand.niche,
      audience: brand.audience,
      voice: brand.voice,
      visualStyle: brand.visualStyle,
      offer: brand.offer,
      constraints: brand.constraints,
      examplePosts: brand.examplePosts,
      performanceNotes: brand.performanceNotes,
      isActive: brand.isActive,
      updatedAt: brand.updatedAt,
    }));
}

async function personaSummaries(ctx: QueryCtx, userId: string) {
  const personas = await ctx.db
    .query("personas")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  return personas
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((persona) => ({
      personaId: persona._id,
      brandId: persona.brandId,
      name: persona.name,
      personaType: persona.personaType,
      description: persona.description,
      identityPrompt: persona.identityPrompt,
      visualConstraints: persona.visualConstraints,
      sourceAssetIds: persona.sourceAssetIds,
      generatedAssetIds: persona.generatedAssetIds,
      voiceAssetIds: persona.voiceAssetIds,
      usageNotes: persona.usageNotes,
      updatedAt: persona.updatedAt,
    }));
}

async function creativeAssetSummaries(ctx: QueryCtx, userId: string) {
  const assets = await ctx.db
    .query("creativeAssets")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  return assets
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((asset) => ({
      creativeAssetId: asset._id,
      brandId: asset.brandId,
      name: asset.name,
      assetKind: asset.assetKind,
      mediaType: asset.mediaType,
      storageUrl: asset.storageUrl,
      description: asset.description,
      usageNotes: asset.usageNotes,
      instruction:
        asset.metadata && typeof asset.metadata === "object" && "instruction" in asset.metadata
          ? asset.metadata.instruction
          : undefined,
      updatedAt: asset.updatedAt,
    }));
}

export const list = query({
  handler: async (ctx) => {
    requireUserId(await ctx.auth.getUserIdentity());
    return RESOURCE_DEFINITIONS.map(resourceDescriptor);
  },
});

export const read = query({
  args: { uri: v.string() },
  handler: async (ctx, args) => {
    const userId = requireUserId(await ctx.auth.getUserIdentity());
    const resource = RESOURCE_DEFINITIONS.find((candidate) => candidate.uri === args.uri);
    if (!resource) throw new Error("MCP resource not found");

    switch (resource.uri) {
      case "content-engine://architecture/guide":
        return resourceContent(resource, `${architectureGuide()}\n`);
      case "content-engine://workflows/graph-schema":
        return jsonResource(resource, workflowGraphSchema());
      case "content-engine://workflows/node-catalog":
        return jsonResource(resource, listWorkflowNodeDefinitions());
      case "content-engine://workflows/templates":
        return jsonResource(resource, listWorkflowTemplates());
      case "content-engine://prompts/agent-recipes":
        return jsonResource(resource, agentRecipes(WORKFLOW_AGENT_PRESETS));
      case "content-engine://providers/model-catalog":
        return jsonResource(resource, await modelCatalog(ctx));
      case "content-engine://accounts/brands":
        return jsonResource(resource, await brandSummaries(ctx, userId));
      case "content-engine://accounts/personas":
        return jsonResource(resource, await personaSummaries(ctx, userId));
      case "content-engine://accounts/creative-assets":
        return jsonResource(resource, await creativeAssetSummaries(ctx, userId));
      default:
        throw new Error("MCP resource not found");
    }
  },
});
