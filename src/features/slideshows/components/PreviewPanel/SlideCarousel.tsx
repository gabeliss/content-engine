import { Slide, TextElement, ContentConfig } from "../../types";
import { SlideEditor } from "./SlideEditor";
import {
  TEXT_STYLES,
  DEFAULT_CONFIG,
  PREVIEW_SLIDE_WIDTH,
  getPreviewFontSize,
  getDimensions,
} from "../../styles";

interface SlideCarouselProps {
  slides: Slide[];
  selectedIndex: number;
  onSelectSlide: (index: number) => void;
  config?: ContentConfig;
  isEditingText: boolean;
  selectedElementId: string | null;
  editedText: string;
  editedFontSize: number;
  onTextChange: (text: string) => void;
  onIncrementFontSize: () => void;
  onDecrementFontSize: () => void;
  onDeleteText: () => void;
  onStartTextEdit: (element: TextElement) => void;
}

// Render a single text element
function TextElementView({
  element,
  slideWidth,
  isSelected,
  onClick,
}: {
  element: TextElement;
  slideWidth: number;
  isSelected: boolean;
  onClick: () => void;
}) {
  const textShadow = TEXT_STYLES.getTextShadow(slideWidth);
  const previewFontSize = getPreviewFontSize(element.fontSize);
  const maxWidthPercent = element.maxWidth || 80;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        position: "absolute",
        top: `${element.position.y}%`,
        left: `${element.position.x}%`,
        transform: "translate(-50%, -50%)",
        maxWidth: `${maxWidthPercent}%`,
        color: element.fontColor || "#ffffff",
        fontSize: `${previewFontSize}px`,
        fontFamily: TEXT_STYLES.fontFamily,
        fontWeight: element.fontWeight || 700,
        textAlign: element.textAlign || "center",
        textShadow,
        lineHeight: TEXT_STYLES.lineHeight,
        cursor: "pointer",
        padding: "4px 8px",
        borderRadius: "4px",
        border: isSelected ? "2px solid #3b82f6" : "2px solid transparent",
        background: isSelected ? "rgba(59, 130, 246, 0.1)" : "transparent",
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      {element.content}
    </div>
  );
}

export function SlideCarousel({
  slides,
  selectedIndex,
  onSelectSlide,
  config,
  isEditingText,
  selectedElementId,
  editedText,
  editedFontSize,
  onTextChange,
  onIncrementFontSize,
  onDecrementFontSize,
  onDeleteText,
  onStartTextEdit,
}: SlideCarouselProps) {
  const aspectRatio = config?.aspectRatio || DEFAULT_CONFIG.aspectRatio;
  const { height: slideHeight } = getDimensions(aspectRatio, PREVIEW_SLIDE_WIDTH);

  const currentSlide = slides[selectedIndex];
  const editingElement = isEditingText && selectedElementId && currentSlide?.textElements
    ? currentSlide.textElements.find(el => el.id === selectedElementId)
    : null;

  return (
    <div style={{ marginBottom: "1rem", position: "relative", overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          gap: "1rem",
          height: `${slideHeight}px`,
          transform: `translateX(calc(50% - ${selectedIndex * (PREVIEW_SLIDE_WIDTH + 20)}px - ${PREVIEW_SLIDE_WIDTH / 2}px))`,
          transition: "transform 0.3s ease-out, height 0.3s ease-out",
        }}
      >
        {slides.map((slide, idx) => (
          <div
            key={idx}
            style={{
              minWidth: `${PREVIEW_SLIDE_WIDTH}px`,
              width: `${PREVIEW_SLIDE_WIDTH}px`,
              height: `${slideHeight}px`,
              position: "relative",
              borderRadius: "12px",
              overflow: "hidden",
              background: "#f3f4f6",
              border: selectedIndex === idx ? "3px solid #3b82f6" : "2px solid #e5e7eb",
              cursor: "pointer",
              opacity: selectedIndex === idx ? 1 : 0.6,
              transform: selectedIndex === idx ? "scale(1)" : "scale(0.95)",
              transition: "all 0.3s ease-out",
            }}
            onClick={() => onSelectSlide(idx)}
          >
            <img
              src={slide.imageUrl}
              alt={`Slide ${idx + 1}`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
            {/* Dark Overlay (for text readability) */}
            {slide.overlay && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0, 0, 0, 0.4)",
                }}
              />
            )}

            {/* Text Elements */}
            {selectedIndex === idx && slide.textElements?.map((element) => {
              // If editing this element, show the editor instead
              if (isEditingText && selectedElementId === element.id && editingElement) {
                return (
                  <SlideEditor
                    key={element.id}
                    editedText={editedText}
                    editedFontSize={editedFontSize}
                    position={element.position}
                    onTextChange={onTextChange}
                    onIncrementFontSize={onIncrementFontSize}
                    onDecrementFontSize={onDecrementFontSize}
                    onDeleteText={onDeleteText}
                  />
                );
              }

              // Otherwise show the text element (clickable to edit)
              return (
                <TextElementView
                  key={element.id}
                  element={element}
                  slideWidth={PREVIEW_SLIDE_WIDTH}
                  isSelected={selectedElementId === element.id}
                  onClick={() => onStartTextEdit(element)}
                />
              );
            })}

            {/* Show text elements on non-selected slides (non-interactive) */}
            {selectedIndex !== idx && slide.textElements?.map((element) => (
              <TextElementView
                key={element.id}
                element={element}
                slideWidth={PREVIEW_SLIDE_WIDTH}
                isSelected={false}
                onClick={() => {}}
              />
            ))}

            {/* Slide number badge */}
            <div
              style={{
                position: "absolute",
                top: "0.5rem",
                right: "0.5rem",
                background: "rgba(0, 0, 0, 0.6)",
                color: "white",
                padding: "0.25rem 0.5rem",
                borderRadius: "6px",
                fontSize: "0.75rem",
                fontWeight: 600,
              }}
            >
              {idx + 1}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
