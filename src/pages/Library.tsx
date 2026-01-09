import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  Trash2,
  X,
  Edit2,
  Image as ImageIcon,
  RefreshCw,
  Package,
} from "lucide-react";
import ContentEditor from "../components/ContentEditor";

type StatusFilter = "all" | "ready" | "generating" | "downloaded" | "posted" | "failed";

export default function Library() {
  const content = useQuery(api.content.list);
  const products = useQuery(api.products.list);
  const updateStatus = useMutation(api.content.updateStatus);
  const removeContent = useMutation(api.content.remove);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedContent, setSelectedContent] = useState<Id<"content"> | null>(null);
  const [editingContent, setEditingContent] = useState<Id<"content"> | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const selectedItem = content?.find((c) => c._id === selectedContent);
  const editingItem = content?.find((c) => c._id === editingContent);
  const product = selectedItem
    ? products?.find((p) => p._id === selectedItem.productId)
    : null;
  const editingProduct = editingItem
    ? products?.find((p) => p._id === editingItem.productId)
    : null;

  const filteredContent = content?.filter((c) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "ready") return c.status === "ready" || c.status === "edited";
    return c.status === statusFilter;
  });

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const handleDownloadAll = async (item = selectedItem) => {
    if (!item?.content?.slides) return;

    setIsDownloading(true);
    try {
      const zip = new JSZip();
      const topic = item.inputParams?.topic || "carousel";
      const folderName = topic.replace(/[^a-z0-9]/gi, "_").toLowerCase();

      // Add each slide to the zip
      for (let i = 0; i < item.content.slides.length; i++) {
        const slide = item.content.slides[i];
        if (slide.imageUrl) {
          // Extract base64 data from data URL
          const base64Data = slide.imageUrl.split(",")[1];
          if (base64Data) {
            zip.file(`${folderName}/slide-${i + 1}.png`, base64Data, { base64: true });
          }
        }
      }

      // Add slide texts as text file
      const slideTexts = item.content.slides.map((s, i) => `Slide ${i + 1}: ${s.text}`).join("\n\n");
      zip.file(`${folderName}/slide-texts.txt`, slideTexts);

      // Generate and download zip
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `${folderName}.zip`);

      // Update status
      await updateStatus({
        id: item._id,
        status: "downloaded",
      });
    } catch (error) {
      console.error("Download failed:", error);
      alert("Failed to download slides");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = async (id: Id<"content">) => {
    if (confirm("Are you sure you want to delete this content?")) {
      await removeContent({ id });
      if (selectedContent === id) {
        setSelectedContent(null);
      }
    }
  };

  const statusCounts = {
    all: content?.length || 0,
    ready: content?.filter((c) => c.status === "ready" || c.status === "edited").length || 0,
    generating: content?.filter((c) => c.status === "generating" || c.status === "pending").length || 0,
    downloaded: content?.filter((c) => c.status === "downloaded").length || 0,
    posted: content?.filter((c) => c.status === "posted").length || 0,
    failed: content?.filter((c) => c.status === "failed").length || 0,
  };

  return (
    <div>
      <div className="page-header">
        <h1>Content Library</h1>
        <p>Review and manage your generated content</p>
      </div>

      {/* Status Tabs */}
      <div className="tabs">
        {(["all", "ready", "generating", "downloaded", "posted", "failed"] as StatusFilter[]).map(
          (status) => (
            <button
              key={status}
              className={`tab ${statusFilter === status ? "active" : ""}`}
              onClick={() => setStatusFilter(status)}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              {statusCounts[status] > 0 && (
                <span
                  style={{
                    marginLeft: "0.5rem",
                    background: statusFilter === status ? "#3b82f6" : "#e5e7eb",
                    color: statusFilter === status ? "white" : "#6b7280",
                    padding: "0.125rem 0.5rem",
                    borderRadius: "9999px",
                    fontSize: "0.75rem",
                  }}
                >
                  {statusCounts[status]}
                </span>
              )}
            </button>
          )
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selectedContent ? "1fr 400px" : "1fr", gap: "1.5rem" }}>
        {/* Content List */}
        <div className="card">
          {!filteredContent || filteredContent.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <h3>No content found</h3>
              <p>
                {statusFilter === "all"
                  ? "Generate some content from your projects!"
                  : `No content with status "${statusFilter}"`}
              </p>
            </div>
          ) : (
            <div className="content-list">
              {filteredContent.map((item) => {
                const itemProduct = products?.find((p) => p._id === item.productId);
                return (
                  <div
                    key={item._id}
                    className="content-item"
                    style={{
                      cursor: "pointer",
                      border: selectedContent === item._id ? "2px solid #3b82f6" : undefined,
                    }}
                    onClick={() => setSelectedContent(item._id)}
                  >
                    <div className="content-preview">
                      {item.content?.slides?.[0]?.imageUrl ? (
                        <img src={item.content.slides[0].imageUrl} alt="Preview" />
                      ) : item.status === "generating" || item.status === "pending" ? (
                        <RefreshCw size={24} style={{ opacity: 0.3, animation: "spin 2s linear infinite" }} />
                      ) : (
                        <ImageIcon size={24} style={{ opacity: 0.3 }} />
                      )}
                    </div>
                    <div className="content-details">
                      <h4 className="truncate">{item.inputParams?.topic || "Untitled"}</h4>
                      <div className="content-meta">
                        {itemProduct?.name} • {item.content?.slides?.length || item.inputParams?.slideCount || 0} slides
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <span className={`badge badge-${item.status}`}>{item.status}</span>
                        <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                          {formatDate(item.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.25rem" }}>
                      {(item.status === "ready" || item.status === "edited" || item.status === "downloaded") && (
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingContent(item._id);
                          }}
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item._id);
                        }}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedContent && selectedItem && (
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ margin: 0 }}>Content Details</h2>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setSelectedContent(null)}
              >
                <X size={14} />
              </button>
            </div>

            {/* Status */}
            <div style={{ marginBottom: "1rem" }}>
              <span className={`badge badge-${selectedItem.status}`}>
                {selectedItem.status}
              </span>
              {selectedItem.errorMessage && (
                <div className="alert alert-error" style={{ marginTop: "0.5rem" }}>
                  {selectedItem.errorMessage}
                </div>
              )}
            </div>

            {/* Info */}
            <div style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "1rem" }}>
              <div><strong>Product:</strong> {product?.name}</div>
              <div><strong>Topic:</strong> {selectedItem.inputParams?.topic}</div>
              <div><strong>Created:</strong> {formatDate(selectedItem.createdAt)}</div>
            </div>

            {/* Slides Preview */}
            {selectedItem.content?.slides && selectedItem.content.slides.length > 0 && (
              <>
                <h3 style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Slides ({selectedItem.content.slides.length})
                </h3>
                <div className="carousel-preview">
                  {selectedItem.content.slides.map((slide, idx) => (
                    <div key={idx} className="slide-preview">
                      {slide.imageUrl && <img src={slide.imageUrl} alt={`Slide ${idx + 1}`} />}
                      <div className="slide-preview-text">{slide.text}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Actions */}
            {(selectedItem.status === "ready" || selectedItem.status === "edited" || selectedItem.status === "downloaded") && (
              <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setEditingContent(selectedItem._id)}
                >
                  <Edit2 size={16} /> Edit Content
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => handleDownloadAll()}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <>
                      <span className="spinner" style={{ width: 16, height: 16 }} />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Package size={16} /> Download as ZIP
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content Editor Modal */}
      {editingContent && editingItem && (
        <ContentEditor
          content={editingItem}
          product={editingProduct || null}
          onClose={() => setEditingContent(null)}
          onDownload={() => {
            handleDownloadAll(editingItem);
            setEditingContent(null);
          }}
        />
      )}
    </div>
  );
}
