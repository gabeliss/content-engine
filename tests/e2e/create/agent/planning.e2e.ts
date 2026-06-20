import assert from "node:assert/strict";
import type { Doc } from "../../../../convex/_generated/dataModel";
import { normalizeAgentDecision } from "../../../../convex/create/agent";
import {
  buildEffectiveBrief,
  buildPlannedToolInput,
} from "../../../../convex/create/planning";

function userMessage(
  content: string,
  referenceMentions: Doc<"createMessages">["referenceMentions"] = []
) {
  return {
    _creationTime: 1,
    _id: `message_${content.length}`,
    content,
    createdAt: 1,
    createThreadId: "thread_1",
    referenceMentions,
    role: "user",
    userId: "user_1",
  } as unknown as Doc<"createMessages">;
}

function thread(status: Doc<"createThreads">["status"]) {
  return {
    _creationTime: 1,
    _id: "thread_1",
    checkpointMode: "debug",
    createdAt: 1,
    status,
    updatedAt: 1,
    userId: "user_1",
  } as unknown as Doc<"createThreads">;
}

const bananaReference = {
  token: "@Banana",
  label: "Banana Character",
  entityType: "creative_asset",
  entityId: "asset_1",
  mediaType: "image",
} as const;

const fruitBrief = userMessage(
  "I want an AI fruit drama video where a banana husband and strawberry wife win the lottery.",
  [bananaReference]
);
const goAheadBrief = buildEffectiveBrief({
  content: "go ahead",
  currentMentions: [],
  previousMessages: [fruitBrief],
  thread: thread("idle"),
});

assert.equal(goAheadBrief.usedConversationContext, true);
assert.equal(goAheadBrief.forceCreation, true);
assert.match(goAheadBrief.content, /banana husband/);
assert.deepEqual(goAheadBrief.referenceMentions, [bananaReference]);

const reviseBrief = buildEffectiveBrief({
  content: "revise it",
  previousMessages: [
    userMessage("Create a product image of a glossy green supplement bottle on a kitchen counter."),
  ],
  thread: thread("idle"),
});
assert.equal(reviseBrief.usedConversationContext, true);
assert.match(reviseBrief.content, /Latest instruction: revise it/);

const clarificationBrief = buildEffectiveBrief({
  content: "video",
  previousMessages: [fruitBrief],
  thread: thread("clarifying"),
});
assert.equal(clarificationBrief.usedConversationContext, true);
assert.match(clarificationBrief.content, /Latest instruction: video/);

const brainstormingBrief = buildEffectiveBrief({
  content: "I like the lottery idea but maybe it should be more dramatic.",
  previousMessages: [fruitBrief],
  thread: thread("idle"),
});
assert.equal(brainstormingBrief.usedConversationContext, false);

const imageToolInput = buildPlannedToolInput({
  content: "Create three vertical product images using provider fal model imagen-test.",
  outputType: "image",
  toolName: "media.generateImage",
});
assert.equal(imageToolInput.aspectRatio, "9:16");
assert.equal(imageToolInput.count, 3);
assert.equal(imageToolInput.provider, "fal");
assert.equal(imageToolInput.model, "imagen-test");

const videoToolInput = buildPlannedToolInput({
  content: "Create a landscape product video that is 8 seconds long.",
  outputType: "video",
  toolName: "media.generateVideo",
});
assert.equal(videoToolInput.aspectRatio, "16:9");
assert.equal(videoToolInput.durationSeconds, 8);

const transformationBrief =
  "Create a vertical before and after fitness transformation video. Show a woman at the start of her fitness journey, then cut to six months later where she looks stronger and more confident. Add short motivational text overlays and make it feel like a TikTok/Reels transformation video.";
const transformationImageInput = buildPlannedToolInput({
  content: transformationBrief,
  outputType: "video",
  toolName: "media.generateImage",
});
assert.equal(transformationImageInput.aspectRatio, "9:16");
assert.equal(transformationImageInput.count, 2);
assert.match(String(transformationImageInput.prompt), /reference stills/i);
assert.match(String(transformationImageInput.prompt), /fully clothed adult woman/i);
assert.match(String(transformationImageInput.prompt), /standalone photo/i);
assert.match(String(transformationImageInput.prompt), /Do not create a side-by-side/i);
assert.match(String(transformationImageInput.prompt), /Do not create a video/i);
assert.match(String(transformationImageInput.brief), /before and after fitness transformation video/i);

