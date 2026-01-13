import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Calendar, AlertCircle } from "lucide-react";
import { useAutomations } from "../features/automations/hooks/useAutomations";
import AutomationCard from "../features/automations/components/AutomationCard";
import AutomationWizard from "../features/automations/components/AutomationWizard";
import { Id } from "../../convex/_generated/dataModel";

export default function Automations() {
  const navigate = useNavigate();
  const {
    automations,
    stats,
    isLoading,
    activateAutomation,
    pauseAutomation,
    removeAutomation,
  } = useAutomations();

  const [showWizard, setShowWizard] = useState(false);

  const handleActivate = async (id: Id<"automations">) => {
    try {
      await activateAutomation({ id });
    } catch (error) {
      console.error("Failed to activate automation:", error);
    }
  };

  const handlePause = async (id: Id<"automations">) => {
    try {
      await pauseAutomation({ id });
    } catch (error) {
      console.error("Failed to pause automation:", error);
    }
  };

  const handleDelete = async (id: Id<"automations">) => {
    try {
      await removeAutomation({ id });
    } catch (error) {
      console.error("Failed to delete automation:", error);
    }
  };

  const handleCardClick = (id: Id<"automations">) => {
    navigate(`/automations/${id}`);
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1>Automations</h1>
            <p>Automate your content creation and posting workflow</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowWizard(true)}>
            <Plus size={18} />
            Create Automation
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <div className="card" style={{ padding: "1rem" }}>
            <div style={{ fontSize: "0.8125rem", color: "#6b7280", marginBottom: "0.25rem" }}>
              Total Automations
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: 600 }}>{stats.total}</div>
          </div>
          <div className="card" style={{ padding: "1rem" }}>
            <div style={{ fontSize: "0.8125rem", color: "#6b7280", marginBottom: "0.25rem" }}>
              Active
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: 600, color: "#10b981" }}>
              {stats.active}
            </div>
          </div>
          <div className="card" style={{ padding: "1rem" }}>
            <div style={{ fontSize: "0.8125rem", color: "#6b7280", marginBottom: "0.25rem" }}>
              Total Runs
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: 600 }}>{stats.totalRuns}</div>
          </div>
          <div className="card" style={{ padding: "1rem" }}>
            <div style={{ fontSize: "0.8125rem", color: "#6b7280", marginBottom: "0.25rem" }}>
              Failed (24h)
            </div>
            <div
              style={{
                fontSize: "1.5rem",
                fontWeight: 600,
                color: stats.failedRuns24h > 0 ? "#dc2626" : "#6b7280",
              }}
            >
              {stats.failedRuns24h}
            </div>
          </div>
        </div>
      )}

      {/* Failed Runs Alert */}
      {stats && stats.failedRuns24h > 0 && (
        <div
          style={{
            padding: "1rem",
            marginBottom: "1.5rem",
            backgroundColor: "#fef2f2",
            borderRadius: "0.5rem",
            border: "1px solid #fecaca",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <AlertCircle size={20} style={{ color: "#dc2626" }} />
          <div>
            <div style={{ fontWeight: 500, color: "#dc2626" }}>
              {stats.failedRuns24h} automation run{stats.failedRuns24h !== 1 ? "s" : ""} failed in the last 24 hours
            </div>
            <div style={{ fontSize: "0.875rem", color: "#7f1d1d" }}>
              Click on an automation to view error details and run history.
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              border: "3px solid #e5e7eb",
              borderTopColor: "#3b82f6",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 1rem",
            }}
          />
          <p style={{ color: "#6b7280" }}>Loading automations...</p>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && automations && automations.length === 0 && (
        <div className="card">
          <div className="empty-state" style={{ padding: "4rem" }}>
            <Calendar size={64} style={{ opacity: 0.2, marginBottom: "1rem" }} />
            <h3>No automations yet</h3>
            <p style={{ maxWidth: "400px", margin: "0 auto 1.5rem", color: "#6b7280" }}>
              Create your first automation to start generating and posting content automatically.
              Configure your account theme, content style, and posting schedule.
            </p>
            <button className="btn btn-primary" onClick={() => setShowWizard(true)}>
              <Plus size={18} />
              Create Your First Automation
            </button>
          </div>
        </div>
      )}

      {/* Automation List */}
      {!isLoading && automations && automations.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {automations.map((automation) => (
            <AutomationCard
              key={automation._id}
              automation={automation}
              onActivate={handleActivate}
              onPause={handlePause}
              onDelete={handleDelete}
              onClick={handleCardClick}
            />
          ))}
        </div>
      )}

      {/* Wizard Modal */}
      {showWizard && (
        <AutomationWizard
          onClose={() => setShowWizard(false)}
          onCreated={() => setShowWizard(false)}
        />
      )}
    </div>
  );
}
