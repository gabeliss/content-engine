import { Music, Scissors, Trash2, Type } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { TimelineRangeTrimHandles } from "./TimelineRangeTrimHandles";
import {
  audioTrackEndTime,
  clipDuration,
  clipStartTime,
  formatTimelineTime,
  mediaKindForClip,
  normalizedClipTrim,
  type TimedTextOverlay,
  type VideoComposerAudioTrack,
  type VideoComposerClip,
} from "./videoComposerModel";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const TEXT_TRACK_COLORS = [
  "border-[oklch(49%_0.18_294)] bg-[oklch(69%_0.16_294)] text-[var(--color-surface)] hover:bg-[oklch(62%_0.17_294)]",
  "border-[oklch(52%_0.17_340)] bg-[oklch(69%_0.15_340)] text-[var(--color-surface)] hover:bg-[oklch(62%_0.17_340)]",
  "border-[var(--color-primary-strong)] bg-[var(--color-primary)] text-[var(--color-surface)] hover:bg-[var(--color-primary-strong)]",
  "border-[oklch(57%_0.14_92)] bg-[var(--color-accent)] text-[var(--color-ink)] hover:bg-[oklch(74%_0.15_92)]",
];
const TIMELINE_SNAP_THRESHOLD_SECONDS = 0.12;

function TimelineFilmstripFrame({
  mediaKind,
  sourceUrl,
  timeSeconds,
}: {
  mediaKind: "image" | "video";
  sourceUrl: string;
  timeSeconds: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (mediaKind === "image") return undefined;
    const video = videoRef.current;
    if (!video) return undefined;
    const seekToFrame = () => {
      video.currentTime = timeSeconds;
    };
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      seekToFrame();
      return undefined;
    }
    video.addEventListener("loadedmetadata", seekToFrame, { once: true });
    return () => video.removeEventListener("loadedmetadata", seekToFrame);
  }, [mediaKind, sourceUrl, timeSeconds]);

  if (mediaKind === "image") {
    return (
      <img
        alt=""
        className="h-full w-full object-cover"
        crossOrigin="anonymous"
        src={sourceUrl}
      />
    );
  }

  return (
    <video
      className="h-full w-full object-cover"
      crossOrigin="anonymous"
      muted
      playsInline
      preload="metadata"
      ref={videoRef}
      src={sourceUrl}
    />
  );
}

