import { Calendar, Clock } from "lucide-react";

export default function Automations() {
  return (
    <div>
      <div className="page-header">
        <h1>Automations</h1>
        <p>Schedule and automate your content posting</p>
      </div>

      <div className="card">
        <div className="empty-state" style={{ padding: "4rem" }}>
          <Calendar size={64} style={{ opacity: 0.2, marginBottom: "1rem" }} />
          <h3>Coming soon...</h3>
          <p style={{ maxWidth: "400px", margin: "0 auto", color: "#6b7280" }}>
            Set up automated posting schedules, recurring content generation, and smart publishing rules
            to streamline your content workflow.
          </p>
        </div>
      </div>
    </div>
  );
}
