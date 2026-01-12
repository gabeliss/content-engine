import { ExternalLink, Clock, Loader2, Zap } from "lucide-react";
import { PostedContent } from "../types";

interface ContentTableProps {
  posts: PostedContent[];
  isLoading?: boolean;
}

export function ContentTable({ posts, isLoading }: ContentTableProps) {
  if (isLoading) {
    return (
      <div
        style={{
          padding: "3rem",
          textAlign: "center",
          color: "#6b7280",
        }}
      >
        <Loader2
          size={32}
          style={{ margin: "0 auto", animation: "spin 1s linear infinite" }}
        />
        <p style={{ marginTop: "1rem" }}>Loading posts...</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div
        style={{
          padding: "3rem",
          textAlign: "center",
          color: "#6b7280",
        }}
      >
        <Clock size={48} style={{ opacity: 0.3, margin: "0 auto" }} />
        <h3 style={{ marginTop: "1rem", color: "#374151" }}>No posts yet</h3>
        <p style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}>
          Connect a TikTok account and click Refresh to sync your videos.
        </p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "0.875rem",
        }}
      >
        <thead>
          <tr
            style={{
              borderBottom: "1px solid #e5e7eb",
              textAlign: "left",
            }}
          >
            <th style={{ ...thStyle, width: "35%" }}>Content</th>
            <th style={thStyle}>Account</th>
            <th style={thStyle}>Posted</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Views</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Likes</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Comments</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Shares</th>
            <th style={{ ...thStyle, width: "60px" }}></th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => {
            const isFromContentEngine = post.source === "content_engine";

            return (
              <tr
                key={post._id}
                style={{
                  borderBottom: "1px solid #f3f4f6",
                }}
              >
                <td style={tdStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    {post.coverImageUrl ? (
                      <img
                        src={post.coverImageUrl}
                        alt=""
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "6px",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "6px",
                          background: "#f3f4f6",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Clock size={20} color="#9ca3af" />
                      </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 500,
                          color: "#111827",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "200px",
                        }}
                      >
                        {post.title || "Untitled"}
                      </div>
                      {isFromContentEngine && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            marginTop: "0.25rem",
                          }}
                        >
                          <span
                            style={{
                              padding: "0.125rem 0.375rem",
                              borderRadius: "4px",
                              fontSize: "0.6875rem",
                              fontWeight: 500,
                              background: "#eff6ff",
                              color: "#3b82f6",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.25rem",
                            }}
                          >
                            <Zap size={10} />
                            Content Engine
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td style={tdStyle}>
                  {post.account && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {post.account.avatarUrl && (
                        <img
                          src={post.account.avatarUrl}
                          alt=""
                          style={{
                            width: "24px",
                            height: "24px",
                            borderRadius: "50%",
                          }}
                        />
                      )}
                      <span style={{ color: "#6b7280" }}>
                        @{post.account.username}
                      </span>
                    </div>
                  )}
                </td>
                <td style={tdStyle}>
                  <span style={{ color: "#6b7280" }}>
                    {formatDate(post.postedAt)}
                  </span>
                </td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 500 }}>
                  {formatNumber(post.metrics.views)}
                </td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 500 }}>
                  {formatNumber(post.metrics.likes)}
                </td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 500 }}>
                  {formatNumber(post.metrics.comments)}
                </td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 500 }}>
                  {formatNumber(post.metrics.shares)}
                </td>
                <td style={tdStyle}>
                  {post.shareUrl && (
                    <a
                      href={post.shareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "32px",
                        height: "32px",
                        borderRadius: "6px",
                        color: "#6b7280",
                        transition: "all 0.15s",
                      }}
                      title="View on TikTok"
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "0.75rem 1rem",
  fontWeight: 500,
  color: "#6b7280",
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const tdStyle: React.CSSProperties = {
  padding: "0.875rem 1rem",
  verticalAlign: "middle",
};

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return num.toLocaleString();
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
}
