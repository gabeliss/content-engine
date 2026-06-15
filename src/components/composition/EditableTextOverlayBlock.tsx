import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import {
  TEXT_OVERLAY_FONT_FAMILY,
  hexToRgba,
  textOverlayBlockFrame,
  textOverlayFontSize,
  textOverlayFontWeight,
  textOverlayShadow,
  textOverlayText,
  type TextOverlayBlock,
} from "../../lib/composition/textOverlays";

type ResizeHandle =
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

const RESIZE_HANDLES: Array<{
  cursor: string;
  handle: ResizeHandle;
  positionClassName: string;
}> = [
  { cursor: "cursor-nwse-resize", handle: "top-left", positionClassName: "" },
  { cursor: "cursor-ns-resize", handle: "top", positionClassName: "-translate-x-1/2" },
  { cursor: "cursor-nesw-resize", handle: "top-right", positionClassName: "" },
  { cursor: "cursor-ew-resize", handle: "right", positionClassName: "-translate-y-1/2" },
  { cursor: "cursor-nwse-resize", handle: "bottom-right", positionClassName: "" },
  { cursor: "cursor-ns-resize", handle: "bottom", positionClassName: "-translate-x-1/2" },
  { cursor: "cursor-nesw-resize", handle: "bottom-left", positionClassName: "" },
  { cursor: "cursor-ew-resize", handle: "left", positionClassName: "-translate-y-1/2" },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function handlePositionStyle(handle: ResizeHandle, offset: number): CSSProperties {
  switch (handle) {
    case "top-left":
      return { left: offset, top: offset };
    case "top":
      return { left: "50%", top: offset };
    case "top-right":
      return { right: offset, top: offset };
    case "right":
      return { right: offset, top: "50%" };
    case "bottom-right":
      return { bottom: offset, right: offset };
    case "bottom":
      return { bottom: offset, left: "50%" };
    case "bottom-left":
      return { bottom: offset, left: offset };
    case "left":
      return { left: offset, top: "50%" };
  }
}

export function EditableTextOverlayBlock({
  block,
  dimensions,
  index,
  isEditable,
  isSelected,
  onChangeBlock,
  onSelectBlock,
  stageScale,
}: {
  block: TextOverlayBlock;
  dimensions: { width: number; height: number };
  index: number;
  isEditable: boolean;
  isSelected: boolean;
  onChangeBlock?: (blockId: string, patch: Partial<TextOverlayBlock>) => void;
  onSelectBlock?: (blockId: string) => void;
  stageScale: number;
}) {
  const blockId = block.id ?? "text";
  const editableRef = useRef<HTMLSpanElement>(null);
  const lastClickAtRef = useRef(0);
  const [isEditingText, setIsEditingText] = useState(false);
  const backgroundOpacity = block.backgroundOpacity ?? 1;
  const frame = textOverlayBlockFrame(block, dimensions);
  const handleSize = Math.max(10 / Math.max(stageScale, 0.01), 10);
  const handleOffset = -handleSize / 2;
  const selectionBorderWidth = isSelected ? Math.max(1 / Math.max(stageScale, 0.01), 1) : 0;
  const selectionRingWidth = Math.max(2 / Math.max(stageScale, 0.01), 2);
  const blockStyle: CSSProperties = {
    left: frame.x,
    top: frame.y,
    width: frame.width,
    minHeight: frame.minHeight,
    textAlign: block.align ?? "center",
    borderWidth: selectionBorderWidth,
    boxShadow: isSelected
      ? `0 0 0 ${selectionRingWidth}px rgba(47, 123, 255, 0.35)`
      : undefined,
  };

  useEffect(() => {
    if (!isEditingText) return;
    const element = editableRef.current;
    if (!element) return;
    element.textContent = textOverlayText(block, false);
    element.focus();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [block, isEditingText]);

  function commitDraftText() {
    const nextText = editableRef.current?.textContent ?? "";
    setIsEditingText(false);
    if (nextText !== textOverlayText(block, false)) {
      onChangeBlock?.(blockId, { items: [], text: nextText });
    }
  }

  function startInlineEditing() {
    if (!isEditable) return;
    onSelectBlock?.(blockId);
    setIsEditingText(true);
  }

  function handleBlockClick(event: React.MouseEvent<HTMLElement>) {
    event.stopPropagation();
    onSelectBlock?.(blockId);
    const now = Date.now();
    if (now - lastClickAtRef.current < 320) {
      startInlineEditing();
    }
    lastClickAtRef.current = now;
  }

  function handleTextKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setIsEditingText(false);
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      commitDraftText();
    }
  }

  function startTextTransform(event: PointerEvent<HTMLElement>, resizeHandle?: ResizeHandle) {
    if (!isEditable || isEditingText) return;
    event.preventDefault();
    event.stopPropagation();
    onSelectBlock?.(blockId);
    const stageElement = event.currentTarget.closest("[data-text-overlay-stage]");
    if (!(stageElement instanceof HTMLElement)) return;
    const rect = stageElement.getBoundingClientRect();
    const startClientX = event.clientX;
    const startClientY = event.clientY;
    const startX = block.x ?? 10;
    const startY = block.y ?? 42;
    const startWidth = block.width ?? 80;
    const startHeight = block.height ?? 10;

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

  const blockContent = (
    <>
      <span
        className={[
          "block whitespace-pre-wrap break-words rounded-[0.45rem] px-[0.18em] py-[0.08em] font-[850] leading-[1.08] [overflow-wrap:anywhere]",
          isEditingText ? "cursor-text outline-none ring-2 ring-white/85" : "",
        ].join(" ")}
        contentEditable={isEditingText}
        onBlur={commitDraftText}
        onKeyDown={handleTextKeyDown}
        onPointerDown={(event) => {
          if (isEditingText) event.stopPropagation();
        }}
        ref={editableRef}
        suppressContentEditableWarning
        style={{
          backgroundColor:
            block.backgroundStyle === "solid"
              ? hexToRgba(block.backgroundColor ?? "#FFFFFF", backgroundOpacity)
              : "transparent",
          color: block.color ?? "#FFFFFF",
          fontFamily: TEXT_OVERLAY_FONT_FAMILY,
          fontSize: textOverlayFontSize(block, index),
          fontWeight: textOverlayFontWeight(block, index),
          textShadow: textOverlayShadow(block),
        }}
      >
        {isEditingText ? null : textOverlayText(block)}
      </span>
      {isSelected && isEditable ? (
        <>
          {RESIZE_HANDLES.map((handle) => (
            <span
              className={[
                "absolute rounded-sm border border-white bg-[#2F7BFF]",
                handle.cursor,
                handle.positionClassName,
              ].join(" ")}
              key={handle.handle}
              onPointerDown={(event) => startTextTransform(event, handle.handle)}
              style={{
                height: handleSize,
                ...handlePositionStyle(handle.handle, handleOffset),
                width: handleSize,
              }}
            />
          ))}
        </>
      ) : null}
    </>
  );

  const blockClassName = [
    "absolute h-auto border bg-transparent p-0 text-left transition",
    isEditable ? "pointer-events-auto cursor-pointer hover:border-[#2F7BFF]" : "pointer-events-none",
    isSelected && isEditable ? "border-[#2F7BFF]" : "border-transparent",
  ].join(" ");

  return isEditable ? (
    <div
      aria-label={`Edit text block ${blockId}`}
      className={blockClassName}
      onClick={handleBlockClick}
      onDoubleClick={(event) => {
        event.stopPropagation();
        startInlineEditing();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !isEditingText) {
          event.preventDefault();
          startInlineEditing();
        }
      }}
      onPointerDown={(event) => startTextTransform(event)}
      role="button"
      style={blockStyle}
      tabIndex={0}
    >
      {blockContent}
    </div>
  ) : (
    <div className={blockClassName} style={blockStyle}>
      {blockContent}
    </div>
  );
}
