import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Play,
  Pause,
  Trash2,
  Edit,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useAutomation, useAutomations } from "../features/automations/hooks/useAutomations";
import RunHistory from "../features/automations/components/RunHistory";
import AutomationWizard from "../features/automations/components/AutomationWizard";
import { Id } from "../../convex/_generated/dataModel";
import { WizardData } from "../features/automations/hooks/useAutomationWizard";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}

function formatNextRun(timestamp: number | undefined): string {
  if (!timestamp) return "Not scheduled";

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = timestamp - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  if (diffMs < 0) return "Processing...";
  if (diffHours < 1) return `In less than 1 hour (${timeStr})`;
  if (diffDays === 0) return `Today at ${timeStr}`;
  if (diffDays === 1) return `Tomorrow at ${timeStr}`;
  return `${dateStr} at ${timeStr}`;
}

export default function AutomationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showEditWizard, setShowEditWizard] = useState(false);
  const { automation, runHistory, isLoading } = useAutomation(
    id ? (id as Id<"automations">) : null
  );
  const { activateAutomation, pauseAutomation, removeAutomation } = useAutomations();

  // Convert automation data to wizard format for editing
  const getWizardData = (): Partial<WizardData> | undefined => {
    if (!automation) return undefined;
    return {
      name: automation.name,
      accountId: automation.accountId,
      contentType: automation.contentType,
      themeConfig: automation.themeConfig,
      formatConfig: automation.formatConfig,
      scheduleConfig: automation.scheduleConfig,
      postSettings: automation.postSettings,
    };
  };

  const handleActivate = async () => {
    if (!id) return;
    try {
      await activateAutomation({ id: id as Id<"automations"> });
    } catch (error) {
      console.error("Failed to activate:", error);
    }
  };

  const handlePause = async () => {
    if (!id) return;
    try {
      await pauseAutomation({ id: id as Id<"automations"> });
    } catch (error) {
      console.error("Failed to pause:", error);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (confirm("Are you sure you want to delete this automation? This cannot be undone.")) {
      try {
        await removeAutomation({ id: id as Id<"automations"> });
        navigate("/automations");
      } catch (error) {
        console.error("Failed to delete:", error);
      }
    }
  };

  const handleViewContent = (contentId: Id<"content">) => {
    // Navigate to slideshows page with this content selected
    navigate(`/slideshows?content=${contentId}`);
  };

  if (isLoading) {
    return (
      <div style={{ padding: "3rem", textAlign: "center" }}>
        <div
          style={{
            width: "32px",
            height: "32px",
            border: "3px solid #e5e7eb",
            borderTopColor: "#3b82f6",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "0 auto",
          }}
        />
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!automation) {
    return (
      <div>
        <button
          className="btn btn-secondary"
          onClick={() => navigate("/automations")}
          style={{ marginBottom: "1rem" }}
        >
          <ArrowLeft size={18} />
          Back to Automations
        </button>
        <div className="card" style={{ padding: "3rem", textAlign: "center" }}>
          <AlertCircle size={48} style={{ color: "#dc2626", marginBottom: "1rem" }} />
          <h3>Automation not found</h3>
          <p style={{ color: "#6b7280" }}>
            This automation may have been deleted or you don't have access to it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => navigate("/automations")}
          style={{ marginBottom: "1rem" }}
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            {/* Account Avatar */}
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                backgroundColor: "#e5e7eb",
                overflow: "hidden",
              }}
            >
              {automation.account?.avatarUrl ? (
                <img
                  src={automation.account.avatarUrl}
                  alt={automation.account.username}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.5rem",
                    color: "#6b7280",
                  }}
                >
                  {automation.account?.username?.[0]?.toUpperCase() || "?"}
                </div>
              )}
            </div>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <h1 style={{ margin: 0, fontSize: "1.5rem" }}>{automation.name}</h1>
                {automation.isActive ? (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      padding: "0.25rem 0.75rem",
                      backgroundColor: "#dcfce7",
                      color: "#15803d",
                      fontSize: "0.8125rem",
                      fontWeight: 500,
                      borderRadius: "9999px",
                    }}
                  >
                    <CheckCircle2 size={14} />
                    Active
                  </span>
                ) : (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      padding: "0.25rem 0.75rem",
                      backgroundColor: "#f3f4f6",
                      color: "#6b7280",
                      fontSize: "0.8125rem",
                      fontWeight: 500,
                      borderRadius: "9999px",
                    }}
                  >
                    <Pause size={14} />
                    Paused
                  </span>
                )}
              </div>
              <p style={{ margin: "0.25rem 0 0 0", color: "#6b7280" }}>
                @{automation.account?.username} &bull; {automation.themeConfig.accountNiche}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              className="btn btn-secondary"
              onClick={() => setShowEditWizard(true)}
            >
              <Edit size={18} />
              Edit
            </button>
            {automation.isActive ? (
              <button className="btn btn-secondary" onClick={handlePause}>
                <Pause size={18} />
                Pause
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handleActivate}>
                <Play size={18} />
                Activate
              </button>
            )}
            <button
              className="btn btn-secondary"
              onClick={handleDelete}
              style={{ color: "#dc2626" }}
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 350px", gap: "1.5rem" }}>
        {/* Main Content */}
        <div>
          {/* Run History */}
          <div className="card">
            <h2 style={{ margin: "0 0 1rem 0", fontSize: "1.125rem" }}>Run History</h2>
            <RunHistory runs={runHistory || []} onViewContent={handleViewContent} />
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Next Run */}
          {automation.isActive && (
            <div className="card">
              <h3 style={{ margin: "0 0 0.75rem 0", fontSize: "0.9375rem", fontWeight: 600 }}>
                Next Run
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Clock size={18} style={{ color: "#3b82f6" }} />
                <span style={{ fontWeight: 500 }}>{formatNextRun(automation.nextRunAt)}</span>
              </div>
            </div>
          )}

          {/* Schedule */}
          <div className="card">
            <h3 style={{ margin: "0 0 0.75rem 0", fontSize: "0.9375rem", fontWeight: 600 }}>
              Schedule
            </h3>
            <div style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "0.5rem" }}>
              {automation.scheduleConfig.timezone}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              {automation.scheduleConfig.postingTimes
                .sort((a, b) => {
                  if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
                  return a.hour * 60 + a.minute - (b.hour * 60 + b.minute);
                })
                .map((time, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.375rem 0.5rem",
                      backgroundColor: "#f9fafb",
                      borderRadius: "0.25rem",
                      fontSize: "0.8125rem",
                    }}
                  >
                    <span>{dayNames[time.dayOfWeek]}</span>
                    <span style={{ fontWeight: 500 }}>{formatTime(time.hour, time.minute)}</span>
                  </div>
                ))}
            </div>
            <div style={{ marginTop: "0.75rem", fontSize: "0.8125rem", color: "#6b7280" }}>
              {automation.scheduleConfig.postingTimes.length} posts per week
            </div>
          </div>

          {/* Theme Config */}
          <div className="card">
            <h3 style={{ margin: "0 0 0.75rem 0", fontSize: "0.9375rem", fontWeight: 600 }}>
              Content Theme
            </h3>
            <div style={{ fontSize: "0.875rem" }}>
              <div style={{ marginBottom: "0.5rem" }}>
                <span style={{ color: "#6b7280" }}>Niche:</span>{" "}
                {automation.themeConfig.accountNiche}
              </div>
              {automation.themeConfig.targetAudience && (
                <div style={{ marginBottom: "0.5rem" }}>
                  <span style={{ color: "#6b7280" }}>Audience:</span>{" "}
                  {automation.themeConfig.targetAudience}
                </div>
              )}
              {automation.themeConfig.brandVoice && (
                <div style={{ marginBottom: "0.5rem" }}>
                  <span style={{ color: "#6b7280" }}>Voice:</span>{" "}
                  {automation.themeConfig.brandVoice}
                </div>
              )}
              <div style={{ marginTop: "0.75rem" }}>
                <span style={{ color: "#6b7280" }}>Examples:</span>
                <ul style={{ margin: "0.25rem 0 0 1rem", padding: 0, fontSize: "0.8125rem" }}>
                  {automation.themeConfig.topicExamples.slice(0, 3).map((example, i) => (
                    <li key={i} style={{ marginBottom: "0.25rem", color: "#374151" }}>
                      {example}
                    </li>
                  ))}
                  {automation.themeConfig.topicExamples.length > 3 && (
                    <li style={{ color: "#6b7280" }}>
                      +{automation.themeConfig.topicExamples.length - 3} more
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* Format Config */}
          <div className="card">
            <h3 style={{ margin: "0 0 0.75rem 0", fontSize: "0.9375rem", fontWeight: 600 }}>
              Format
            </h3>
            <div style={{ fontSize: "0.875rem" }}>
              <div style={{ marginBottom: "0.375rem" }}>
                <span style={{ color: "#6b7280" }}>Slides:</span>{" "}
                {automation.formatConfig.slideCount.min}-{automation.formatConfig.slideCount.max}
              </div>
              <div style={{ marginBottom: "0.375rem" }}>
                <span style={{ color: "#6b7280" }}>Style:</span>{" "}
                {automation.formatConfig.visualStyle}
              </div>
              <div>
                <span style={{ color: "#6b7280" }}>Aspect Ratio:</span>{" "}
                {automation.formatConfig.aspectRatio}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Wizard Modal */}
      {showEditWizard && (
        <AutomationWizard
          onClose={() => setShowEditWizard(false)}
          onCreated={() => setShowEditWizard(false)}
          editMode={true}
          automationId={id as Id<"automations">}
          initialData={getWizardData()}
        />
      )}
    </div>
  );
}
