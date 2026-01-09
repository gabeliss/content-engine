import { Video, Zap } from "lucide-react";

export default function HookDemo() {
  return (
    <div>
      <div className="page-header">
        <h1>Hook + Demo</h1>
        <p>Create engaging hook and demo videos</p>
      </div>

      <div className="card">
        <div className="empty-state" style={{ padding: "4rem" }}>
          <Video size={64} style={{ opacity: 0.2, marginBottom: "1rem" }} />
          <h3>Coming soon...</h3>
          <p style={{ maxWidth: "400px", margin: "0 auto", color: "#6b7280" }}>
            Generate attention-grabbing hooks paired with compelling product demos to maximize engagement
            and conversions on social media.
          </p>
        </div>
      </div>
    </div>
  );
}
