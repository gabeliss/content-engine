import assert from "node:assert/strict";
import type { Doc } from "../../../../convex/_generated/dataModel";
import { buildWorkflowGraphForCreateToolCalls } from "../../../../convex/create/workflowExport";
import { validateWorkflowGraph } from "../../../../src/lib/workflow/workflowGraphValidation";

function toolCall(
  toolName: string,
  label: string,
  input: Record<string, unknown>,
  output: Record<string, unknown> = {},
  status = "succeeded"
) {
  return {
    _creationTime: 1,
    _id: `tool_${toolName}`,
    completedAt: 1,
    createThreadId: "thread_1",
    createdAt: 1,
    input,
    label,
    output,
    status,
    toolName,
    updatedAt: 1,
    userId: "user_1",
  } as unknown as Doc<"createToolCalls">;
}

const graph = buildWorkflowGraphForCreateToolCalls([
  toolCall("references.list", "Find References", { query: "Use my saved product photo" }, {
    references: [
      {
        id: "creative_asset:asset_1",
        source: "creative_asset",
        sourceId: "asset_1",
        title: "Product photo",
        mediaKind: "image",
        storageUrl: "https://example.com/product.png",
      },
    ],
  }),
  toolCall("media.generateImage", "Create Images", {
    brief: "Create product images with the saved product photo.",
  }),
  toolCall("text.generate", "Write Text", {
    prompt: "Write a short launch script.",
    kind: "script",
  }),
  toolCall("media.generateVideo", "Create Video", {
    brief: "Create a product reveal video.",
  }),
  toolCall("media.renderVideo", "AI Video Render", {
    brief: "Use the AI video editor to render a 6 second vertical product video from my saved references.",
    aspectRatio: "9:16",
    maxDurationSeconds: 6,
    provider: "bulkapis",
  }),
  toolCall("media.generateVideo", "Canceled Draft Video", {
    brief: "Create an older draft that was superseded.",
  }, {}, "canceled"),
  toolCall("media.generateAudio", "Queued Voiceover", {
    brief: "Create a voiceover later.",
  }, {}, "queued"),
  toolCall("media.lipsync", "Lip Sync Video", {
    brief: "Make the founder reference speak the generated voiceover.",
  }),
  toolCall("studio.compose", "Compose In Studio", {
    brief: "Stitch the generated clips together.",
  }),
  toolCall("artifact.save", "Save To Library", {}),
  toolCall("artifact.export", "Export Output", {
    artifactIds: ["artifact_final"],
    destination: "download",
  }),
]);

const validation = validateWorkflowGraph(graph);
assert.equal(validation.valid, true, JSON.stringify(validation.errors, null, 2));
assert.ok(graph.nodes.some((node) => node.type === "media"));
assert.ok(graph.nodes.some((node) => node.type === "llm" && node.label === "Write Text"));
assert.ok(graph.nodes.some((node) => node.type === "image_generation"));
assert.ok(graph.nodes.some((node) => node.type === "video_generation"));
assert.ok(graph.nodes.some((node) => node.type === "ai_video_editor"));
assert.ok(graph.nodes.some((node) => node.type === "lipsync"));
assert.equal(graph.nodes.some((node) => node.label === "Canceled Draft Video"), false);
assert.equal(graph.nodes.some((node) => node.label === "Queued Voiceover"), false);
assert.ok(graph.nodes.some((node) => node.type === "comment" && /Studio/.test(node.label)));
assert.ok(graph.nodes.some((node) => node.type === "export" && node.label === "Save To Library"));
assert.ok(graph.nodes.some((node) => node.type === "export" && node.label === "Export Output"));

console.log("Agent Create workflow export contract passed");