const twoImageTransformationInput = buildPlannedToolInput({
  content:
    "Create two images for a before-and-after fitness transformation. First image: a woman at the start of her fitness journey, standing in a gym mirror selfie. Second image: the same woman six months later, stronger and more confident in the same gym mirror selfie style.",
  outputType: "image",
  toolName: "media.generateImage",
});
assert.equal(twoImageTransformationInput.count, 2);
assert.match(String(twoImageTransformationInput.prompt), /standalone photos/i);
assert.match(String(twoImageTransformationInput.prompt), /Image 1 must show only the before moment/i);
assert.match(String(twoImageTransformationInput.prompt), /Image 2 must show only the after moment/i);
assert.match(String(twoImageTransformationInput.prompt), /Do not combine before and after into a single image/i);
assert.match(String(twoImageTransformationInput.prompt), /split screen/i);

const multiToolCallDecision = normalizeAgentDecision(JSON.stringify({
  kind: "create",
  response: "I'll create one before image and one after image.",
  outputType: "image",
  brief: "Create two images for a before-and-after fitness transformation.",
  toolCalls: [
    {
      tool: "media.generateImage",
      prompt: "Generate an image of a woman at the start of her fitness journey, standing in a gym mirror selfie.",
      planStep: "Create the before image.",
      input: { aspectRatio: "1:1" },
    },
    {
      tool: "media.generateImage",
      prompt: "Generate an image of the same woman six months later, stronger and more confident, in the same gym mirror selfie style.",
      planStep: "Create the after image.",
      input: { aspectRatio: "1:1", usePriorImageOutputs: true },
    },
  ],
}));

assert.equal(multiToolCallDecision.kind, "create");
assert.equal(multiToolCallDecision.toolCalls.length, 2);
assert.equal(multiToolCallDecision.toolCalls[0].toolName, "media.generateImage");
assert.equal(multiToolCallDecision.toolCalls[1].toolName, "media.generateImage");
assert.match(multiToolCallDecision.toolCalls[0].prompt ?? "", /start of her fitness journey/);
assert.match(multiToolCallDecision.toolCalls[1].prompt ?? "", /six months later/);
assert.equal(multiToolCallDecision.toolCalls[1].input?.usePriorImageOutputs, true);

const legacyToolsDecision = normalizeAgentDecision(JSON.stringify({
  kind: "create",
  response: "I'll create this.",
  outputType: "image",
  brief: "Create an image of an apple.",
  tools: ["media.generateImage"],
}));
assert.equal(legacyToolsDecision.kind, "clarify");
assert.match(legacyToolsDecision.response, /valid tool plan/i);

const transformationVideoInput = buildPlannedToolInput({
  content: transformationBrief,
  outputType: "video",
  toolName: "media.generateVideo",
});
assert.match(String(transformationVideoInput.prompt), /body-positive/i);
assert.match(String(transformationVideoInput.prompt), /generated reference stills/i);

const videoRenderToolInput = buildPlannedToolInput({
  content: "AI render a vertical video for 6 seconds using provider bulkapis.",
  outputType: "video",
  toolName: "media.renderVideo",
});
assert.equal(videoRenderToolInput.aspectRatio, "9:16");
assert.equal(videoRenderToolInput.maxDurationSeconds, 6);
assert.equal(videoRenderToolInput.provider, "bulkapis");

const audioToolInput = buildPlannedToolInput({
  content: "Generate a voiceover for the launch script.",
  outputType: "audio",
  toolName: "media.generateAudio",
});
assert.equal(audioToolInput.mode, "voiceover");
assert.equal(audioToolInput.text, "Generate a voiceover for the launch script.");

const textToolInput = buildPlannedToolInput({
  content: "Write a short script for an AI fruit drama intro.",
  outputType: "text",
  toolName: "text.generate",
});
assert.equal(textToolInput.kind, "script");
assert.equal(textToolInput.prompt, "Write a short script for an AI fruit drama intro.");

const referenceAnalysisInput = buildPlannedToolInput({
  content: "Analyze @Banana for reusable visual style.",
  outputType: "analysis",
  referenceMentions: [bananaReference],
  toolName: "analyze.source",
});
assert.equal(referenceAnalysisInput.sourceType, "library_asset");
assert.equal(referenceAnalysisInput.source, "asset_1");

console.log("Agent Create planning contract passed");
