import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ScheduleCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  datesWithPosts: Set<string>;
}

export function ScheduleCalendar({
  selectedDate,
  onSelectDate,
  datesWithPosts,
}: ScheduleCalendarProps) {
  const [viewDate, setViewDate] = useState(new Date(selectedDate));

  // Calendar helpers
  const daysInMonth = new Date(
    viewDate.getFullYear(),
    viewDate.getMonth() + 1,
    0
  ).getDate();

  const firstDayOfMonth = new Date(
    viewDate.getFullYear(),
    viewDate.getMonth(),
    1
  ).getDay();

  const monthName = viewDate.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const handleDateSelect = (day: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    onSelectDate(newDate);
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      viewDate.getMonth() === today.getMonth() &&
      viewDate.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (day: number) => {
    return (
      day === selectedDate.getDate() &&
      viewDate.getMonth() === selectedDate.getMonth() &&
      viewDate.getFullYear() === selectedDate.getFullYear()
    );
  };

  const hasPostsOnDate = (day: number) => {
    const checkDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    return datesWithPosts.has(checkDate.toDateString());
  };

  return (
    <div>
      {/* Month Navigation */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1rem",
        }}
      >
        <button
          type="button"
          onClick={() =>
            setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1))
          }
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0.5rem",
            borderRadius: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronLeft size={20} />
        </button>
        <span style={{ fontWeight: 600, fontSize: "1rem" }}>{monthName}</span>
        <button
          type="button"
          onClick={() =>
            setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1))
          }
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0.5rem",
            borderRadius: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Day Headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "4px",
          textAlign: "center",
          marginBottom: "0.5rem",
        }}
      >
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
          <div
            key={day}
            style={{
              fontSize: "0.75rem",
              color: "#6b7280",
              fontWeight: 500,
              padding: "0.25rem",
            }}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "4px",
        }}
      >
        {/* Empty cells for days before month starts */}
        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const selected = isSelected(day);
          const today = isToday(day);
          const hasPosts = hasPostsOnDate(day);

          return (
            <button
              key={day}
              type="button"
              onClick={() => handleDateSelect(day)}
              style={{
                aspectRatio: "1",
                border: today && !selected ? "1px solid #3b82f6" : "none",
                borderRadius: "8px",
                background: selected ? "#1f2937" : "transparent",
                color: selected ? "white" : "#1f2937",
                cursor: "pointer",
                fontWeight: selected || today ? 600 : 400,
                fontSize: "0.875rem",
                transition: "background 0.15s, color 0.15s",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "2px",
              }}
            >
              {day}
              {hasPosts && (
                <div
                  style={{
                    width: "4px",
                    height: "4px",
                    borderRadius: "50%",
                    background: selected ? "white" : "#3b82f6",
                    position: "absolute",
                    bottom: "4px",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
