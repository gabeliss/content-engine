import type { CSSProperties, PointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type {
  CanonicalSlideshowSlide,
  CanonicalSlideshowSpec,
  SlideshowTextBlock,
} from "../../types";
import {
  blockText,
  normalizedTextBlocks,
} from "./slideshowEditorModel";
import {
  SLIDESHOW_FONT_FAMILY,
  hexToRgba,
  slideshowCssAspectRatio,
  slideshowDimensionsForSpec,
  slideshowTextBlockFrame,
  slideshowTextFontSize,
  slideshowTextFontWeight,
  slideshowTextShadow,
} from "../../lib/slideshowRendering";

export type SlidePreviewMode = "stage" | "thumb";
type ResizeHandle =
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export function SlidePreview({
  mode,
  onChangeBlock,
  onSelectBlock,
  selectedBlockId,
  slide,
  spec,
  textBlocks,
}: {
  mode: SlidePreviewMode;
  onChangeBlock?: (blockId: string, patch: Partial<SlideshowTextBlock>) => void;
  onSelectBlock?: (blockId: string) => void;
  selectedBlockId?: string;
  slide: CanonicalSlideshowSlide;
  spec: CanonicalSlideshowSpec;
  textBlocks?: SlideshowTextBlock[];
}) {
  const isFullGraphic =
    spec.renderingMode === "full_graphic_generation" ||
    slide.renderingMode === "full_graphic_generation";
  const dimensions = slideshowDimensionsForSpec(spec, slide);
  const blocks = textBlocks ?? normalizedTextBlocks(slide, spec);
  const [stageScale, setStageScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const isEditable = mode === "stage" && Boolean(onChangeBlock && onSelectBlock);

  useEffect(() => {
    if (mode !== "stage") return;
    const element = containerRef.current;
    if (!element) return;
    const updateScale = () => {
      const width = element.getBoundingClientRect().width;
      if (width > 0) setStageScale(width / dimensions.width);
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(element);
    return () => observer.disconnect();
  }, [dimensions.width, mode]);

  const handleSize = Math.max(10 / Math.max(stageScale, 0.01), 10);
  const handleOffset = -handleSize / 2;
  const selectionBorderWidth = Math.max(1 / Math.max(stageScale, 0.01), 1);
  const selectionRingWidth = Math.max(2 / Math.max(stageScale, 0.01), 2);

  return (
    <div
      data-slide-preview
      ref={containerRef}
      className={[
        "relative w-full overflow-hidden bg-[#111513]",
        mode === "stage"
          ? "aspect-[9/16] rounded-[var(--radius-sm)] shadow-[0_18px_42px_rgba(15,23,42,0.16)]"
          : "aspect-square rounded-[0.45rem]",
      ].join(" ")}
      style={mode === "stage" ? { aspectRatio: slideshowCssAspectRatio(dimensions) } : undefined}
    >
      <div
        className="absolute left-0 top-0 overflow-hidden"
        style={
          mode === "stage"
            ? {
                width: dimensions.width,
                height: dimensions.height,
                transform: `scale(${stageScale})`,
                transformOrigin: "left top",
              }
            : { width: "100%", height: "100%" }
        }
      >
        {slide.backgroundImageUrl ? (
          <img
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            src={slide.backgroundImageUrl}
          />
        ) : null}
        {!isFullGraphic ? <div className="absolute inset-0 bg-black/30" /> : null}
        {!isFullGraphic && mode === "stage"
          ? blocks.map((block, index) => {
            const blockId = block.id ?? "text";
            const isSelected = blockId === selectedBlockId;
            const backgroundOpacity = block.backgroundOpacity ?? 1;
            const fontSize = slideshowTextFontSize(block, index);
            const frame = slideshowTextBlockFrame(block, dimensions);
            const blockBorderWidth = isSelected ? selectionBorderWidth : 0;
            const blockStyle: CSSProperties = {
              left: frame.x,
              top: frame.y,
              width: frame.width,
              minHeight: frame.minHeight,
              textAlign: block.align ?? "center",
              borderWidth: blockBorderWidth,
              boxShadow: isSelected
                ? `0 0 0 ${selectionRingWidth}px rgba(47, 123, 255, 0.35)`
                : undefined,
            };
            const handleBaseStyle: CSSProperties = {
              width: handleSize,
              height: handleSize,
            };
            const blockContent = (
              <>
                <span
                  className="block whitespace-pre-wrap break-words rounded-[0.45rem] px-[0.18em] py-[0.08em] font-[850] leading-[1.08] [overflow-wrap:anywhere]"
                  style={{
                    backgroundColor:
                      block.backgroundStyle === "solid"
                        ? hexToRgba(block.backgroundColor ?? "#FFFFFF", backgroundOpacity)
                        : "transparent",
                    color: block.color ?? "#FFFFFF",
                    fontSize,
                    fontFamily: SLIDESHOW_FONT_FAMILY,
                    fontWeight: slideshowTextFontWeight(block, index),
                    textShadow: slideshowTextShadow(block),
                  }}
                >
                  {blockText(block)}
                </span>
                {isSelected && isEditable ? (
                  <>
                    <span
                      className="absolute cursor-nwse-resize rounded-sm border border-white bg-[#2F7BFF]"
                      onPointerDown={(event) => startTextTransform(event, "top-left")}
                      style={{ ...handleBaseStyle, left: handleOffset, top: handleOffset }}
                    />
                    <span
                      className="absolute -translate-x-1/2 cursor-ns-resize rounded-sm border border-white bg-[#2F7BFF]"
                      onPointerDown={(event) => startTextTransform(event, "top")}
                      style={{ ...handleBaseStyle, left: "50%", top: handleOffset }}
                    />
                    <span
                      className="absolute cursor-nesw-resize rounded-sm border border-white bg-[#2F7BFF]"
                      onPointerDown={(event) => startTextTransform(event, "top-right")}
                      style={{ ...handleBaseStyle, right: handleOffset, top: handleOffset }}
                    />
                    <span
                      className="absolute -translate-y-1/2 cursor-ew-resize rounded-sm border border-white bg-[#2F7BFF]"
                      onPointerDown={(event) => startTextTransform(event, "right")}
                      style={{ ...handleBaseStyle, right: handleOffset, top: "50%" }}
                    />
                    <span
                      className="absolute cursor-nwse-resize rounded-sm border border-white bg-[#2F7BFF]"
                      onPointerDown={(event) => startTextTransform(event, "bottom-right")}
                      style={{ ...handleBaseStyle, bottom: handleOffset, right: handleOffset }}
                    />
                    <span
                      className="absolute -translate-x-1/2 cursor-ns-resize rounded-sm border border-white bg-[#2F7BFF]"
                      onPointerDown={(event) => startTextTransform(event, "bottom")}
                      style={{ ...handleBaseStyle, bottom: handleOffset, left: "50%" }}
                    />
                    <span
                      className="absolute cursor-nesw-resize rounded-sm border border-white bg-[#2F7BFF]"
                      onPointerDown={(event) => startTextTransform(event, "bottom-left")}
                      style={{ ...handleBaseStyle, bottom: handleOffset, left: handleOffset }}
                    />
                    <span
                      className="absolute -translate-y-1/2 cursor-ew-resize rounded-sm border border-white bg-[#2F7BFF]"
                      onPointerDown={(event) => startTextTransform(event, "left")}
                      style={{ ...handleBaseStyle, left: handleOffset, top: "50%" }}
                    />
                  </>
                ) : null}
              </>
            );
            const blockClassName = [
              "absolute h-auto border bg-transparent p-0 text-left transition",
              isEditable
                ? "cursor-pointer hover:border-[#2F7BFF]"
                : "pointer-events-none",
              isSelected && isEditable ? "border-[#2F7BFF]" : "border-transparent",
            ].join(" ");
            function startTextTransform(
              event: PointerEvent<HTMLElement>,
              resizeHandle?: ResizeHandle
            ) {
              if (!isEditable) return;
              event.preventDefault();
              event.stopPropagation();
              onSelectBlock?.(blockId);
              const slideElement = event.currentTarget.closest("[data-slide-preview]");
              if (!(slideElement instanceof HTMLElement)) return;
              const rect = slideElement.getBoundingClientRect();
              const startClientX = event.clientX;
              const startClientY = event.clientY;
              const startX = block.x ?? 10;
              const startY = block.y ?? 42;
              const startWidth = block.width ?? 80;
              const startHeight = block.height ?? 10;
              const clamp = (value: number, min: number, max: number) =>
                Math.min(max, Math.max(min, value));
              const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
                const deltaX = ((moveEvent.clientX - startClientX) / rect.width) * 100;
                const deltaY = ((moveEvent.clientY - startClientY) / rect.height) * 100;
                if (resizeHandle) {
                  let x = startX;
                  let y = startY;
                  let width = startWidth;
                  let height = startHeight;

                  if (resizeHandle.includes("right")) {
                    width = clamp(startWidth + deltaX, 12, 100 - startX);
                  }
                  if (resizeHandle.includes("left")) {
                    x = clamp(startX + deltaX, 0, startX + startWidth - 12);
                    width = clamp(startWidth + (startX - x), 12, 100 - x);
                  }
                  if (resizeHandle.includes("bottom")) {
                    height = clamp(startHeight + deltaY, 4, 100 - startY);
                  }
                  if (resizeHandle.includes("top")) {
                    y = clamp(startY + deltaY, 0, startY + startHeight - 4);
                    height = clamp(startHeight + (startY - y), 4, 100 - y);
                  }

                  onChangeBlock?.(blockId, { x, y, width, height });
                  return;
                }

                onChangeBlock?.(blockId, {
                  x: clamp(startX + deltaX, 0, 100 - startWidth),
                  y: clamp(startY + deltaY, 0, 100 - startHeight),
                });
              };
              const onPointerUp = () => {
                window.removeEventListener("pointermove", onPointerMove);
                window.removeEventListener("pointerup", onPointerUp);
              };
              window.addEventListener("pointermove", onPointerMove);
              window.addEventListener("pointerup", onPointerUp, { once: true });
            }

            return isEditable ? (
              <button
                aria-label={`Edit text block ${blockId}`}
                className={blockClassName}
                key={blockId}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectBlock?.(blockId);
                }}
                onPointerDown={(event) => startTextTransform(event)}
                style={blockStyle}
                type="button"
              >
                {blockContent}
              </button>
            ) : (
              <div className={blockClassName} key={blockId} style={blockStyle}>
                {blockContent}
              </div>
            );
          })
        : null}
      </div>
      {mode === "thumb" ? (
        <div className="absolute left-1 top-1 rounded-full bg-black/65 px-1.5 py-0.5 text-[0.55rem] font-[760] text-white">
          {slide.index}
        </div>
      ) : null}
    </div>
  );
}
