import { Slide, ContentConfig, AspectRatio } from "../../types";
import { SlideEditor } from "./SlideEditor";

const SLIDE_WIDTH = 275;

function getSlideHeight(aspectRatio: AspectRatio): number {
  switch (aspectRatio) {
    case "1:1":
      return SLIDE_WIDTH; // 300px
    case "4:5":
      return SLIDE_WIDTH * (5 / 4); // 375px
    case "9:16":
      return SLIDE_WIDTH * (16 / 9); // ~533px
    default:
      return SLIDE_WIDTH;
  }
}

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
  const fontSize = config?.fontSize || 48;
  const textPosition = config?.textPosition || { x: 50, y: 50 };
  const aspectRatio = config?.aspectRatio || "1:1";
  const slideHeight = getSlideHeight(aspectRatio);

  return (
    <div style={{ marginBottom: "1rem", position: "relative", overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          gap: "1rem",
          height: `${slideHeight}px`,
          transform: `translateX(calc(50% - ${selectedIndex * (SLIDE_WIDTH + 20)}px - ${SLIDE_WIDTH / 2}px))`,
          transition: "transform 0.3s ease-out, height 0.3s ease-out",
        }}
      >
        {slides.map((slide, idx) => (
          <div
            key={idx}
            style={{
              minWidth: `${SLIDE_WIDTH}px`,
              width: `${SLIDE_WIDTH}px`,
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
                  color: "white",
                  fontSize: `${fontSize / 4}px`,
                  fontFamily: '"TikTok Display Medium"',
                  fontWeight: 700,
                  textAlign: "center",
                  textShadow:
                    "rgb(0, 0, 0) -0.714286px -0.714286px 0px, rgb(0, 0, 0) 0.714286px -0.714286px 0px, rgb(0, 0, 0) -0.714286px 0.714286px 0px, rgb(0, 0, 0) 0.714286px 0.714286px 0px",
                  width: "max-content",
                  maxWidth: "90%",
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.2,
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
