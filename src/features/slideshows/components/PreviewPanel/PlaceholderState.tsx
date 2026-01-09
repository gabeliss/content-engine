import { Play } from "lucide-react";

export function PlaceholderState() {
  return (
    <>
      {/* Large Carousel Placeholder */}
      <div style={{ marginBottom: "1rem", position: "relative", overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            gap: "1rem",
            height: "400px",
            transform: "translateX(calc(50% - 150px))",
          }}
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              style={{
                minWidth: "300px",
                width: "300px",
                height: "100%",
                borderRadius: "12px",
                overflow: "hidden",
                background: "#f3f4f6",
                border: "2px solid #e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: "0.5rem",
                color: "#9ca3af",
                opacity: i === 1 ? 1 : 0.6,
                transform: i === 1 ? "scale(1)" : "scale(0.95)",
              }}
            >
              <Play size={48} style={{ opacity: 0.3 }} />
              <p style={{ margin: 0, fontSize: "0.875rem" }}>Slide {i}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Placeholder Thumbnail Navigation */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          justifyContent: "center",
          marginBottom: "1rem",
        }}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              width: "112px",
              height: "112px",
              borderRadius: "8px",
              background: "#f3f4f6",
              border: i === 1 ? "2px solid #3b82f6" : "2px solid #e5e7eb",
              flexShrink: 0,
            }}
          />
        ))}
      </div>

      <p style={{ fontSize: "0.875rem", color: "#6b7280", textAlign: "center" }}>
        Generate a slideshow to see it here
      </p>
    </>
  );
}
