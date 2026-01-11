import { useState } from "react";
import { X } from "lucide-react";
import { Id } from "../../../../convex/_generated/dataModel";
import { ScheduledPost, PrivacyLevel, PostMode } from "../types";

const privacyOptions: { value: PrivacyLevel; label: string; description: string }[] = [
  { value: "PUBLIC_TO_EVERYONE", label: "Everyone", description: "Anyone can view" },
  { value: "MUTUAL_FOLLOW_FRIENDS", label: "Friends", description: "Followers you follow back" },
  { value: "SELF_ONLY", label: "Only Me", description: "Private to you" },
];

const postModeOptions: { value: PostMode; label: string; description: string }[] = [
  { value: "DIRECT_POST", label: "Post Directly", description: "Publish to your profile" },
  { value: "MEDIA_UPLOAD", label: "Send to Drafts", description: "Send to inbox for final edits" },
];

interface EditScheduledModalProps {
  post: ScheduledPost;
  onClose: () => void;
  onSave: (data: {
    id: Id<"scheduledPosts">;
    title?: string;
    description?: string;
    privacyLevel?: PrivacyLevel;
    postMode?: PostMode;
    autoAddMusic?: boolean;
  }) => Promise<void>;
}

export function EditScheduledModal({ post, onClose, onSave }: EditScheduledModalProps) {
  const [title, setTitle] = useState(post.title || "");
  const [description, setDescription] = useState(post.description || "");
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>(post.privacyLevel);
  const [postMode, setPostMode] = useState<PostMode>(post.postMode);
  const [autoAddMusic, setAutoAddMusic] = useState(post.autoAddMusic);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        id: post._id,
        title: title || undefined,
        description: description || undefined,
        privacyLevel,
        postMode,
        autoAddMusic,
      });
      onClose();
    } catch (err) {
      console.error("Error saving:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "450px" }}
      >
        <div className="modal-header">
          <h2>Edit Scheduled Post</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Post Mode */}
        <div className="form-group">
          <label className="form-label">When scheduled</label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {postModeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPostMode(option.value)}
                style={{
                  flex: 1,
                  padding: "0.625rem",
                  background: postMode === option.value ? "#eff6ff" : "#f9fafb",
                  border:
                    postMode === option.value
                      ? "2px solid #3b82f6"
                      : "1px solid #e5e7eb",
                  borderRadius: "8px",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "0.8125rem" }}>
                  {option.label}
                </div>
                <div style={{ fontSize: "0.6875rem", color: "#6b7280" }}>
                  {option.description}
                </div>
              </button>
            ))}
          </div>
        </div>

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
              TikTok will add recommended music
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
          <button className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
