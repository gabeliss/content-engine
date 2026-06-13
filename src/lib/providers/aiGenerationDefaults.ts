import type { CreateMode } from "../create/createModes";
import type {
  WorkflowNodeType,
  WorkflowProviderName,
} from "../workflow/workflowGraph";

export type AiGenerationMode = "image" | "video" | "audio" | "lipsync" | "videoAnalysis";
export type AiGenerationProvider = Extract<
  WorkflowProviderName,
  "bulkapis" | "gemini" | "fal"
>;

export type AiGenerationSettings = {
  imageProvider?: AiGenerationProvider;
  videoProvider?: AiGenerationProvider;
  audioProvider?: AiGenerationProvider;
  lipsyncProvider?: AiGenerationProvider;
  videoAnalysisProvider?: AiGenerationProvider;
};

export type AiGenerationDefault = {
  provider: AiGenerationProvider;
};

export const AI_PROVIDER_LABELS: Record<AiGenerationProvider, string> = {
  bulkapis: "BulkAPIs",
  fal: "fal.ai",
  gemini: "Google Gemini",
};

export const AI_PROVIDER_OPTIONS_BY_MODE: Record<
  AiGenerationMode,
  Array<{ value: AiGenerationProvider; label: string }>
> = {
  image: [
    { value: "fal", label: AI_PROVIDER_LABELS.fal },
    { value: "gemini", label: AI_PROVIDER_LABELS.gemini },
    { value: "bulkapis", label: AI_PROVIDER_LABELS.bulkapis },
  ],
  video: [
    { value: "fal", label: AI_PROVIDER_LABELS.fal },
    { value: "bulkapis", label: AI_PROVIDER_LABELS.bulkapis },
  ],
  audio: [
    { value: "fal", label: AI_PROVIDER_LABELS.fal },
    { value: "bulkapis", label: AI_PROVIDER_LABELS.bulkapis },
  ],
  lipsync: [
    { value: "fal", label: AI_PROVIDER_LABELS.fal },
    { value: "bulkapis", label: AI_PROVIDER_LABELS.bulkapis },
  ],
  videoAnalysis: [
    { value: "gemini", label: AI_PROVIDER_LABELS.gemini },
  ],
};

export const DEFAULT_AI_GENERATION_SETTINGS: Required<AiGenerationSettings> = {
  imageProvider: "fal",
  videoProvider: "fal",
  audioProvider: "fal",
  lipsyncProvider: "fal",
  videoAnalysisProvider: "gemini",
};

export function resolveAiGenerationSettings(
  settings?: AiGenerationSettings | null
): Required<AiGenerationSettings> {
  return {
    imageProvider: settings?.imageProvider ?? DEFAULT_AI_GENERATION_SETTINGS.imageProvider,
    videoProvider: settings?.videoProvider ?? DEFAULT_AI_GENERATION_SETTINGS.videoProvider,
    audioProvider: settings?.audioProvider ?? DEFAULT_AI_GENERATION_SETTINGS.audioProvider,
    lipsyncProvider: settings?.lipsyncProvider ?? DEFAULT_AI_GENERATION_SETTINGS.lipsyncProvider,
    videoAnalysisProvider:
      settings?.videoAnalysisProvider ?? DEFAULT_AI_GENERATION_SETTINGS.videoAnalysisProvider,
  };
}

export function generationDefaultForMode(
  settings: AiGenerationSettings | null | undefined,
  mode: AiGenerationMode
): AiGenerationDefault {
  const resolved = resolveAiGenerationSettings(settings);

  switch (mode) {
    case "image":
      return { provider: resolved.imageProvider };
    case "video":
      return { provider: resolved.videoProvider };
    case "audio":
      return { provider: resolved.audioProvider };
    case "lipsync":
      return { provider: resolved.lipsyncProvider };
    case "videoAnalysis":
      return { provider: resolved.videoAnalysisProvider };
  }
}

export function generationModeForCreateMode(mode: CreateMode): AiGenerationMode | null {
  if (mode === "image" || mode === "video" || mode === "audio") return mode;
  return null;
}

export function generationModeForWorkflowNode(
  nodeType: WorkflowNodeType
): AiGenerationMode | null {
  if (nodeType === "image_generation") return "image";
  if (nodeType === "video_generation") return "video";
  if (nodeType === "audio_generation") return "audio";
  if (nodeType === "lipsync") return "lipsync";
  return null;
}

export function generationDefaultForWorkflowNode(
  settings: AiGenerationSettings | null | undefined,
  nodeType: WorkflowNodeType
): AiGenerationDefault | null {
  const mode = generationModeForWorkflowNode(nodeType);
  return mode ? generationDefaultForMode(settings, mode) : null;
}
