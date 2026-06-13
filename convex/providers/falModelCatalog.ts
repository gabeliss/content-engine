import { internal } from "../_generated/api";
import { action } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

type ProviderModelCategory = Doc<"providerModels">["category"];
type ProviderModelCapabilities = Doc<"providerModels">["capabilities"];

const FAL_PROVIDER = "fal" as const;
const FAL_EXPLORE_URL = "https://fal.ai/explore";

function emptyCapabilities(): ProviderModelCapabilities {
  return {
    text: false,
    structured: false,
    image: false,
    video: false,
    audio: false,
    music: false,
    lipsync: false,
    videoRender: false,
    speechToText: false,
    asyncJobs: true,
    vision: false,
  };
}

function displayNameFromModelId(modelId: string) {
  const clean = modelId.replace(/^fal-ai\//, "");
  const name = clean
    .split("/")
    .filter((part) => part && part !== "api")
    .join(" ");

  return name
    .split(/[-_\s.]/)
    .filter(Boolean)
    .map((part) => {
      if (/^ai$/i.test(part)) return "AI";
      if (/^api$/i.test(part)) return "API";
      if (/^tts$/i.test(part)) return "TTS";
      if (/^asr$/i.test(part)) return "ASR";
      if (/^gpt$/i.test(part)) return "GPT";
      if (/^xai$/i.test(part)) return "xAI";
      if (/^v\d/i.test(part)) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function categoryFromModelId(modelId: string): ProviderModelCategory {
  const id = modelId.toLowerCase();
  if (id.includes("lipsync") || id.includes("lip-sync")) return "lipsync";
  if (
    id.includes("text-to-video") ||
    id.includes("image-to-video") ||
    id.includes("video-to-video") ||
    id.includes("reference-to-video") ||
    id.includes("edit-video") ||
    id.includes("extend-video")
  ) {
    return id.includes("edit-video") || id.includes("video-to-video")
      ? "video_render"
      : "video";
  }
  if (
    id.includes("text-to-image") ||
    id.includes("image-to-image") ||
    id.includes("edit-image") ||
    id.includes("/edit") ||
    id.includes("background/remove") ||
    id.includes("upscale")
  ) {
    return "image";
  }
  if (
    id.includes("text-to-speech") ||
    id.includes("/tts") ||
    id.includes("audio") ||
    id.includes("music")
  ) {
    return "audio";
  }
  if (id.includes("speech-to-text") || id.includes("/asr")) return "unknown";
  return "unknown";
}

function capabilitiesForCategory(
  category: ProviderModelCategory,
  modelId: string
): ProviderModelCapabilities {
  const capabilities = emptyCapabilities();
  const id = modelId.toLowerCase();

  capabilities.image = category === "image";
  capabilities.video = category === "video";
  capabilities.videoRender = category === "video_render";
  capabilities.audio = category === "audio";
  capabilities.music = category === "audio" && id.includes("music");
  capabilities.lipsync = category === "lipsync" || id.includes("lipsync");
  capabilities.speechToText = id.includes("speech-to-text") || id.includes("/asr");
  capabilities.vision =
    id.includes("image-to-") ||
    id.includes("reference-") ||
    id.includes("/edit") ||
    id.includes("video-to-");

  return capabilities;
}

function normalizeFalModelId(raw: string): string | null {
  const decoded = decodeURIComponent(raw).replace(/^\/+|\/+$/g, "");
  if (!decoded || decoded.includes(".") || decoded.includes("_next")) return null;
  if (decoded.startsWith("models/")) {
    return normalizeFalModelId(decoded.slice("models/".length));
  }
  if (decoded.startsWith("fal-ai/")) return decoded;
  return `fal-ai/${decoded}`;
}

function uniqueModelIdsFromExploreHtml(html: string): string[] {
  const ids = new Set<string>();
  const patterns = [
    /href=["']\/models\/([^"'?#]+)(?:[?#][^"']*)?["']/g,
    /\\"href\\":\\"\/models\/([^"\\?#]+)(?:[?#][^"\\]*)?\\"/g,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const modelId = match[1] ? normalizeFalModelId(match[1]) : null;
      if (modelId) ids.add(modelId);
    }
  }

  return [...ids].sort((a, b) => a.localeCompare(b));
}

export const syncFalModels = action({
  args: {},
  handler: async (ctx) => {
    const response = await fetch(FAL_EXPLORE_URL);
    if (!response.ok) {
      throw new Error(`Unable to fetch fal model catalog: ${response.status}`);
    }

    const syncedAt = Date.now();
    const html = await response.text();
    const modelIds = uniqueModelIdsFromExploreHtml(html);

    for (const modelId of modelIds) {
      const category = categoryFromModelId(modelId);
      await ctx.runMutation(internal.providers.modelCatalog.upsert, {
        provider: FAL_PROVIDER,
        modelId,
        displayName: displayNameFromModelId(modelId),
        description: `fal.ai model ${modelId.replace(/^fal-ai\//, "")}.`,
        category,
        capabilities: capabilitiesForCategory(category, modelId),
        schemaSnapshot: {
          source: FAL_EXPLORE_URL,
          sourceSyncedAt: syncedAt,
          raw: {
            modelId,
            source: FAL_EXPLORE_URL,
          },
        },
        isActive: true,
        metadata: {
          rawModelId: modelId,
          providerCapabilities: [category].filter((value) => value !== "unknown"),
        },
        lastSyncedAt: syncedAt,
      });
    }

    return {
      provider: FAL_PROVIDER,
      syncedAt,
      modelCount: modelIds.length,
    };
  },
});
