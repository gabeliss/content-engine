import { useState } from "react";
import { Plus, X, Clock } from "lucide-react";

interface PostingTime {
  dayOfWeek: number;
  hour: number;
  minute: number;
}

interface ScheduleBuilderProps {
  postingTimes: PostingTime[];
  onChange: (times: PostingTime[]) => void;
  timezone: string;
  onTimezoneChange: (tz: string) => void;
}

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const shortDayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Common timezones
const timezones = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Phoenix", label: "Arizona (MST)" },
  { value: "America/Anchorage", label: "Alaska Time" },
  { value: "Pacific/Honolulu", label: "Hawaii Time" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Central European Time" },
  { value: "Asia/Tokyo", label: "Japan Standard Time" },
  { value: "Asia/Shanghai", label: "China Standard Time" },
  { value: "Australia/Sydney", label: "Australian Eastern Time" },
];

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}

export default function ScheduleBuilder({
  postingTimes,
  onChange,
  timezone,
  onTimezoneChange,
}: ScheduleBuilderProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTime, setNewTime] = useState({ dayOfWeek: 1, hour: 9, minute: 0 });

  const addTime = () => {
    // Check for duplicates
    const exists = postingTimes.some(
      (t) =>
        t.dayOfWeek === newTime.dayOfWeek &&
        t.hour === newTime.hour &&
        t.minute === newTime.minute
    );

    if (!exists) {
      onChange([...postingTimes, newTime]);
    }
    setShowAddForm(false);
    setNewTime({ dayOfWeek: 1, hour: 9, minute: 0 });
  };

  const removeTime = (index: number) => {
    const updated = postingTimes.filter((_, i) => i !== index);
    onChange(updated);
  };

  // Group times by day for display
  const timesByDay = new Map<number, PostingTime[]>();
  postingTimes.forEach((time, index) => {
    const existing = timesByDay.get(time.dayOfWeek) || [];
    existing.push({ ...time, index } as PostingTime & { index: number });
    timesByDay.set(time.dayOfWeek, existing);
  });

  // Sort times within each day
  timesByDay.forEach((times, day) => {
    times.sort((a, b) => {
      if (a.hour !== b.hour) return a.hour - b.hour;
      return a.minute - b.minute;
    });
  });

  return (
    <div>
      {/* Timezone Selector */}
      <div style={{ marginBottom: "1.5rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>
          Timezone
        </label>
        <select
          className="select"
          value={timezone}
          onChange={(e) => onTimezoneChange(e.target.value)}
          style={{ maxWidth: "300px" }}
        >
          {timezones.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </div>

      {/* Weekly Schedule Grid */}
      <div style={{ marginBottom: "1rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>
          Posting Schedule
        </label>
        <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "1rem" }}>
          Select the days and times when content should be generated and posted.
        </p>
      </div>

      {/* Schedule Display */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: "0.5rem",
          overflow: "hidden",
        }}
      >
        {/* Day Headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            backgroundColor: "#f9fafb",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          {shortDayNames.map((day, i) => (
            <div
              key={day}
              style={{
                padding: "0.75rem 0.5rem",
                textAlign: "center",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#6b7280",
                borderRight: i < 6 ? "1px solid #e5e7eb" : undefined,
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Time Slots */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            minHeight: "120px",
          }}
        >
          {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
            const times = timesByDay.get(dayIndex) || [];
            return (
              <div
                key={dayIndex}
                style={{
                  padding: "0.5rem",
                  borderRight: dayIndex < 6 ? "1px solid #e5e7eb" : undefined,
                  backgroundColor: times.length > 0 ? "#f0fdf4" : undefined,
                }}
              >
                {times.map((time, idx) => {
                  const originalIndex = postingTimes.findIndex(
                    (t) =>
                      t.dayOfWeek === time.dayOfWeek &&
                      t.hour === time.hour &&
                      t.minute === time.minute
                  );
                  return (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.375rem 0.5rem",
                        marginBottom: "0.25rem",
                        backgroundColor: "#dcfce7",
                        borderRadius: "0.375rem",
                        fontSize: "0.8125rem",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <Clock size={12} />
                        {formatTime(time.hour, time.minute)}
                      </span>
                      <button
                        onClick={() => removeTime(originalIndex)}
                        style={{
                          background: "none",
                          border: "none",
                          padding: "0.125rem",
                          cursor: "pointer",
                          color: "#6b7280",
                          display: "flex",
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Time Form */}
      {showAddForm ? (
        <div
          style={{
            marginTop: "1rem",
            padding: "1rem",
            backgroundColor: "#f9fafb",
            borderRadius: "0.5rem",
            display: "flex",
            alignItems: "flex-end",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.8125rem", color: "#6b7280" }}>
              Day
            </label>
            <select
              className="select"
              value={newTime.dayOfWeek}
              onChange={(e) => setNewTime({ ...newTime, dayOfWeek: parseInt(e.target.value) })}
              style={{ minWidth: "140px" }}
            >
              {dayNames.map((day, i) => (
                <option key={day} value={i}>{day}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.8125rem", color: "#6b7280" }}>
              Hour
            </label>
            <select
              className="select"
              value={newTime.hour}
              onChange={(e) => setNewTime({ ...newTime, hour: parseInt(e.target.value) })}
              style={{ minWidth: "100px" }}
            >
              {Array.from({ length: 24 }, (_, i) => {
                const period = i >= 12 ? "PM" : "AM";
                const displayHour = i % 12 || 12;
                return (
                  <option key={i} value={i}>
                    {displayHour} {period}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.8125rem", color: "#6b7280" }}>
              Minute
            </label>
            <select
              className="select"
              value={newTime.minute}
              onChange={(e) => setNewTime({ ...newTime, minute: parseInt(e.target.value) })}
              style={{ minWidth: "80px" }}
            >
              <option value={0}>:00</option>
              <option value={15}>:15</option>
              <option value={30}>:30</option>
              <option value={45}>:45</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn btn-primary btn-sm" onClick={addTime}>
              Add
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowAddForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn btn-secondary"
          onClick={() => setShowAddForm(true)}
          style={{ marginTop: "1rem" }}
        >
          <Plus size={16} />
          Add Posting Time
        </button>
      )}

      {/* Summary */}
      {postingTimes.length > 0 && (
        <div style={{ marginTop: "1rem", fontSize: "0.875rem", color: "#6b7280" }}>
          <strong>{postingTimes.length}</strong> posting time{postingTimes.length !== 1 ? "s" : ""} per week
        </div>
      )}
    </div>
  );
}
