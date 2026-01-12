import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  color: string;
  bgColor: string;
}

export function MetricCard({ icon: Icon, label, value, color, bgColor }: MetricCardProps) {
  const formattedValue = typeof value === "number" ? formatNumber(value) : value;

  return (
    <div
      style={{
        background: "white",
        borderRadius: "12px",
        padding: "1.25rem",
        border: "1px solid #e5e7eb",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      <div
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "10px",
          background: bgColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={20} color={color} />
      </div>
      <div>
        <div
          style={{
            fontSize: "1.75rem",
            fontWeight: 700,
            color: "#111827",
            lineHeight: 1.2,
          }}
        >
          {formattedValue}
        </div>
        <div
          style={{
            fontSize: "0.875rem",
            color: "#6b7280",
            marginTop: "0.25rem",
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return num.toLocaleString();
}
