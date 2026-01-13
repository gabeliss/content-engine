import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { Id } from "../../../../convex/_generated/dataModel";

interface Content {
  _id: Id<"content">;
  inputParams: {
    topic?: string;
  };
}

interface AutomationRun {
  _id: Id<"automationRuns">;
  status: "pending" | "generating" | "scheduling" | "completed" | "failed";
  scheduledFor: number;
  startedAt?: number;
  completedAt?: number;
  generatedTopic?: string;
  generatedCaption?: string;
  errorMessage?: string;
  errorStep?: string;
  createdAt: number;
  content?: Content | null;
}

interface RunHistoryProps {
  runs: AutomationRun[];
  onViewContent?: (contentId: Id<"content">) => void;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(startedAt?: number, completedAt?: number): string {
  if (!startedAt || !completedAt) return "-";
  const durationMs = completedAt - startedAt;
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function StatusBadge({ status }: { status: AutomationRun["status"] }) {
  const getStatusStyle = () => {
    switch (status) {
      case "completed":
        return {
          backgroundColor: "#dcfce7",
          color: "#15803d",
          icon: <CheckCircle2 size={14} />,
          label: "Completed",
        };
      case "failed":
        return {
          backgroundColor: "#fef2f2",
          color: "#dc2626",
          icon: <XCircle size={14} />,
          label: "Failed",
        };
      case "generating":
        return {
          backgroundColor: "#fef3c7",
          color: "#d97706",
          icon: <Loader2 size={14} className="animate-spin" />,
          label: "Generating",
        };
      case "scheduling":
        return {
          backgroundColor: "#dbeafe",
          color: "#2563eb",
          icon: <Loader2 size={14} className="animate-spin" />,
          label: "Scheduling",
        };
      case "pending":
      default:
        return {
          backgroundColor: "#f3f4f6",
          color: "#6b7280",
          icon: <Clock size={14} />,
          label: "Pending",
        };
    }
  };

  const style = getStatusStyle();

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        padding: "0.25rem 0.625rem",
        backgroundColor: style.backgroundColor,
        color: style.color,
        fontSize: "0.75rem",
        fontWeight: 500,
        borderRadius: "9999px",
      }}
    >
      {style.icon}
      {style.label}
    </span>
  );
}

function RunRow({ run, onViewContent }: { run: AutomationRun; onViewContent?: (id: Id<"content">) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        style={{ cursor: run.status === "failed" ? "pointer" : "default" }}
        onClick={() => run.status === "failed" && setExpanded(!expanded)}
      >
        <td style={{ padding: "0.75rem 1rem" }}>
          {formatDate(run.scheduledFor)}
        </td>
        <td style={{ padding: "0.75rem 1rem" }}>
          <StatusBadge status={run.status} />
        </td>
        <td style={{ padding: "0.75rem 1rem", maxWidth: "300px" }}>
          <div style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: "0.875rem",
          }}>
            {run.generatedTopic || run.content?.inputParams?.topic || "-"}
          </div>
        </td>
        <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#6b7280" }}>
          {formatDuration(run.startedAt, run.completedAt)}
        </td>
        <td style={{ padding: "0.75rem 1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {run.content && onViewContent && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewContent(run.content!._id);
                }}
                title="View content"
              >
                <ExternalLink size={14} />
              </button>
            )}
            {run.status === "failed" && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(!expanded);
                }}
              >
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
          </div>
        </td>
      </tr>
      {expanded && run.status === "failed" && (
        <tr>
          <td colSpan={5} style={{ padding: "0 1rem 1rem 1rem", backgroundColor: "#fef2f2" }}>
            <div style={{ padding: "0.75rem", borderRadius: "0.5rem", backgroundColor: "#fff", border: "1px solid #fecaca" }}>
              <div style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#dc2626", marginBottom: "0.25rem" }}>
                Error in: {run.errorStep || "Unknown step"}
              </div>
              <div style={{ fontSize: "0.875rem", color: "#7f1d1d" }}>
                {run.errorMessage || "Unknown error occurred"}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function RunHistory({ runs, onViewContent }: RunHistoryProps) {
  if (runs.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "3rem",
          color: "#6b7280",
        }}
      >
        <Clock size={48} style={{ opacity: 0.3, marginBottom: "1rem" }} />
        <p>No runs yet</p>
        <p style={{ fontSize: "0.875rem" }}>
          Runs will appear here once the automation starts executing.
        </p>
      </div>
    );
  }

  // Separate failed runs for highlighting
  const failedRuns = runs.filter(r => r.status === "failed");
  const otherRuns = runs.filter(r => r.status !== "failed");

  return (
    <div>
      {/* Failed Runs Alert */}
      {failedRuns.length > 0 && (
        <div
          style={{
            padding: "1rem",
            marginBottom: "1rem",
            backgroundColor: "#fef2f2",
            borderRadius: "0.5rem",
            border: "1px solid #fecaca",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <XCircle size={18} style={{ color: "#dc2626" }} />
            <span style={{ fontWeight: 600, color: "#dc2626" }}>
              {failedRuns.length} Recent Failed Run{failedRuns.length > 1 ? "s" : ""}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "#7f1d1d" }}>
            Some automation runs have failed. Click on a failed run below to see error details.
          </p>
        </div>
      )}

      {/* Runs Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
              <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>
                Scheduled For
              </th>
              <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>
                Status
              </th>
              <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>
                Topic
              </th>
              <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>
                Duration
              </th>
              <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <RunRow key={run._id} run={run} onViewContent={onViewContent} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
