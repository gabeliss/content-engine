import { Image as ImageIcon } from "lucide-react";
import { ContentItem, Product } from "../types";
import { formatDate } from "../utils";
import { Id } from "../../../../convex/_generated/dataModel";

interface SlideshowGridProps {
  slideshows: ContentItem[] | undefined;
  products: Product[] | undefined;
  currentSlideshowId?: Id<"content"> | null;
  onSelectSlideshow: (id: Id<"content">) => void;
  title?: string;
}

export function SlideshowGrid({
  slideshows,
  products,
  currentSlideshowId,
  onSelectSlideshow,
  title = "My Slideshows",
}: SlideshowGridProps) {
  const getProduct = (productId?: Id<"products">) => {
    return products?.find((p) => p._id === productId);
  };

  return (
    <div className="card">
      <h2 style={{ margin: "0 0 1rem 0", fontSize: "1rem" }}>{title}</h2>

      {!slideshows || slideshows.length === 0 ? (
        <div className="empty-state" style={{ padding: "2rem" }}>
          <div className="empty-state-icon">📭</div>
          <h3>No slideshows yet</h3>
          <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
            Generate a slideshow to get started
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: "1rem",
          }}
        >
          {slideshows.map((slideshow) => {
            const product = getProduct(slideshow.productId);
            const isCurrentlyEditing = currentSlideshowId === slideshow._id;
            const firstSlide = slideshow.content?.slides?.[0];

            return (
              <div
                key={slideshow._id}
                onClick={() => onSelectSlideshow(slideshow._id)}
                style={{
                  cursor: "pointer",
                  borderRadius: "12px",
                  overflow: "hidden",
                  border: isCurrentlyEditing
                    ? "2px solid #3b82f6"
                    : "1px solid #e5e7eb",
                  background: "white",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!isCurrentlyEditing) {
                    e.currentTarget.style.borderColor = "#d1d5db";
                    e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isCurrentlyEditing) {
                    e.currentTarget.style.borderColor = "#e5e7eb";
                    e.currentTarget.style.boxShadow = "none";
                  }
                }}
              >
                {/* Thumbnail */}
                <div
                  style={{
                    aspectRatio: "1",
                    background: "#f3f4f6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                  }}
                >
                  {firstSlide?.imageUrl ? (
                    <img
                      src={firstSlide.imageUrl}
                      alt="Preview"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <ImageIcon size={32} style={{ opacity: 0.3 }} />
                  )}

                  {/* Currently Editing Indicator */}
                  {isCurrentlyEditing && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "0.5rem",
                        left: "0.5rem",
                        padding: "0.25rem 0.5rem",
                        borderRadius: "4px",
                        fontSize: "0.625rem",
                        fontWeight: 600,
                        background: "#3b82f6",
                        color: "white",
                      }}
                    >
                      Editing
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ padding: "0.75rem" }}>
                  <div
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      marginBottom: "0.25rem",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {slideshow.inputParams?.topic || "Untitled"}
                  </div>
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "#6b7280",
                    }}
                  >
                    {product?.name || "No product"} • {slideshow.content?.slides?.length || 0} slides
                  </div>
                  <div
                    style={{
                      fontSize: "0.625rem",
                      color: "#9ca3af",
                      marginTop: "0.25rem",
                    }}
                  >
                    {formatDate(slideshow.createdAt)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
