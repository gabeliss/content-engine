import { BarChart3, TrendingUp, Heart, MessageCircle, Share2, Eye } from "lucide-react";

export default function Analytics() {
  return (
    <div>
      <div className="page-header">
        <h1>Analytics</h1>
        <p>Track your content performance and engagement metrics</p>
      </div>

      <div className="card">
        <div className="empty-state">
          <BarChart3 size={48} style={{ opacity: 0.3, marginBottom: "1rem" }} />
          <h3>Social Media Analytics Coming Soon</h3>
          <p style={{ maxWidth: "500px", margin: "0 auto", marginTop: "0.5rem" }}>
            Track performance metrics for your posted content including views, likes, comments, shares, and engagement rates across TikTok, Instagram, and other platforms.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginTop: "2rem", maxWidth: "800px" }}>
            <div style={{ padding: "1rem", background: "#f9fafb", borderRadius: "8px", textAlign: "center" }}>
              <Eye size={24} style={{ opacity: 0.5, margin: "0 auto" }} />
              <div style={{ marginTop: "0.5rem", fontSize: "0.875rem", fontWeight: 500 }}>Views</div>
            </div>
            <div style={{ padding: "1rem", background: "#f9fafb", borderRadius: "8px", textAlign: "center" }}>
              <Heart size={24} style={{ opacity: 0.5, margin: "0 auto" }} />
              <div style={{ marginTop: "0.5rem", fontSize: "0.875rem", fontWeight: 500 }}>Likes</div>
            </div>
            <div style={{ padding: "1rem", background: "#f9fafb", borderRadius: "8px", textAlign: "center" }}>
              <MessageCircle size={24} style={{ opacity: 0.5, margin: "0 auto" }} />
              <div style={{ marginTop: "0.5rem", fontSize: "0.875rem", fontWeight: 500 }}>Comments</div>
            </div>
            <div style={{ padding: "1rem", background: "#f9fafb", borderRadius: "8px", textAlign: "center" }}>
              <Share2 size={24} style={{ opacity: 0.5, margin: "0 auto" }} />
              <div style={{ marginTop: "0.5rem", fontSize: "0.875rem", fontWeight: 500 }}>Shares</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
