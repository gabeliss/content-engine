import { Slide } from "../../types";

const THUMBNAIL_SIZE = 80;

interface ThumbnailNavProps {
  slides: Slide[];
  selectedIndex: number;
  onSelectSlide: (index: number) => void;
}

export function ThumbnailNav({
  slides,
  selectedIndex,
  onSelectSlide,
}: ThumbnailNavProps) {

  return (
    <div
      style={{
        display: "flex",
        gap: "0.5rem",
        justifyContent: "center",
        marginBottom: "1rem",
        overflowX: "auto",
        paddingBottom: "0.5rem",
      }}
    >
      {slides.map((slide, idx) => (
        <div
          key={idx}
          onClick={() => onSelectSlide(idx)}
          style={{
            cursor: "pointer",
            position: "relative",
            width: `${THUMBNAIL_SIZE}px`,
            height: `${THUMBNAIL_SIZE}px`,
            borderRadius: "8px",
            overflow: "hidden",
            border: selectedIndex === idx ? "2px solid #3b82f6" : "2px solid #e5e7eb",
            flexShrink: 0,
          }}
        >
          {slide.imageUrl && (
            <img
              src={slide.imageUrl}
              alt={`Slide ${idx + 1}`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
