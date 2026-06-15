import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { useEffect, useState } from "react";

type DragState = {
  edge: "start" | "end";
  maxSeconds: number;
  minSeconds: number;
  rangeEndSeconds: number;
  rangeStartSeconds: number;
  startClientX: number;
  timelineDurationSeconds: number;
  timelineWidth: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function TimelineRangeTrimHandles({
  className = "",
  maxSeconds,
  minDurationSeconds = 0.1,
  minSeconds = 0,
  onChangeRange,
  rangeEndSeconds,
  rangeStartSeconds,
  snapPointsSeconds = [],
  snapThresholdSeconds = 0.12,
  timelineDurationSeconds,
  timelineRef,
}: {
  className?: string;
  maxSeconds: number;
  minDurationSeconds?: number;
  minSeconds?: number;
  onChangeRange: (range: { endSeconds: number; startSeconds: number }) => void;
  rangeEndSeconds: number;
  rangeStartSeconds: number;
  snapPointsSeconds?: number[];
  snapThresholdSeconds?: number;
  timelineDurationSeconds: number;
  timelineRef: RefObject<HTMLDivElement | null>;
}) {
  const [dragState, setDragState] = useState<DragState | null>(null);

  const snapTime = (seconds: number) => {
    let snapped = seconds;
    let closestDistance = snapThresholdSeconds;
    for (const snapPoint of snapPointsSeconds) {
      const distance = Math.abs(seconds - snapPoint);
      if (distance <= closestDistance) {
        snapped = snapPoint;
        closestDistance = distance;
      }
    }
    return snapped;
  };

  useEffect(() => {
    if (!dragState) return undefined;
    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const deltaSeconds =
        ((event.clientX - dragState.startClientX) / dragState.timelineWidth) *
        dragState.timelineDurationSeconds;
      if (dragState.edge === "start") {
        const nextStart = snapTime(dragState.rangeStartSeconds + deltaSeconds);
        onChangeRange({
          startSeconds: clamp(
            nextStart,
            dragState.minSeconds,
            dragState.rangeEndSeconds - minDurationSeconds
          ),
          endSeconds: dragState.rangeEndSeconds,
        });
        return;
      }
      const nextEnd = snapTime(dragState.rangeEndSeconds + deltaSeconds);
      onChangeRange({
        startSeconds: dragState.rangeStartSeconds,
        endSeconds: clamp(
          nextEnd,
          dragState.rangeStartSeconds + minDurationSeconds,
          dragState.maxSeconds
        ),
      });
    };
    const handlePointerUp = () => setDragState(null);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState, minDurationSeconds, onChangeRange, snapPointsSeconds, snapThresholdSeconds]);

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>, edge: "start" | "end") => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    event.stopPropagation();
    setDragState({
      edge,
      maxSeconds,
      minSeconds,
      rangeEndSeconds,
      rangeStartSeconds,
      startClientX: event.clientX,
      timelineDurationSeconds,
      timelineWidth: rect.width,
    });
  };

  return (
    <>
      <button
        aria-label="Trim start"
        className={[
          "absolute bottom-0 left-0 top-0 z-20 w-4 cursor-ew-resize rounded-l-[var(--radius-sm)] border-0 bg-[var(--color-accent)] p-0",
          className,
        ].join(" ")}
        onPointerDown={(event) => startDrag(event, "start")}
        type="button"
      />
      <button
        aria-label="Trim end"
        className={[
          "absolute bottom-0 right-0 top-0 z-20 w-4 cursor-ew-resize rounded-r-[var(--radius-sm)] border-0 bg-[var(--color-accent)] p-0",
          className,
        ].join(" ")}
        onPointerDown={(event) => startDrag(event, "end")}
        type="button"
      />
    </>
  );
}
