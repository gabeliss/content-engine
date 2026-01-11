import { useState } from "react";
import { X, Check, AlertCircle } from "lucide-react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { Slide, ContentConfig } from "../../types";
import { renderSlidesToWebPBase64 } from "../../utils";

// TikTok icon component
function TikTokIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

// Privacy level options
type PrivacyLevel = "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY";
type PostMode = "DIRECT_POST" | "MEDIA_UPLOAD";

const privacyOptions: { value: PrivacyLevel; label: string; description: string }[] = [
  { value: "PUBLIC_TO_EVERYONE", label: "Everyone", description: "Anyone can view" },
  { value: "MUTUAL_FOLLOW_FRIENDS", label: "Friends", description: "Followers you follow back" },
  { value: "SELF_ONLY", label: "Only Me", description: "Private to you" },
];

const postModeOptions: { value: PostMode; label: string; description: string }[] = [
  { value: "DIRECT_POST", label: "Post Now", description: "Publish immediately to your profile" },
  { value: "MEDIA_UPLOAD", label: "Save as Draft", description: "Send to your TikTok inbox to edit later" },
];

interface TikTokPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  slides: Slide[];
  config?: ContentConfig;
}

export function TikTokPostModal({ isOpen, onClose, slides, config }: TikTokPostModalProps) {
  const accounts = useQuery(api.accounts.list);
  const postRenderedSlideshow = useAction(api.tiktok.postRenderedSlideshow);
  const [selectedAccount, setSelectedAccount] = useState<Id<"accounts"> | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>("PUBLIC_TO_EVERYONE");
  const [postMode, setPostMode] = useState<PostMode>("DIRECT_POST");
  const [autoAddMusic, setAutoAddMusic] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [postingStatus, setPostingStatus] = useState<string>("");
  const [postResult, setPostResult] = useState<{ success: boolean; message: string } | null>(null);

  const tiktokAccounts = accounts?.filter((a) => a.platform === "tiktok") || [];
  const slideCount = slides.length;

  const handlePost = async () => {
    if (!selectedAccount) return;

    setIsPosting(true);
    setPostResult(null);
    setPostingStatus("Rendering slides...");

    try {
      // Step 1: Render all slides to WebP base64 on the frontend
      const renderedImages = await renderSlidesToWebPBase64(slides, {
        fontSize: config?.fontSize,
        aspectRatio: config?.aspectRatio,
        textPosition: config?.textPosition,
      });

      setPostingStatus("Uploading to TikTok...");

      // Step 2: Send rendered images to backend for posting
      const result = await postRenderedSlideshow({
        accountId: selectedAccount,
        renderedImages,
        title: title || undefined,
        description: description || undefined,
        privacyLevel,
        postMode,
        autoAddMusic,
        disableComment: false,
      });

      if (result.success) {
        const successMessage =
          postMode === "MEDIA_UPLOAD"
            ? "Sent to your TikTok inbox! Check the Activity tab in the TikTok app."
            : "Posted to TikTok! It may take a few moments to appear.";
        setPostResult({
          success: true,
          message: successMessage,
        });
      } else {
        setPostResult({
          success: false,
          message: result.error || "Failed to post to TikTok",
        });
      }
    } catch (err) {
      setPostResult({
        success: false,
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsPosting(false);
      setPostingStatus("");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "500px", maxHeight: "90vh", overflow: "auto" }}
      >
        <div className="modal-header">
          <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <TikTokIcon size={20} />
            Post to TikTok
          </h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {postResult ? (
          <div style={{ padding: "1rem 0" }}>
            <div
              className={`alert ${postResult.success ? "alert-success" : "alert-error"}`}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              {postResult.success ? <Check size={18} /> : <AlertCircle size={18} />}
              {postResult.message}
            </div>
            <div className="modal-footer" style={{ marginTop: "1rem" }}>
              <button className="btn btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            {slideCount < 2 && (
              <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
                <AlertCircle size={16} />
                TikTok requires at least 2 images for a photo post. This slideshow only has{" "}
                {slideCount} slide(s).
              </div>
            )}

            {tiktokAccounts.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center" }}>
                <p style={{ color: "#6b7280", marginBottom: "1rem" }}>
                  No TikTok accounts connected. Connect your account in Settings first.
                </p>
                <a href="/settings?tab=account" className="btn btn-primary">
                  Go to Settings
                </a>
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label">Select Account</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {tiktokAccounts.map((account) => (
                      <button
                        key={account._id}
                        onClick={() => setSelectedAccount(account._id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                          padding: "0.75rem",
                          background: selectedAccount === account._id ? "#eff6ff" : "#f9fafb",
                          border:
                            selectedAccount === account._id
                              ? "2px solid #3b82f6"
                              : "1px solid #e5e7eb",
                          borderRadius: "8px",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        {account.avatarUrl ? (
                          <img
                            src={account.avatarUrl}
                            alt={account.username}
                            style={{ width: "36px", height: "36px", borderRadius: "50%" }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "50%",
                              background: "#e5e7eb",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 600,
                            }}
                          >
                            {account.username[0]?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 600 }}>
                            {account.displayName || account.username}
                          </div>
                          <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                            @{account.username}
                          </div>
                        </div>
                        {selectedAccount === account._id && (
                          <Check size={18} style={{ marginLeft: "auto", color: "#3b82f6" }} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Post Mode Selection */}
                <div className="form-group">
                  <label className="form-label">Post Mode</label>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    {postModeOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setPostMode(option.value)}
                        style={{
                          flex: 1,
                          padding: "0.75rem",
                          background: postMode === option.value ? "#eff6ff" : "#f9fafb",
                          border:
                            postMode === option.value ? "2px solid #3b82f6" : "1px solid #e5e7eb",
                          borderRadius: "8px",
                          cursor: "pointer",
                          textAlign: "center",
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{option.label}</div>
                        <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                          {option.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div className="form-group">
                  <label className="form-label">Title (optional)</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="A short title for your post"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={150}
                  />
                </div>

                {/* Description */}
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="textarea"
                    placeholder="Write a description with #hashtags and @mentions..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    maxLength={2200}
                  />
                  <div style={{ fontSize: "0.75rem", color: "#9ca3af", textAlign: "right" }}>
                    {description.length}/2200
                  </div>
                </div>

                {/* Privacy Level */}
                <div className="form-group">
                  <label className="form-label">Who can view this post</label>
                  <select
                    className="input"
                    value={privacyLevel}
                    onChange={(e) => setPrivacyLevel(e.target.value as PrivacyLevel)}
                    style={{ cursor: "pointer" }}
                  >
                    {privacyOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} - {option.description}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Auto Add Music */}
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.75rem",
                    background: "#f9fafb",
                    borderRadius: "8px",
                    cursor: "pointer",
                    marginBottom: "1rem",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>Auto-add music</div>
                    <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                      TikTok will add recommended music (you can change it later)
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoAddMusic}
                    onChange={(e) => setAutoAddMusic(e.target.checked)}
                    style={{ width: "18px", height: "18px", cursor: "pointer" }}
                  />
                </label>

                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={onClose} disabled={isPosting}>
                    Cancel
                  </button>
                  <button
                    className="btn"
                    onClick={handlePost}
                    disabled={!selectedAccount || isPosting || slideCount < 2}
                    style={{
                      background: "#fe2c55",
                      color: "white",
                      border: "none",
                      opacity: !selectedAccount || isPosting || slideCount < 2 ? 0.5 : 1,
                    }}
                  >
                    {isPosting ? (
                      <>
                        <span className="spinner" style={{ width: 16, height: 16 }} />
                        {postingStatus ||
                          (postMode === "MEDIA_UPLOAD" ? "Sending..." : "Posting...")}
                      </>
                    ) : (
                      <>
                        <TikTokIcon size={16} />
                        {postMode === "MEDIA_UPLOAD" ? "Send to Drafts" : "Post to TikTok"}
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
