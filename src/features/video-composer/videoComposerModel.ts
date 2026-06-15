import type { Id } from "../../../convex/_generated/dataModel";
import type { LibraryOutput } from "../library/libraryTypes";
import {
  createTextOverlayBlock,
  withAutoTextOverlayBlockHeight,
  type TextOverlayBlock,
} from "../../lib/composition/textOverlays";
import type { CompositionAspectRatio } from "../../lib/composition/aspectRatios";
import { dimensionsForAspectRatio } from "../../lib/composition/aspectRatios";

export type VideoComposerClip = {
  id: string;
  sourceId: string;
  title: string;
  storageUrl: string;
  mimeType?: string;
  artifactId?: Id<"artifacts">;
  creativeAssetId?: Id<"creativeAssets">;
  durationSeconds?: number;
  trimStartSeconds: number;
  trimEndSeconds?: number;
};

export type TimedTextOverlay = TextOverlayBlock & {
  startSeconds: number;
  endSeconds?: number;
};

export type VideoCompositionDraft = {
  aspectRatio: CompositionAspectRatio;
  clips: VideoComposerClip[];
  textOverlays: TimedTextOverlay[];
};

export function createEmptyVideoCompositionDraft(): VideoCompositionDraft {
  return {
    aspectRatio: "9:16",
    clips: [],
    textOverlays: [],
  };
}

export function clipFromLibraryOutput(output: LibraryOutput): VideoComposerClip {
  return {
    id: `${output.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    sourceId: output.id,
    title: output.title,
    storageUrl: output.storageUrl,
    mimeType: output.mimeType,
    artifactId: output.artifactId,
    creativeAssetId: output.creativeAssetId,
    trimStartSeconds: 0,
  };
}

export function createTimedTextOverlay(index: number): TimedTextOverlay {
  const dimensions = dimensionsForAspectRatio("9:16");
  const block = createTextOverlayBlock(index);
  return {
    ...withAutoTextOverlayBlockHeight(
      {
        ...block,
        id: `video-text-${Date.now()}-${index + 1}`,
        text: index === 0 ? "Default text" : "Add context here",
        y: index === 0 ? 12 : 72,
      },
      dimensions,
      index
    ),
    startSeconds: 0,
  };
}

export function clipDuration(clip: VideoComposerClip) {
  if (!clip.durationSeconds || !Number.isFinite(clip.durationSeconds)) return 0;
  const trim = normalizedClipTrim(clip);
  return Math.max(0, trim.endSeconds - trim.startSeconds);
}

export function compositionDuration(clips: VideoComposerClip[]) {
  return clips.reduce((total, clip) => total + clipDuration(clip), 0);
}

export function clipStartTime(clips: VideoComposerClip[], clipId: string) {
  let cursor = 0;
  for (const clip of clips) {
    if (clip.id === clipId) return cursor;
    cursor += clipDuration(clip);
  }
  return 0;
}

export function normalizedClipTrim(clip: VideoComposerClip) {
  const duration = Math.max(0, clip.durationSeconds ?? 0);
  const startSeconds = Math.min(
    Math.max(0, clip.trimStartSeconds),
    Math.max(0, duration - 0.1)
  );
  const endSeconds = Math.min(
    duration,
    Math.max(startSeconds + 0.1, clip.trimEndSeconds ?? duration)
  );
  return { startSeconds, endSeconds };
}

export function clipAtTimelineTime(clips: VideoComposerClip[], timeSeconds: number) {
  const totalDuration = compositionDuration(clips);
  const clampedTime = Math.min(Math.max(timeSeconds, 0), totalDuration);
  let cursor = 0;
  for (let index = 0; index < clips.length; index += 1) {
    const clip = clips[index];
    const duration = clipDuration(clip);
    const end = cursor + duration;
    const isLastClip = index === clips.length - 1;
    if (clampedTime < end || isLastClip) {
      return {
        clip,
        clipIndex: index,
        clipStartSeconds: cursor,
        localSeconds: Math.min(duration, Math.max(0, clampedTime - cursor)),
      };
    }
    cursor = end;
  }
  return null;
}

export function clampTimelineTime(clips: VideoComposerClip[], timeSeconds: number) {
  const duration = compositionDuration(clips);
  if (duration <= 0) return 0;
  return Math.min(duration, Math.max(0, timeSeconds));
}

export function activeTextOverlaysAtTime(
  overlays: TimedTextOverlay[],
  timeSeconds: number,
  fallbackDurationSeconds: number
) {
  return overlays.filter((overlay) => {
    const start = overlay.startSeconds ?? 0;
    const end = overlay.endSeconds ?? fallbackDurationSeconds;
    return timeSeconds >= start && timeSeconds <= end;
  });
}

export function formatTimelineTime(seconds: number, decimalPlaces = 0) {
  if (!Number.isFinite(seconds)) return decimalPlaces > 0 ? `0:00.${"0".repeat(decimalPlaces)}` : "0:00";
  if (decimalPlaces <= 0) {
    if (seconds <= 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  }
  const scale = 10 ** decimalPlaces;
  const totalUnits = Math.max(0, Math.round(seconds * scale));
  const minutes = Math.floor(totalUnits / (60 * scale));
  const remainingUnits = totalUnits - minutes * 60 * scale;
  const wholeSeconds = Math.floor(remainingUnits / scale);
  const fractionalSeconds = remainingUnits % scale;
  return `${minutes}:${String(wholeSeconds).padStart(2, "0")}.${String(fractionalSeconds).padStart(decimalPlaces, "0")}`;
}

export function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  return next;
}
