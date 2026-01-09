import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  X,
  Download,
  Calendar,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { ContentItem, Product } from "../types";

// TikTok icon component
function TikTokIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

interface SlideshowActionModalProps {
  slideshow: ContentItem;
  product?: Product | null;
  onClose: () => void;
  onDelete?: () => void;
}

export function SlideshowActionModal({
  slideshow,
  product,
  onClose,
  onDelete,
}: SlideshowActionModalProps) {
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const removeContent = useMutation(api.content.remove);

  const slides = slideshow.content?.slides || [];
  const currentSlide = slides[selectedSlideIndex];
  const config = slideshow.content?.config;

  const handlePrevSlide = () => {
    setSelectedSlideIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextSlide = () => {
    setSelectedSlideIndex((prev) => Math.min(slides.length - 1, prev + 1));
  };

  const handleDownloadImages = async () => {
    // Download all slide images
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      if (slide.imageUrl) {
        const link = document.createElement("a");
        link.href = slide.imageUrl;
        link.download = `slide-${i + 1}.png`;
        link.click();
        // Small delay between downloads
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
  };

  const handlePublishToTikTok = () => {
    // Placeholder - will be implemented later
    alert("Publish to TikTok coming soon!");
  };

  const handleSchedule = () => {
    // Placeholder - will be implemented later
    alert("Scheduling coming soon!");
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this slideshow?")) return;

    setIsDeleting(true);
    try {
      await removeContent({ id: slideshow._id });
      onDelete?.();
      onClose();
    } catch (error) {
      console.error("Failed to delete:", error);
      alert("Failed to delete slideshow");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "700px", width: "100%" }}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 style={{ marginBottom: "0.25rem" }}>
              {slideshow.inputParams?.topic || "Untitled Slideshow"}
            </h2>
            {product && (
              <p style={{ fontSize: "0.875rem", color: "#6b7280", margin: 0 }}>
                {product.name}
              </p>
            )}
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: "1.5rem" }}>
          {/* Slide Preview */}
          <div>
            {currentSlide && (
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  paddingBottom: config?.aspectRatio === "9:16" ? "177.78%" : config?.aspectRatio === "4:5" ? "125%" : "100%",
                  borderRadius: "12px",
                  overflow: "hidden",
                  background: "#f3f4f6",
                }}
              >
                {currentSlide.imageUrl && (
                  <img
                    src={currentSlide.imageUrl}
                    alt={`Slide ${selectedSlideIndex + 1}`}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                )}
                {/* Dark Overlay */}
                {currentSlide.overlay && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "rgba(0, 0, 0, 0.4)",
                    }}
                  />
                )}
                {/* Text Overlay */}
                {currentSlide.text && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "1rem",
                      textAlign: "center",
                    }}
                  >
                    <p
                      style={{
                        fontSize: `${(config?.fontSize || 48) / 3}px`,
                        color: "white",
                        fontWeight: 700,
                        textShadow:
                          "rgb(0, 0, 0) -0.5px -0.5px 0px, rgb(0, 0, 0) 0.5px -0.5px 0px, rgb(0, 0, 0) -0.5px 0.5px 0px, rgb(0, 0, 0) 0.5px 0.5px 0px",
                        margin: 0,
                        lineHeight: 1.2,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {currentSlide.text}
                    </p>
                  </div>
                )}

                {/* Navigation Arrows */}
                {slides.length > 1 && (
                  <>
                    <button
                      onClick={handlePrevSlide}
                      disabled={selectedSlideIndex === 0}
                      style={{
                        position: "absolute",
                        left: "0.5rem",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "rgba(0, 0, 0, 0.5)",
                        border: "none",
                        borderRadius: "50%",
                        width: "32px",
                        height: "32px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: selectedSlideIndex === 0 ? "not-allowed" : "pointer",
                        opacity: selectedSlideIndex === 0 ? 0.3 : 1,
                        color: "white",
                      }}
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      onClick={handleNextSlide}
                      disabled={selectedSlideIndex === slides.length - 1}
                      style={{
                        position: "absolute",
                        right: "0.5rem",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "rgba(0, 0, 0, 0.5)",
                        border: "none",
                        borderRadius: "50%",
                        width: "32px",
                        height: "32px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: selectedSlideIndex === slides.length - 1 ? "not-allowed" : "pointer",
                        opacity: selectedSlideIndex === slides.length - 1 ? 0.3 : 1,
                        color: "white",
                      }}
                    >
                      <ChevronRight size={20} />
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Slide Dots */}
            {slides.length > 1 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "0.5rem",
                  marginTop: "1rem",
                }}
              >
                {slides.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedSlideIndex(idx)}
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      border: "none",
                      background: idx === selectedSlideIndex ? "#3b82f6" : "#d1d5db",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "0.875rem", fontWeight: 600 }}>
              Actions
            </h3>

            <button
              className="btn btn-primary"
              onClick={handleDownloadImages}
              style={{ width: "100%", justifyContent: "center" }}
            >
              <Download size={16} /> Download Images
            </button>

            <button
              className="btn"
              onClick={handlePublishToTikTok}
              style={{
                width: "100%",
                justifyContent: "center",
                background: "#fe2c55",
                color: "white",
                border: "none",
              }}
            >
              <TikTokIcon size={16} /> Publish to TikTok
            </button>

            <button
              className="btn btn-secondary"
              onClick={handleSchedule}
              style={{ width: "100%", justifyContent: "center" }}
            >
              <Calendar size={16} /> Schedule
            </button>

            <div style={{ flex: 1 }} />

            <button
              className="btn"
              onClick={handleDelete}
              disabled={isDeleting}
              style={{
                width: "100%",
                justifyContent: "center",
                background: "#fef2f2",
                color: "#dc2626",
                border: "1px solid #fecaca",
              }}
            >
              <Trash2 size={16} /> {isDeleting ? "Deleting..." : "Delete Slideshow"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
