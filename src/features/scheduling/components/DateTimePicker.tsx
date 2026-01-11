import { useState, useMemo, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DateTimePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  minDate?: Date;
  timezone: string;
}

export function DateTimePicker({
  value,
  onChange,
  minDate,
  timezone,
}: DateTimePickerProps) {
  const [viewDate, setViewDate] = useState(new Date(value));
  const timeListRef = useRef<HTMLDivElement>(null);

  // Generate time slots (15-minute increments)
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let min = 0; min < 60; min += 15) {
        const h = hour.toString().padStart(2, "0");
        const m = min.toString().padStart(2, "0");
        slots.push(`${h}:${m}`);
      }
    }
    return slots;
  }, []);

  // Format time for display (12-hour format)
  const formatTime12Hour = (time24: string) => {
    const [hours, minutes] = time24.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, "0")} ${period}`;
  };

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
    const newDate = new Date(value);
    newDate.setFullYear(viewDate.getFullYear());
    newDate.setMonth(viewDate.getMonth());
    newDate.setDate(day);
    onChange(newDate);
  };

  const handleTimeSelect = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const newDate = new Date(value);
    newDate.setHours(hours, minutes, 0, 0);
    onChange(newDate);
  };

  const isDateDisabled = (day: number) => {
    if (!minDate) return false;
    const checkDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    const minDateStart = new Date(minDate);
    minDateStart.setHours(0, 0, 0, 0);
    return checkDate < minDateStart;
  };

  const isTimeDisabled = (timeStr: string) => {
    if (!minDate) return false;
    const [hours, minutes] = timeStr.split(":").map(Number);
    const checkDate = new Date(value);
    checkDate.setHours(hours, minutes, 0, 0);
    return checkDate < minDate;
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      viewDate.getMonth() === today.getMonth() &&
      viewDate.getFullYear() === today.getFullYear()
    );
  };

  const selectedTime = `${value.getHours().toString().padStart(2, "0")}:${value
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;

  // Scroll to selected time on mount
  useEffect(() => {
    if (timeListRef.current) {
      const selectedButton = timeListRef.current.querySelector(
        '[data-selected="true"]'
      );
      if (selectedButton) {
        selectedButton.scrollIntoView({ block: "center", behavior: "auto" });
      }
    }
  }, []);

  const canGoPrevMonth = () => {
    if (!minDate) return true;
    const prevMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
    const minMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    return prevMonth >= minMonth;
  };

  return (
    <div style={{ display: "flex", gap: "1.5rem" }}>
      {/* Calendar */}
      <div style={{ flex: 1 }}>
        {/* Month Navigation */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "0.75rem",
          }}
        >
          <button
            type="button"
            onClick={() =>
              canGoPrevMonth() &&
              setViewDate(
                new Date(viewDate.getFullYear(), viewDate.getMonth() - 1)
              )
            }
            disabled={!canGoPrevMonth()}
            style={{
              background: "none",
              border: "none",
              cursor: canGoPrevMonth() ? "pointer" : "not-allowed",
              padding: "0.25rem",
              opacity: canGoPrevMonth() ? 1 : 0.3,
              borderRadius: "4px",
            }}
          >
            <ChevronLeft size={20} />
          </button>
          <span style={{ fontWeight: 600 }}>{monthName}</span>
          <button
            type="button"
            onClick={() =>
              setViewDate(
                new Date(viewDate.getFullYear(), viewDate.getMonth() + 1)
              )
            }
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0.25rem",
              borderRadius: "4px",
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
            gap: "2px",
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
            gap: "2px",
          }}
        >
          {/* Empty cells for days before month starts */}
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const isSelected =
              value.getDate() === day &&
              value.getMonth() === viewDate.getMonth() &&
              value.getFullYear() === viewDate.getFullYear();
            const disabled = isDateDisabled(day);
            const today = isToday(day);

            return (
              <button
                key={day}
                type="button"
                onClick={() => !disabled && handleDateSelect(day)}
                disabled={disabled}
                style={{
                  aspectRatio: "1",
                  border: today && !isSelected ? "1px solid #3b82f6" : "none",
                  borderRadius: "8px",
                  background: isSelected ? "#1f2937" : "transparent",
                  color: isSelected
                    ? "white"
                    : disabled
                      ? "#d1d5db"
                      : "#1f2937",
                  cursor: disabled ? "not-allowed" : "pointer",
                  fontWeight: isSelected || today ? 600 : 400,
                  fontSize: "0.875rem",
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time Selector */}
      <div style={{ width: "110px" }}>
        <div
          style={{
            fontSize: "0.75rem",
            color: "#6b7280",
            marginBottom: "0.5rem",
            textAlign: "center",
          }}
        >
          {timezone}
        </div>
        <div
          ref={timeListRef}
          style={{
            height: "280px",
            overflowY: "auto",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
          }}
        >
          {timeSlots.map((time) => {
            const isSelected = selectedTime === time;
            const disabled = isTimeDisabled(time);

            return (
              <button
                key={time}
                type="button"
                data-selected={isSelected}
                onClick={() => !disabled && handleTimeSelect(time)}
                disabled={disabled}
                style={{
                  width: isSelected ? "calc(100% - 8px)" : "100%",
                  padding: "0.625rem 0.5rem",
                  border: "none",
                  background: isSelected ? "#f3f4f6" : "transparent",
                  color: isSelected
                    ? "#1f2937"
                    : disabled
                      ? "#d1d5db"
                      : "#4b5563",
                  cursor: disabled ? "not-allowed" : "pointer",
                  textAlign: "center",
                  fontWeight: isSelected ? 600 : 400,
                  fontSize: "0.875rem",
                  borderRadius: isSelected ? "4px" : "0",
                  margin: isSelected ? "2px 4px" : "0",
                }}
              >
                {formatTime12Hour(time)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
