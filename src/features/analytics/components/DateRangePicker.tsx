import { DateRange } from "../types";

interface DateRangePickerProps {
  value: DateRange;
  onChange: (value: DateRange) => void;
}

const options: { value: DateRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as DateRange)}
      style={{
        padding: "0.5rem 0.75rem",
        paddingRight: "2rem",
        borderRadius: "8px",
        border: "1px solid #e5e7eb",
        background: "white",
        fontSize: "0.875rem",
        color: "#374151",
        cursor: "pointer",
        appearance: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 0.5rem center",
      }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
