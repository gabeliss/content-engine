import {
  Play,
  Pause,
  Trash2,
  Clock,
  AlertCircle,
  CheckCircle2,
  ChevronRight
} from "lucide-react";
import { Id } from "../../../../convex/_generated/dataModel";

interface AutomationRun {
  _id: Id<"automationRuns">;
  status: "pending" | "generating" | "scheduling" | "completed" | "failed";
  scheduledFor: number;
  createdAt: number;
}

interface Account {
  _id: Id<"accounts">;
  username: string;
  displayName?: string;
  avatarUrl?: string;
}

interface Automation {
  _id: Id<"automations">;
  name: string;
  description?: string;
  isActive: boolean;
  nextRunAt?: number;
  lastRunAt?: number;
  recentRuns: AutomationRun[];
  recentFailures: number;
  account: Account | null;
  themeConfig: {
    accountNiche: string;
  };
  scheduleConfig: {
    timezone: string;
    postingTimes: Array<{ dayOfWeek: number; hour: number; minute: number }>;
  };
}

interface AutomationCardProps {
  automation: Automation;
  onActivate: (id: Id<"automations">) => void;
  onPause: (id: Id<"automations">) => void;
  onDelete: (id: Id<"automations">) => void;
  onClick: (id: Id<"automations">) => void;
}

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}

function formatSchedule(scheduleConfig: Automation["scheduleConfig"]): string {
  const { postingTimes } = scheduleConfig;

  if (postingTimes.length === 0) return "No schedule";

  // Group by day
  const byDay = new Map<number, Array<{ hour: number; minute: number }>>();
  for (const time of postingTimes) {
    const existing = byDay.get(time.dayOfWeek) || [];
    existing.push({ hour: time.hour, minute: time.minute });
    byDay.set(time.dayOfWeek, existing);
  }

  const parts: string[] = [];
  for (const [day, times] of byDay) {
    const timeStrings = times.map(t => formatTime(t.hour, t.minute)).join(", ");
    parts.push(`${dayNames[day]} ${timeStrings}`);
  }

  return parts.slice(0, 2).join(" | ") + (parts.length > 2 ? ` +${parts.length - 2} more` : "");
}

function formatNextRun(timestamp: number | undefined): string {
  if (!timestamp) return "Not scheduled";

  const now = new Date();
  const diffMs = timestamp - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffMs < 0) return "Processing...";
  if (diffHours < 1) return "In less than 1 hour";
  if (diffHours < 24) return `In ${diffHours} hours`;
  if (diffDays === 1) return "Tomorrow";
  return `In ${diffDays} days`;
}

function RunStatusDot({ status }: { status: AutomationRun["status"] }) {
  const getColor = () => {
    switch (status) {
      case "completed": return "#10b981"; // green
      case "failed": return "#ef4444"; // red
      case "generating":
      case "scheduling": return "#f59e0b"; // yellow
      case "pending": return "#6b7280"; // gray
      default: return "#6b7280";
    }
  };

  return (
    <div
      style={{
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        backgroundColor: getColor(),
      }}
      title={status}
    />
  );
}

export default function AutomationCard({
  automation,
  onActivate,
  onPause,
  onDelete,
  onClick,
}: AutomationCardProps) {
  const handleActivateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onActivate(automation._id);
  };

  const handlePauseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPause(automation._id);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this automation? This cannot be undone.")) {
      onDelete(automation._id);
    }
  };

  return (
    <div
      className="card"
      onClick={() => onClick(automation._id)}
      style={{
        cursor: "pointer",
        transition: "all 0.15s ease",
        border: automation.isActive ? "1px solid #10b981" : "1px solid transparent",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
        {/* Account Avatar */}
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            backgroundColor: "#e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {automation.account?.avatarUrl ? (
            <img
              src={automation.account.avatarUrl}
              alt={automation.account.username}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span style={{ fontSize: "1.25rem", color: "#6b7280" }}>
              {automation.account?.username?.[0]?.toUpperCase() || "?"}
            </span>
          )}
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
              {automation.name}
            </h3>
            {automation.isActive ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  padding: "0.125rem 0.5rem",
                  backgroundColor: "#dcfce7",
                  color: "#15803d",
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  borderRadius: "9999px",
                }}
              >
                <CheckCircle2 size={12} />
                Active
              </span>
            ) : (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  padding: "0.125rem 0.5rem",
                  backgroundColor: "#f3f4f6",
                  color: "#6b7280",
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  borderRadius: "9999px",
                }}
              >
                <Pause size={12} />
                Paused
              </span>
            )}
            {automation.recentFailures > 0 && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  padding: "0.125rem 0.5rem",
                  backgroundColor: "#fef2f2",
                  color: "#dc2626",
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  borderRadius: "9999px",
                }}
              >
                <AlertCircle size={12} />
                {automation.recentFailures} failed
              </span>
            )}
          </div>

          <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.875rem", color: "#6b7280" }}>
            @{automation.account?.username || "Unknown"} &bull; {automation.themeConfig.accountNiche}
          </p>

          {/* Schedule Info */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.8125rem", color: "#6b7280" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <Clock size={14} />
              {formatSchedule(automation.scheduleConfig)}
            </div>
          </div>

          {/* Next Run & Recent Runs */}
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginTop: "0.75rem" }}>
            {automation.isActive && (
              <div style={{ fontSize: "0.8125rem" }}>
                <span style={{ color: "#6b7280" }}>Next run: </span>
                <span style={{ fontWeight: 500 }}>{formatNextRun(automation.nextRunAt)}</span>
              </div>
            )}

            {/* Recent Run Status Dots */}
            {automation.recentRuns.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.8125rem", color: "#6b7280" }}>Recent:</span>
                <div style={{ display: "flex", gap: "0.25rem" }}>
                  {automation.recentRuns.slice(0, 5).map((run) => (
                    <RunStatusDot key={run._id} status={run.status} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {automation.isActive ? (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handlePauseClick}
              title="Pause automation"
            >
              <Pause size={16} />
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleActivateClick}
              title="Activate automation"
            >
              <Play size={16} />
            </button>
          )}
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleDeleteClick}
            title="Delete automation"
            style={{ color: "#dc2626" }}
          >
            <Trash2 size={16} />
          </button>
          <ChevronRight size={20} style={{ color: "#9ca3af" }} />
        </div>
      </div>
    </div>
  );
}
