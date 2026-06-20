import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  activeTextOverlaysAtTime,
  audioTrackDuration,
  clipDuration,
  compositionTimelineDuration,
  mediaKindForClip,
  normalizedAudioTrim,
  normalizedClipTrim,
  type TimedTextOverlay,
  type VideoCompositionDraft,
} from "../videoComposerModel";
import { dimensionsForAspectRatio } from "../../../lib/composition/aspectRatios";
import {
  TEXT_OVERLAY_FONT_FAMILY,
  textOverlayBlockFrame,
  textOverlayFontSize,
  textOverlayFontWeight,
  textOverlayShadow,
  textOverlayText,
} from "../../../lib/composition/textOverlays";

export const STUDIO_REMOTION_COMPOSITION_ID = "StudioComposition";
export const STUDIO_REMOTION_DEFAULT_FPS = 30;

export type StudioCompositionProps = {
  draft: VideoCompositionDraft;
  fps?: number;
};

export function studioCompositionDimensions(draft: Pick<VideoCompositionDraft, "aspectRatio">) {
  return dimensionsForAspectRatio(draft.aspectRatio);
}

export function studioCompositionDurationInFrames(
  draft: Pick<VideoCompositionDraft, "clips" | "audioTracks">,
  fps = STUDIO_REMOTION_DEFAULT_FPS
) {
  return Math.max(1, Math.ceil(compositionTimelineDuration(draft.clips, draft.audioTracks) * fps));
}

function frameFromSeconds(seconds: number | undefined, fps: number) {
  return Math.max(0, Math.round((seconds ?? 0) * fps));
}

function renderTextOverlay(
  overlay: TimedTextOverlay,
  dimensions: { width: number; height: number },
  index: number
) {
  const text = textOverlayText(overlay);
  if (!text) return null;
  const frame = textOverlayBlockFrame(overlay, dimensions);
  const fontSize = textOverlayFontSize(overlay, index);
  const fontWeight = textOverlayFontWeight(overlay, index);
  const backgroundOpacity = overlay.backgroundOpacity ?? 1;

  return (
    <div
      key={overlay.id ?? `text-${index}`}
      style={{
        position: "absolute",
        left: frame.x,
        top: frame.y,
        width: frame.width,
        minHeight: frame.minHeight,
        alignItems: "center",
        color: overlay.color ?? "#FFFFFF",
        display: "flex",
        fontFamily: TEXT_OVERLAY_FONT_FAMILY,
        fontSize,
        fontWeight,
        justifyContent:
          overlay.align === "left"
            ? "flex-start"
            : overlay.align === "right"
              ? "flex-end"
              : "center",
        lineHeight: 1.08,
        textAlign: overlay.align ?? "center",
        textShadow: textOverlayShadow(overlay),
        whiteSpace: "pre-wrap",
      }}
    >
      <span
        style={{
          background:
            overlay.backgroundStyle === "solid"
              ? overlay.backgroundColor ?? "#FFFFFF"
              : "transparent",
          borderRadius: fontSize * 0.36,
          boxDecorationBreak: "clone",
          opacity: overlay.backgroundStyle === "solid" ? backgroundOpacity : 1,
          padding:
            overlay.backgroundStyle === "solid"
              ? `${fontSize * 0.08}px ${fontSize * 0.18}px`
              : 0,
        }}
      >
        {text}
      </span>
    </div>
  );
}

function StudioClipSequence({
  clip,
  from,
  fps,
}: {
  clip: VideoCompositionDraft["clips"][number];
  from: number;
  fps: number;
}) {
  const durationInFrames = Math.max(1, frameFromSeconds(clipDuration(clip), fps));
  const trim = normalizedClipTrim(clip);

  return (
    <Sequence from={from} durationInFrames={durationInFrames}>
      <AbsoluteFill style={{ backgroundColor: "#000000" }}>
        {mediaKindForClip(clip) === "image" ? (
          <Img
            src={clip.storageUrl}
            style={{
              height: "100%",
              objectFit: "cover",
              width: "100%",
            }}
          />
        ) : (
          <OffthreadVideo
            src={clip.storageUrl}
            startFrom={frameFromSeconds(trim.startSeconds, fps)}
            endAt={frameFromSeconds(trim.endSeconds, fps)}
            style={{
              height: "100%",
              objectFit: "cover",
              width: "100%",
            }}
          />
        )}
      </AbsoluteFill>
    </Sequence>
  );
}

function StudioAudioTrack({
  fps,
  track,
}: {
  fps: number;
  track: VideoCompositionDraft["audioTracks"][number];
}) {
  const trim = normalizedAudioTrim(track);
  const durationInFrames = Math.max(1, frameFromSeconds(audioTrackDuration(track), fps));

  return (
    <Sequence from={frameFromSeconds(track.startSeconds, fps)} durationInFrames={durationInFrames}>
      <Audio
        src={track.storageUrl}
        startFrom={frameFromSeconds(trim.startSeconds, fps)}
        endAt={frameFromSeconds(trim.endSeconds, fps)}
        volume={Math.max(0, Math.min(1, track.volume ?? 1))}
      />
    </Sequence>
  );
}

export function StudioComposition({ draft }: StudioCompositionProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const timeSeconds = frame / fps;
  let clipCursor = 0;
  const totalDurationSeconds = compositionTimelineDuration(draft.clips, draft.audioTracks);
  const visibleTextOverlays = activeTextOverlaysAtTime(
    draft.textOverlays,
    timeSeconds,
    totalDurationSeconds
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {draft.clips.map((clip) => {
        const from = clipCursor;
        clipCursor += frameFromSeconds(clipDuration(clip), fps);
        return (
          <StudioClipSequence
            key={clip.id}
            clip={clip}
            fps={fps}
            from={from}
          />
        );
      })}
      {(draft.audioTracks ?? []).map((track) => (
        <StudioAudioTrack key={track.id} fps={fps} track={track} />
      ))}
      {visibleTextOverlays.map((overlay, index) =>
        renderTextOverlay(overlay, { width, height }, index)
      )}
    </AbsoluteFill>
  );
}
