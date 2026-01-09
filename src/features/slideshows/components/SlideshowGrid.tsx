import { useState } from "react";
import { Image as ImageIcon, RefreshCw } from "lucide-react";
import { ContentItem, Product } from "../types";
import { SlideshowActionModal } from "./SlideshowActionModal";
import { formatDate } from "../utils";
import { Id } from "../../../../convex/_generated/dataModel";

type TabFilter = "all" | "drafts" | "exported";

interface SlideshowGridProps {
  slideshows: ContentItem[] | undefined;
  products: Product[] | undefined;
  currentSlideshowId?: Id<"content"> | null;
  onSelectDraft: (id: Id<"content">) => void;
  showTabs?: boolean;
  defaultTab?: TabFilter;
  title?: string;
}

export function SlideshowGrid({
  slideshows,
  products,
  currentSlideshowId,
  onSelectDraft,
  showTabs = true,
  defaultTab = "all",
  title = "My Slideshows",
}: SlideshowGridProps) {
  const [activeTab, setActiveTab] = useState<TabFilter>(defaultTab);
  const [selectedExportedSlideshow, setSelectedExportedSlideshow] = useState<ContentItem | null>(null);

  // Filter slideshows based on tab
  const filteredSlideshows = slideshows?.filter((s) => {
    // Only show ready/edited slideshows (not pending/generating/failed)
    if (s.status !== "ready" && s.status !== "edited") return false;

    if (activeTab === "all") return true;
    if (activeTab === "drafts") return s.exportedAt === undefined;
    if (activeTab === "exported") return s.exportedAt !== undefined;
    return true;
  });

  const counts = {
    all: slideshows?.filter((s) => s.status === "ready" || s.status === "edited").length || 0,
    drafts: slideshows?.filter((s) => (s.status === "ready" || s.status === "edited") && s.exportedAt === undefined).length || 0,
    exported: slideshows?.filter((s) => s.exportedAt !== undefined).length || 0,
  };

  const handleSlideshowClick = (slideshow: ContentItem) => {
    if (slideshow.exportedAt !== undefined) {
      // Open action modal for exported slideshows
      setSelectedExportedSlideshow(slideshow);
    } else {
      // Load draft into editor
      onSelectDraft(slideshow._id);
    }
  };

  const getProduct = (productId?: Id<"products">) => {
    return products?.find((p) => p._id === productId);
  };

  return (
    <div className="card">
      {/* Header with Tabs */}
      <div style={{ marginBottom: "1rem" }}>
        <h2 style={{ margin: "0 0 1rem 0", fontSize: "1rem" }}>{title}</h2>

        {showTabs && (
          <div className="tabs">
            {(["all", "drafts", "exported"] as TabFilter[]).map((tab) => (
              <button
                key={tab}
                className={`tab ${activeTab === tab ? "active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {counts[tab] > 0 && (
                  <span
                    style={{
                      marginLeft: "0.5rem",
                      background: activeTab === tab ? "#3b82f6" : "#e5e7eb",
                      color: activeTab === tab ? "white" : "#6b7280",
                      padding: "0.125rem 0.5rem",
                      borderRadius: "9999px",
                      fontSize: "0.75rem",
                    }}
                  >
                    {counts[tab]}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid */}
      {!filteredSlideshows || filteredSlideshows.length === 0 ? (
        <div className="empty-state" style={{ padding: "2rem" }}>
          <div className="empty-state-icon">
            {activeTab === "drafts" ? "📝" : activeTab === "exported" ? "📤" : "📭"}
          </div>
          <h3>
            {activeTab === "drafts"
              ? "No drafts"
              : activeTab === "exported"
              ? "No exported slideshows"
              : "No slideshows yet"}
          </h3>
          <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
            {activeTab === "drafts"
              ? "Generate a slideshow to get started"
              : activeTab === "exported"
              ? "Export a slideshow to see it here"
              : "Generate a slideshow to get started"}
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
          {filteredSlideshows.map((slideshow) => {
            const product = getProduct(slideshow.productId);
            const isCurrentlyEditing = currentSlideshowId === slideshow._id;
            const isDraft = slideshow.exportedAt === undefined;
            const firstSlide = slideshow.content?.slides?.[0];

            return (
              <div
                key={slideshow._id}
                onClick={() => handleSlideshowClick(slideshow)}
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
                  ) : slideshow.status === "generating" || slideshow.status === "pending" ? (
                    <RefreshCw
                      size={32}
                      style={{ opacity: 0.3, animation: "spin 2s linear infinite" }}
                    />
                  ) : (
                    <ImageIcon size={32} style={{ opacity: 0.3 }} />
                  )}

                  {/* Badge */}
                  <div
                    style={{
                      position: "absolute",
                      top: "0.5rem",
                      right: "0.5rem",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "4px",
                      fontSize: "0.625rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      background: isDraft ? "#fef3c7" : "#d1fae5",
                      color: isDraft ? "#92400e" : "#065f46",
                    }}
                  >
                    {isDraft ? "Draft" : "Exported"}
                  </div>

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

      {/* Action Modal for Exported Slideshows */}
      {selectedExportedSlideshow && (
        <SlideshowActionModal
          slideshow={selectedExportedSlideshow}
          product={getProduct(selectedExportedSlideshow.productId)}
          onClose={() => setSelectedExportedSlideshow(null)}
          onDelete={() => setSelectedExportedSlideshow(null)}
        />
      )}
    </div>
  );
}
