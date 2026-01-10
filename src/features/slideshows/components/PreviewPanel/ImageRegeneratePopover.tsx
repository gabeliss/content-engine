import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";

interface ImageRegeneratePopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onRegenerate: (prompt: string) => void;
  currentPrompt?: string;
  isRegenerating: boolean;
}

export function ImageRegeneratePopover({
  isOpen,
  onClose,
  onRegenerate,
  currentPrompt,
  isRegenerating,
}: ImageRegeneratePopoverProps) {
  const [prompt, setPrompt] = useState("");

  // Pre-fill with existing prompt when opening
  useEffect(() => {
    if (isOpen) {
      setPrompt(currentPrompt || "");
    }
  }, [isOpen, currentPrompt]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (prompt.trim() && !isRegenerating) {
      onRegenerate(prompt.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && prompt.trim() && !isRegenerating) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        top: "48px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "white",
        border: "2px solid #e5e7eb",
        borderRadius: "12px",
        padding: "1rem",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        zIndex: 20,
        width: "280px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.75rem",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "#1f2937" }}>
          Regenerate Image
        </span>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#6b7280",
          }}
        >
          <X size={16} />
        </button>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Describe the image you want..."
        disabled={isRegenerating}
        style={{
          width: "100%",
          minHeight: "80px",
          padding: "0.75rem",
          borderRadius: "8px",
          border: "1px solid #e5e7eb",
          fontSize: "0.875rem",
          resize: "vertical",
          fontFamily: "inherit",
          marginBottom: "0.75rem",
        }}
        autoFocus
      />

      <button
        onClick={handleSubmit}
        disabled={!prompt.trim() || isRegenerating}
        style={{
          width: "100%",
          padding: "0.625rem 1rem",
          borderRadius: "8px",
          border: "none",
          background: !prompt.trim() || isRegenerating ? "#e5e7eb" : "#3b82f6",
          color: !prompt.trim() || isRegenerating ? "#9ca3af" : "white",
          fontSize: "0.875rem",
          fontWeight: 600,
          cursor: !prompt.trim() || isRegenerating ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
        }}
      >
        {isRegenerating ? (
          <>
            <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
            Generating...
          </>
        ) : (
          "Regenerate"
        )}
      </button>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
