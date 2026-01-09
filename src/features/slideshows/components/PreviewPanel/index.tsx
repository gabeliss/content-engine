import { Upload } from "lucide-react";
import { ContentItem, AspectRatio } from "../../types";
import { PlaceholderState } from "./PlaceholderState";
import { SlideCarousel } from "./SlideCarousel";
import { ThumbnailNav } from "./ThumbnailNav";
import { EditModeButtons } from "./EditModeButtons";

interface PreviewPanelProps {
  selectedCarouselItem: ContentItem | undefined;
  selectedSlideIndex: number;
  onSelectSlide: (index: number) => void;

  // Text editing
  isEditingText: boolean;
  editedText: string;
  editedFontSize: number;
  onTextChange: (text: string) => void;
  onStartTextEdit: () => void;
  onCancelTextEdit: () => void;
  onSaveTextEdit: () => void;
  onDeleteText: () => void;
  onIncrementFontSize: () => void;
  onDecrementFontSize: () => void;

  // Overlay & ratio
  onToggleOverlay: () => void;
  showRatioMenu: boolean;
  onToggleRatioMenu: () => void;
  onChangeRatio: (ratio: AspectRatio) => void;

  // Export
  onExport: () => void;
}

export function PreviewPanel({
  selectedCarouselItem,
  selectedSlideIndex,
  onSelectSlide,
  isEditingText,
  editedText,
  editedFontSize,
  onTextChange,
  onStartTextEdit,
  onCancelTextEdit,
  onSaveTextEdit,
  onDeleteText,
  onIncrementFontSize,
  onDecrementFontSize,
  onToggleOverlay,
  showRatioMenu,
  onToggleRatioMenu,
  onChangeRatio,
  onExport,
}: PreviewPanelProps) {
  const isExported = selectedCarouselItem?.exportedAt !== undefined;
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1rem" }}>Preview Editor</h2>
      </div>

      {selectedCarouselItem ? (
        <>
          {/* Status (only show if error) */}
          {selectedCarouselItem.errorMessage && (
            <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
              {selectedCarouselItem.errorMessage}
            </div>
          )}

          {/* Slides Carousel Preview */}
          {selectedCarouselItem.content?.slides &&
            selectedCarouselItem.content.slides.length > 0 && (
              <>
                <SlideCarousel
                  slides={selectedCarouselItem.content.slides}
                  selectedIndex={selectedSlideIndex}
                  onSelectSlide={onSelectSlide}
                  config={selectedCarouselItem.content.config}
                  isEditingText={isEditingText}
                  editedText={editedText}
                  editedFontSize={editedFontSize}
                  onTextChange={onTextChange}
                  onIncrementFontSize={onIncrementFontSize}
                  onDecrementFontSize={onDecrementFontSize}
                  onDeleteText={onDeleteText}
                  onStartTextEdit={onStartTextEdit}
                />

                <EditModeButtons
                  isEditingText={isEditingText}
                  onCancelEdit={onCancelTextEdit}
                  onSaveEdit={onSaveTextEdit}
                  onToggleOverlay={onToggleOverlay}
                  onStartTextEdit={onStartTextEdit}
                  onToggleRatioMenu={onToggleRatioMenu}
                  showRatioMenu={showRatioMenu}
                  currentRatio={selectedCarouselItem.content.config?.aspectRatio || "1:1"}
                  hasOverlay={
                    selectedCarouselItem.content.slides[selectedSlideIndex]?.overlay || false
                  }
                  onChangeRatio={onChangeRatio}
                />

                <ThumbnailNav
                  slides={selectedCarouselItem.content.slides}
                  selectedIndex={selectedSlideIndex}
                  onSelectSlide={onSelectSlide}
                />

                {/* Export Button */}
                {!isExported && (
                  <button
                    className="btn btn-primary"
                    onClick={onExport}
                    style={{ width: "100%" }}
                  >
                    <Upload size={16} /> Export Slideshow
                  </button>
                )}
                {isExported && (
                  <div
                    style={{
                      textAlign: "center",
                      color: "#10b981",
                      fontSize: "0.875rem",
                      fontWeight: 500,
                    }}
                  >
                    Exported
                  </div>
                )}
              </>
            )}
        </>
      ) : (
        <PlaceholderState />
      )}
    </div>
  );
}
