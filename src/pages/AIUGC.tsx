import { Users, Sparkles } from "lucide-react";

export default function AIUGC() {
  return (
    <div>
      <div className="page-header">
        <h1>AI UGC</h1>
        <p>Generate AI-powered user-generated style content</p>
      </div>

      <div className="card">
        <div className="empty-state" style={{ padding: "4rem" }}>
          <Users size={64} style={{ opacity: 0.2, marginBottom: "1rem" }} />
          <h3>Coming soon...</h3>
          <p style={{ maxWidth: "400px", margin: "0 auto", color: "#6b7280" }}>
            Create authentic-looking user-generated content with AI. Perfect for testimonials, reviews,
            and social proof that resonates with your audience.
          </p>
        </div>
      </div>
    </div>
  );
}
