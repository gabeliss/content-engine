import { Slide, ContentConfig } from "../../types";
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
  editedText: string;
  editedFontSize: number;
  onTextChange: (text: string) => void;
  onIncrementFontSize: () => void;
  onDecrementFontSize: () => void;
  onDeleteText: () => void;
  onStartTextEdit: () => void;
}

export function SlideCarousel({
  slides,
  selectedIndex,
  onSelectSlide,
  config,
  isEditingText,
  editedText,
  editedFontSize,
  onTextChange,
  onIncrementFontSize,
  onDecrementFontSize,
  onDeleteText,
  onStartTextEdit,
}: SlideCarouselProps) {
  const fontSize = config?.fontSize || DEFAULT_CONFIG.fontSize;
  const textPosition = config?.textPosition || DEFAULT_CONFIG.textPosition;
  const aspectRatio = config?.aspectRatio || DEFAULT_CONFIG.aspectRatio;
  const { height: slideHeight } = getDimensions(aspectRatio, PREVIEW_SLIDE_WIDTH);
  const previewFontSize = getPreviewFontSize(fontSize);

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
            {/* Text Overlay */}
            {isEditingText && selectedIndex === idx ? (
              <SlideEditor
                editedText={editedText}
                editedFontSize={editedFontSize}
                textPosition={textPosition}
                onTextChange={onTextChange}
                onIncrementFontSize={onIncrementFontSize}
                onDecrementFontSize={onDecrementFontSize}
                onDeleteText={onDeleteText}
              />
            ) : slide.text ? (
              <div
                onClick={(e) => {
                  if (selectedIndex === idx) {
                    e.stopPropagation();
                    onStartTextEdit();
                  }
                }}
                style={{
                  position: "absolute",
                  top: `${textPosition.y}%`,
                  left: `${textPosition.x}%`,
                  transform: "translate(-50%, -50%)",
                  color: TEXT_STYLES.color,
                  fontSize: `${previewFontSize}px`,
                  fontFamily: TEXT_STYLES.fontFamily,
                  fontWeight: TEXT_STYLES.fontWeight,
                  textAlign: "center",
                  textShadow: TEXT_STYLES.getTextShadow(PREVIEW_SLIDE_WIDTH),
                  width: "max-content",
                  maxWidth: `${TEXT_STYLES.maxWidthPercent * 100}%`,
                  whiteSpace: "pre-wrap",
                  lineHeight: TEXT_STYLES.lineHeight,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "flex-start",
                  cursor: selectedIndex === idx ? "pointer" : "default",
                }}
              >
                {slide.text}
              </div>
            ) : null}
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
