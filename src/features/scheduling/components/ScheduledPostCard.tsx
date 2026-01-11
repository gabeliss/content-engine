import { useState, useRef, useEffect } from "react";
import {
  MoreVertical,
  Edit,
  Calendar,
  Play,
  Trash2,
  AlertCircle,
  Check,
  Clock,
  Loader2,
} from "lucide-react";
import { ScheduledPost } from "../types";

interface ScheduledPostCardProps {
  post: ScheduledPost;
  onEdit: (post: ScheduledPost) => void;
  onReschedule: (post: ScheduledPost) => void;
  onPostNow: (post: ScheduledPost) => void;
  onDelete: (post: ScheduledPost) => void;
}

const statusConfig = {
  scheduled: {
    color: "#3b82f6",
    bg: "#eff6ff",
    icon: Clock,
    label: "Scheduled",
  },
  posting: {
    color: "#f59e0b",
    bg: "#fffbeb",
    icon: Loader2,
    label: "Posting...",
  },
  posted: {
    color: "#22c55e",
    bg: "#f0fdf4",
    icon: Check,
    label: "Posted",
  },
  failed: {
    color: "#ef4444",
    bg: "#fef2f2",
    icon: AlertCircle,
    label: "Failed",
  },
};

export function ScheduledPostCard({
  post,
  onEdit,
  onReschedule,
  onPostNow,
  onDelete,
}: ScheduledPostCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMenu]);

  const status = statusConfig[post.status];
  const StatusIcon = status.icon;
  const time = new Date(post.scheduledFor).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const thumbnail = post.renderedImageUrls[0];

  const menuItemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    width: "100%",
    padding: "0.625rem 0.875rem",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "0.875rem",
    textAlign: "left",
    color: "#374151",
  };

  return (
    <div
      style={{
        display: "flex",
        gap: "0.875rem",
        padding: "0.875rem",
        background: "white",
        borderRadius: "10px",
        border: "1px solid #e5e7eb",
        position: "relative",
      }}
    >
      {/* Thumbnail */}
      <div
        style={{
          width: "72px",
          height: "72px",
          borderRadius: "8px",
          overflow: "hidden",
          flexShrink: 0,
          background: "#f3f4f6",
        }}
      >
        {thumbnail && (
          <img
            src={thumbnail}
            alt="Preview"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "0.25rem",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: "0.9375rem" }}>{time}</span>
          <span
            style={{
              padding: "0.125rem 0.5rem",
              borderRadius: "4px",
              fontSize: "0.6875rem",
              fontWeight: 500,
              background: status.bg,
              color: status.color,
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
          >
            <StatusIcon
              size={11}
              className={post.status === "posting" ? "animate-spin" : ""}
            />
            {status.label}
          </span>
        </div>

        {post.title && (
          <div
            style={{
              fontSize: "0.8125rem",
              fontWeight: 500,
              marginBottom: "0.125rem",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {post.title}
          </div>
        )}

        {post.account && (
          <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
            @{post.account.username}
          </div>
        )}

        {post.status === "failed" && post.errorMessage && (
          <div
            style={{
              fontSize: "0.6875rem",
              color: "#ef4444",
              marginTop: "0.25rem",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {post.errorMessage}
          </div>
        )}
      </div>

      {/* Actions Dropdown */}
      <div style={{ position: "relative" }} ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0.25rem",
            borderRadius: "4px",
            color: "#6b7280",
          }}
        >
          <MoreVertical size={18} />
        </button>

        {showMenu && (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "100%",
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              zIndex: 10,
              minWidth: "140px",
              overflow: "hidden",
            }}
          >
            {(post.status === "scheduled" || post.status === "failed") && (
              <>
                <button
                  onClick={() => {
                    onEdit(post);
                    setShowMenu(false);
                  }}
                  style={menuItemStyle}
                >
                  <Edit size={15} /> Edit
                </button>
                <button
                  onClick={() => {
                    onReschedule(post);
                    setShowMenu(false);
                  }}
                  style={menuItemStyle}
                >
                  <Calendar size={15} /> Reschedule
                </button>
                <button
                  onClick={() => {
                    onPostNow(post);
                    setShowMenu(false);
                  }}
                  style={menuItemStyle}
                >
                  <Play size={15} /> Post Now
                </button>
              </>
            )}
            <button
              onClick={() => {
                onDelete(post);
                setShowMenu(false);
              }}
              style={{ ...menuItemStyle, color: "#ef4444" }}
            >
              <Trash2 size={15} /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
