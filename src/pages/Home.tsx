import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Zap, TrendingUp, Clock, DollarSign, Plus, ArrowRight } from "lucide-react";

interface HomeProps {
  onNavigate: (path: string) => void;
}

export default function Home({ onNavigate }: HomeProps) {
  const stats = useQuery(api.content.getStats);
  const products = useQuery(api.products.listActive);
  const recentContent = useQuery(api.content.list);

  return (
    <div>
      <div className="page-header">
        <h1>Home</h1>
        <p>Overview of your content generation activity</p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats?.totalGenerated || 0}</div>
          <div className="stat-label">Total Generated</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.generatedThisWeek || 0}</div>
          <div className="stat-label">This Week</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.pendingReview || 0}</div>
          <div className="stat-label">Ready to Post</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {/* Quick Actions */}
        <div className="card">
          <h2>Quick Actions</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => onNavigate("/slideshows")}
              style={{ justifyContent: "flex-start" }}
            >
              <Zap size={18} />
              Create Slideshow
            </button>
            <button
              className="btn btn-secondary btn-lg"
              onClick={() => onNavigate("/library")}
              style={{ justifyContent: "flex-start" }}
            >
              <Plus size={18} />
              View Library
            </button>
            <button
              className="btn btn-secondary btn-lg"
              onClick={() => onNavigate("/analytics")}
              style={{ justifyContent: "flex-start" }}
            >
              <DollarSign size={18} />
              View Analytics
            </button>
          </div>
        </div>

        {/* Products Overview */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ margin: 0 }}>Products</h2>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => onNavigate("/settings")}
            >
              Manage <ArrowRight size={14} />
            </button>
          </div>

          {!products || products.length === 0 ? (
            <div className="empty-state" style={{ padding: "2rem" }}>
              <p>No products yet</p>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onNavigate("/settings")}
              >
                <Plus size={14} /> Add First Product
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {products.slice(0, 4).map((product) => (
                <div
                  key={product._id}
                  style={{
                    padding: "0.75rem",
                    background: "#f9fafb",
                    borderRadius: "8px",
                  }}
                >
                  <div style={{ fontWeight: 500 }}>{product.name}</div>
                  {product.description && (
                    <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.25rem" }}>
                      {product.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Content */}
      <div className="card" style={{ marginTop: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ margin: 0 }}>Recent Content</h2>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => onNavigate("/library")}
          >
            View All <ArrowRight size={14} />
          </button>
        </div>

        {!recentContent || recentContent.length === 0 ? (
          <div className="empty-state" style={{ padding: "2rem" }}>
            <Clock size={32} style={{ opacity: 0.3, marginBottom: "0.5rem" }} />
            <p>No content generated yet</p>
            <p style={{ fontSize: "0.875rem" }}>Create a project and start generating!</p>
          </div>
        ) : (
          <div className="content-list">
            {recentContent.slice(0, 5).map((content) => (
              <div key={content._id} className="content-item">
                <div className="content-preview">
                  {content.content?.slides?.[0]?.imageUrl ? (
                    <img src={content.content.slides[0].imageUrl} alt="Preview" />
                  ) : (
                    <Zap size={24} style={{ opacity: 0.3 }} />
                  )}
                </div>
                <div className="content-details">
                  <h4>{content.inputParams?.topic || "Untitled"}</h4>
                  <div className="content-meta">
                    {content.content?.slides?.length || 0} slides •{" "}
                    {new Date(content.createdAt).toLocaleDateString()}
                  </div>
                  <span className={`badge badge-${content.status}`}>
                    {content.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