function TimelineFilmstrip({
  clip,
  isSelected,
}: {
  clip: VideoComposerClip;
  isSelected: boolean;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [frameCount, setFrameCount] = useState(1);
  const trim = normalizedClipTrim(clip);
  const mediaKind = mediaKindForClip(clip);
  const trimmedDuration = Math.max(0.1, trim.endSeconds - trim.startSeconds);

  useEffect(() => {
    const element = stripRef.current;
    if (!element) return undefined;
    const updateFrameCount = () => {
      const width = element.getBoundingClientRect().width;
      setFrameCount(clamp(Math.round(width / 54), 1, 24));
    };
    updateFrameCount();
    const observer = new ResizeObserver(updateFrameCount);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const sampleTimes = useMemo(
    () =>
      Array.from({ length: frameCount }, (_, index) => {
        const ratio = frameCount <= 1 ? 0 : index / frameCount;
        return trim.startSeconds + trimmedDuration * ratio;
      }),
    [frameCount, trim.startSeconds, trimmedDuration]
  );

  return (
    <div
      className={[
        "absolute inset-x-0 bottom-0 top-7 grid overflow-hidden bg-[var(--color-page-quiet)]",
        isSelected ? "px-4" : "",
      ].join(" ")}
      ref={stripRef}
      style={{ gridTemplateColumns: `repeat(${frameCount}, minmax(0, 1fr))` }}
    >
      {sampleTimes.map((timeSeconds, index) => (
        <div
          className="min-w-0 overflow-hidden border-r border-[var(--color-surface)] last:border-r-0"
          key={`${clip.id}-${index}`}
        >
          <TimelineFilmstripFrame
            mediaKind={mediaKind}
            sourceUrl={clip.storageUrl}
            timeSeconds={timeSeconds}
          />
        </div>
      ))}
    </div>
  );
}

export function VideoComposerTimeline({
  audioTracks,
  clips,
  draggedClipId,
  onDragEnd,
  onDragOverClip,
  onDragStart,
  onRemoveClip,
  onSeek,
  onSelectClip,
  onSelectText,
  onTrimClip,
  onTrimText,
  playheadSeconds,
  selectedClipId,
  selectedTextId,
  textOverlays,
  totalDurationSeconds,
}: {
  audioTracks: VideoComposerAudioTrack[];
  clips: VideoComposerClip[];
  draggedClipId: string;
  onDragEnd: () => void;
  onDragOverClip: (targetClipId: string, placement: "before" | "after") => void;
  onDragStart: (clipId: string) => void;
  onRemoveClip: (clipId: string) => void;
  onSeek: (timeSeconds: number) => void;
  onSelectClip: (clipId: string) => void;
  onSelectText: (textId: string) => void;
  onTrimClip: (clipId: string, patch: Partial<VideoComposerClip>) => void;
  onTrimText: (textId: string, patch: Partial<TimedTextOverlay>) => void;
  playheadSeconds: number;
  selectedClipId: string;
  selectedTextId: string;
  textOverlays: TimedTextOverlay[];
  totalDurationSeconds: number;
}) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const safeTotalDuration = Math.max(totalDurationSeconds, 0.1);
  const ticks = useMemo(
    () => Array.from({ length: Math.max(2, Math.ceil(safeTotalDuration) + 1) }, (_, index) => index),
    [safeTotalDuration]
  );
  const snapPointsSeconds = useMemo(() => {
    const points = new Set<number>([0, safeTotalDuration]);
    ticks.forEach((tick) => points.add(tick));
    let cursor = 0;
    for (const clip of clips) {
      points.add(Number(cursor.toFixed(3)));
      cursor += clipDuration(clip);
      points.add(Number(cursor.toFixed(3)));
    }
    for (const overlay of textOverlays) {
      const start = clamp(overlay.startSeconds ?? 0, 0, safeTotalDuration);
      const end = clamp(overlay.endSeconds ?? safeTotalDuration, start + 0.1, safeTotalDuration);
      points.add(Number(start.toFixed(3)));
      points.add(Number(end.toFixed(3)));
    }
    for (const track of audioTracks) {
      const start = clamp(track.startSeconds ?? 0, 0, safeTotalDuration);
      const end = clamp(audioTrackEndTime(track), start + 0.1, safeTotalDuration);
      points.add(Number(start.toFixed(3)));
      points.add(Number(end.toFixed(3)));
    }
    return [...points].filter((point) => point >= 0 && point <= safeTotalDuration);
  }, [audioTracks, clips, safeTotalDuration, textOverlays, ticks]);

  const snapTimelineTime = (timeSeconds: number) => {
    let snapped = clamp(timeSeconds, 0, safeTotalDuration);
    let closestDistance = TIMELINE_SNAP_THRESHOLD_SECONDS;
    for (const snapPoint of snapPointsSeconds) {
      const distance = Math.abs(timeSeconds - snapPoint);
      if (distance <= closestDistance) {
        snapped = snapPoint;
        closestDistance = distance;
      }
    }
    return clamp(snapped, 0, safeTotalDuration);
  };

  const seekFromClientX = (clientX: number) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    onSeek(snapTimelineTime(ratio * safeTotalDuration));
  };

  useEffect(() => {
    if (!isDraggingPlayhead) return undefined;
    const handlePointerMove = (event: PointerEvent) => seekFromClientX(event.clientX);
    const handlePointerUp = () => setIsDraggingPlayhead(false);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDraggingPlayhead, safeTotalDuration, snapPointsSeconds]);

  if (clips.length === 0) {
    return <div className="empty-state">Add videos from the library to create an edit.</div>;
  }

  return (
    <div className="grid gap-2">
      <div className="relative min-h-[15rem] overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-page)] px-3 py-3">
        <div className="grid min-w-[48rem] grid-cols-[3.5rem_minmax(0,1fr)] gap-2">
          <div className="pt-6 text-right text-[0.68rem] font-[820] uppercase tracking-[0.06em] text-[var(--color-ink-faint)]">
            Time
          </div>
          <div className="relative min-h-[13.5rem]" ref={timelineRef}>
            <button
              aria-label="Drag playhead"
              className="absolute bottom-0 top-0 z-30 w-4 -translate-x-1/2 cursor-ew-resize border-0 bg-transparent p-0"
              onPointerDown={(event) => {
                event.preventDefault();
                setIsDraggingPlayhead(true);
                seekFromClientX(event.clientX);
              }}
              style={{ left: `${(playheadSeconds / safeTotalDuration) * 100}%` }}
              type="button"
            >
              <span className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 rounded-full bg-[var(--color-ink)] shadow-[0_0_0_1px_rgb(255_255_255_/_0.75)]" />
              <span className="absolute left-1/2 top-0 size-3 -translate-x-1/2 rounded-full bg-[var(--color-ink)]" />
            </button>

            <div
              className="relative h-8 cursor-pointer border-b border-[var(--color-border)]"
              onPointerDown={(event) => {
                setIsDraggingPlayhead(true);
                seekFromClientX(event.clientX);
              }}
            >
              {ticks.map((tick) => {
                const left = `${(tick / safeTotalDuration) * 100}%`;
                return (
                  <div
                    className="absolute bottom-0 top-0 border-l border-[var(--color-border)]"
                    key={tick}
                    style={{ left }}
                  >
                    <span className="absolute left-1 top-0 text-[0.68rem] font-[760] text-[var(--color-ink-muted)]">
                      {tick}s
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 top-8">
              {ticks.map((tick) => (
                <span
                  className="absolute bottom-0 top-0 border-l border-[var(--color-border)]/70"
                  key={`grid-${tick}`}
                  style={{ left: `${(tick / safeTotalDuration) * 100}%` }}
                />
              ))}
            </div>

            <div className="relative mt-2 grid gap-2">
              <div className="relative h-9 overflow-hidden rounded-[0.45rem] bg-[var(--color-surface)]">
                {audioTracks.length === 0 ? (
                  <div className="grid h-full place-items-center text-[0.72rem] font-[720] text-[var(--color-ink-faint)]">
                    Audio track
                  </div>
                ) : (
                  audioTracks.map((track, index) => {
                    const start = clamp(track.startSeconds ?? 0, 0, safeTotalDuration);
                    const end = clamp(audioTrackEndTime(track), start + 0.1, safeTotalDuration);
                    return (
                      <div
                        aria-label={track.title}
                        className="absolute inset-y-1 inline-flex min-w-16 items-center gap-2 overflow-hidden rounded-[0.4rem] border border-[oklch(56%_0.12_210)] bg-[oklch(72%_0.11_210)] px-3 text-[0.76rem] font-[820] text-[var(--color-ink)] shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.3)]"
                        key={track.id}
                        style={{
                          left: `${(start / safeTotalDuration) * 100}%`,
                          width: `${((end - start) / safeTotalDuration) * 100}%`,
                          top: `${Math.min(index, 2) * 0.12 + 0.25}rem`,
                        }}
                      >
                        <Music size={14} />
                        <span className="min-w-0 truncate">{track.title}</span>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="relative h-10 overflow-hidden rounded-[0.45rem] bg-[var(--color-surface)]">
                {textOverlays.length === 0 ? (
                  <div className="grid h-full place-items-center text-[0.72rem] font-[720] text-[var(--color-ink-faint)]">
                    Text track
                  </div>
                ) : (
                  textOverlays.map((overlay, index) => {
                    const start = clamp(overlay.startSeconds ?? 0, 0, safeTotalDuration);
                    const end = clamp(overlay.endSeconds ?? safeTotalDuration, start + 0.1, safeTotalDuration);
                    const selected = overlay.id === selectedTextId;
                    const colorClassName = TEXT_TRACK_COLORS[index % TEXT_TRACK_COLORS.length];
                    return (
                      <div
                        aria-label={`Select text ${overlay.text?.trim() || index + 1}`}
                        className={[
                          "absolute inset-y-1 inline-flex min-w-16 items-center gap-2 overflow-hidden rounded-[0.4rem] border px-3 text-left text-[0.78rem] font-[820] shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.28)] transition",
                          colorClassName,
                          selected
                            ? "z-10 ring-2 ring-[var(--color-ink)]/25"
                            : "",
                        ].join(" ")}
                        key={overlay.id ?? index}
                        onClick={() => onSelectText(overlay.id ?? String(index))}
                        role="button"
                        style={{
                          left: `${(start / safeTotalDuration) * 100}%`,
                          width: `${((end - start) / safeTotalDuration) * 100}%`,
                        }}
                        tabIndex={0}
                      >
                        {selected ? (
                          <TimelineRangeTrimHandles
                            className="!bg-[var(--color-surface)]/95"
                            maxSeconds={safeTotalDuration}
                            onChangeRange={(range) =>
                              onTrimText(overlay.id ?? String(index), {
                                endSeconds: range.endSeconds,
                                startSeconds: range.startSeconds,
                              })
                            }
                            rangeEndSeconds={end}
                            rangeStartSeconds={start}
                            snapPointsSeconds={snapPointsSeconds}
                            timelineDurationSeconds={safeTotalDuration}
                            timelineRef={timelineRef}
                          />
                        ) : null}
                        <Type size={14} />
                        <span className="min-w-0 truncate">{overlay.text?.trim() || `Text ${index + 1}`}</span>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="relative flex h-[7rem] items-stretch overflow-hidden rounded-[var(--radius-sm)] bg-[var(--color-surface)]">
                {clips.map((clip, index) => {
                  const duration = clipDuration(clip);
                  const widthPercent = Math.max(8, (duration / safeTotalDuration) * 100);
                  const selected = clip.id === selectedClipId;
                  const trim = normalizedClipTrim(clip);
                  return (
                    <div
                      aria-label={`Select ${clip.title}`}
                      className={[
                        "group relative grid shrink-0 content-between overflow-hidden border-y border-r p-0 text-left transition first:rounded-l-[var(--radius-sm)] first:border-l last:rounded-r-[var(--radius-sm)]",
                        selected
                          ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]",
                        draggedClipId === clip.id ? "scale-[0.98] opacity-60" : "",
                      ].join(" ")}
                      draggable
                      key={clip.id}
                      onClick={() => {
                        onSelectClip(clip.id);
                        onSeek(clipStartTime(clips, clip.id));
                      }}
                      onDragEnd={onDragEnd}
                      onDragOver={(event) => {
                        event.preventDefault();
                        if (!draggedClipId || draggedClipId === clip.id) return;
                        const rect = event.currentTarget.getBoundingClientRect();
                        onDragOverClip(
                          clip.id,
                          event.clientX > rect.left + rect.width / 2 ? "after" : "before"
                        );
                      }}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", clip.id);
                        onDragStart(clip.id);
                      }}
                      role="button"
                      style={{ width: `${widthPercent}%` }}
                      tabIndex={0}
                    >
                      {selected ? (
                        <TimelineRangeTrimHandles
                          maxSeconds={clip.durationSeconds ?? clipDuration(clip) ?? 0.1}
                          onChangeRange={(range) =>
                            onTrimClip(clip.id, {
                              trimEndSeconds: range.endSeconds,
                              trimStartSeconds: range.startSeconds,
                            })
                          }
                          rangeEndSeconds={trim.endSeconds}
                          rangeStartSeconds={trim.startSeconds}
                          timelineDurationSeconds={safeTotalDuration}
                          timelineRef={timelineRef}
                        />
                      ) : null}
                      <TimelineFilmstrip clip={clip} isSelected={selected} />
                      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 bg-[color-mix(in_oklab,var(--color-surface)_88%,transparent)] px-3 py-1.5">
                        <span className="min-w-0 text-[0.78rem] font-[820] leading-tight text-[var(--color-ink)] [overflow-wrap:anywhere]">
                          {index + 1}. {clip.title}
                        </span>
                        <span className="shrink-0 text-[0.7rem] font-[760] text-[var(--color-ink-muted)]">
                          {formatTimelineTime(duration)}
                        </span>
                      </div>
                      <div className="relative z-10 mt-auto flex items-center justify-between gap-2 px-4 py-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-ink)]/70 px-2 py-1 text-[0.68rem] font-[760] text-[var(--color-surface)]">
                          <Scissors size={12} />
                          {mediaKindForClip(clip) === "image" ? "still" : "trimmed"}
                        </span>
                        <button
                          aria-label={`Remove ${clip.title}`}
                          className="grid size-7 place-items-center rounded-[0.55rem] border-0 bg-[var(--color-surface)]/90 p-0 text-[var(--color-danger)] opacity-0 shadow-sm transition group-hover:opacity-100"
                          onClick={(event) => {
                            event.stopPropagation();
                            onRemoveClip(clip.id);
                          }}
                          type="button"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between text-[0.72rem] font-[700] text-[var(--color-ink-muted)]">
        <span>{formatTimelineTime(playheadSeconds, 2)}</span>
        <span>{formatTimelineTime(totalDurationSeconds, 2)}</span>
      </div>
    </div>
  );
}
