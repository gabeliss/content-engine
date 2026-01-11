import { useState } from "react";
import { X, Calendar } from "lucide-react";
import { Id } from "../../../../convex/_generated/dataModel";
import { ScheduledPost } from "../types";
import { DateTimePicker } from "./DateTimePicker";

// Get the minimum schedulable time (current time + 20 minutes, rounded to next 15-min slot)
function getMinScheduleTime(): Date {
  const now = new Date();
  const buffer = 20;
  now.setMinutes(now.getMinutes() + buffer);
  const minutes = Math.ceil(now.getMinutes() / 15) * 15;
  now.setMinutes(minutes, 0, 0);
  return now;
}

interface RescheduleModalProps {
  post: ScheduledPost;
  onClose: () => void;
  onSave: (data: {
    id: Id<"scheduledPosts">;
    scheduledFor: number;
    timezone: string;
  }) => Promise<void>;
}

export function RescheduleModal({ post, onClose, onSave }: RescheduleModalProps) {
  const [scheduledDate, setScheduledDate] = useState<Date>(
    new Date(Math.max(post.scheduledFor, getMinScheduleTime().getTime()))
  );
  const [isSaving, setIsSaving] = useState(false);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        id: post._id,
        scheduledFor: scheduledDate.getTime(),
        timezone,
      });
      onClose();
    } catch (err) {
      console.error("Error rescheduling:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const formattedDate = scheduledDate.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const formattedTime = scheduledDate.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "480px" }}
      >
        <div className="modal-header">
          <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Calendar size={20} />
            Reschedule Post
          </h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="form-group">
          <label className="form-label">New date and time</label>
          <DateTimePicker
            value={scheduledDate}
            onChange={setScheduledDate}
            minDate={getMinScheduleTime()}
            timezone={timezone}
          />
        </div>

        <div
          style={{
            padding: "0.75rem",
            background: "#f3f4f6",
            borderRadius: "8px",
            marginBottom: "1rem",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.25rem" }}>
            Will be posted on
          </div>
          <div style={{ fontWeight: 600 }}>
            {formattedDate} at {formattedTime}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Reschedule"}
          </button>
        </div>
      </div>
    </div>
  );
}
