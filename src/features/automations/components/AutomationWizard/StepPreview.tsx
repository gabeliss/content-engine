import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { UseAutomationWizardReturn } from "../../hooks/useAutomationWizard";
import { Loader2, RefreshCw, Check, AlertCircle, Sparkles } from "lucide-react";
import { Id } from "../../../../../convex/_generated/dataModel";

interface StepPreviewProps {
  wizard: UseAutomationWizardReturn;
  onActivate: () => void;
}

export default function StepPreview({ wizard, onActivate }: StepPreviewProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<{
    contentId: Id<"content">;
    topic: string;
    caption: string;
  } | null>(null);

  const previewGeneration = useAction(api.automations.generate.previewGeneration);

  // Get the generated content if we have a preview
  const previewContent = useQuery(
    api.content.get,
    previewResult?.contentId ? { id: previewResult.contentId } : "skip"
  );

  const handleGeneratePreview = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const result = await previewGeneration({
        themeConfig: wizard.data.themeConfig,
        formatConfig: wizard.data.formatConfig,
      });

      if (result.success && result.contentId) {
        setPreviewResult({
          contentId: result.contentId,
          topic: result.topic || "",
          caption: result.caption || "",
        });
      } else {
        setError(result.error || "Failed to generate preview");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate preview");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div>
      {/* Configuration Summary */}
      <div
        style={{
          padding: "1rem",
          backgroundColor: "#f9fafb",
          borderRadius: "0.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <h3 style={{ margin: "0 0 0.75rem 0", fontSize: "0.875rem", fontWeight: 600 }}>
          Configuration Summary
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem", fontSize: "0.8125rem" }}>
          <div>
            <span style={{ color: "#6b7280" }}>Name:</span>{" "}
            <span style={{ fontWeight: 500 }}>{wizard.data.name}</span>
          </div>
          <div>
            <span style={{ color: "#6b7280" }}>Niche:</span>{" "}
            <span style={{ fontWeight: 500 }}>{wizard.data.themeConfig.accountNiche}</span>
          </div>
          <div>
            <span style={{ color: "#6b7280" }}>Slides:</span>{" "}
            <span style={{ fontWeight: 500 }}>
              {wizard.data.formatConfig.slideCount.min}-{wizard.data.formatConfig.slideCount.max}
            </span>
          </div>
          <div>
            <span style={{ color: "#6b7280" }}>Visual Style:</span>{" "}
            <span style={{ fontWeight: 500 }}>{wizard.data.formatConfig.visualStyle}</span>
          </div>
          <div>
            <span style={{ color: "#6b7280" }}>Posts per week:</span>{" "}
            <span style={{ fontWeight: 500 }}>{wizard.data.scheduleConfig.postingTimes.length}</span>
          </div>
          <div>
            <span style={{ color: "#6b7280" }}>Topic examples:</span>{" "}
            <span style={{ fontWeight: 500 }}>{wizard.data.themeConfig.topicExamples.length}</span>
          </div>
        </div>
      </div>

      {/* Test Generation */}
      <div
        style={{
          padding: "1.5rem",
          border: "1px solid #e5e7eb",
          borderRadius: "0.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
              Test Generation
            </h3>
            <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.875rem", color: "#6b7280" }}>
              Generate a sample slideshow to verify your configuration
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleGeneratePreview}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generating...
              </>
            ) : previewResult ? (
              <>
                <RefreshCw size={16} />
                Regenerate
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Generate Preview
              </>
            )}
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: "0.75rem",
              backgroundColor: "#fef2f2",
              borderRadius: "0.375rem",
              color: "#dc2626",
              fontSize: "0.875rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {previewResult && previewContent && (
          <div style={{ marginTop: "1rem" }}>
            {/* Generated Topic */}
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.8125rem", fontWeight: 500, color: "#6b7280" }}>
                Generated Topic
              </label>
              <div style={{ fontSize: "1rem", fontWeight: 500 }}>{previewResult.topic}</div>
            </div>

            {/* Generated Caption */}
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.8125rem", fontWeight: 500, color: "#6b7280" }}>
                Generated Caption
              </label>
              <div style={{ fontSize: "0.875rem", color: "#374151" }}>{previewResult.caption}</div>
            </div>

            {/* Slide Preview */}
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.8125rem", fontWeight: 500, color: "#6b7280" }}>
                Slides ({previewContent.content?.slides?.length || 0})
              </label>
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  overflowX: "auto",
                  paddingBottom: "0.5rem",
                }}
              >
                {previewContent.content?.slides?.map((slide, index) => (
                  <div
                    key={index}
                    style={{
                      position: "relative",
                      width: "120px",
                      height: "150px",
                      borderRadius: "0.5rem",
                      overflow: "hidden",
                      flexShrink: 0,
                      backgroundColor: "#1f2937",
                    }}
                  >
                    <img
                      src={slide.imageUrl}
                      alt={`Slide ${index + 1}`}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0.5rem",
                        backgroundColor: "rgba(0, 0, 0, 0.4)",
                      }}
                    >
                      <span
                        style={{
                          color: "#fff",
                          fontSize: "0.625rem",
                          textAlign: "center",
                          lineHeight: 1.3,
                          textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                        }}
                      >
                        {slide.text}
                      </span>
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        top: "0.25rem",
                        left: "0.25rem",
                        width: "1.25rem",
                        height: "1.25rem",
                        borderRadius: "50%",
                        backgroundColor: "rgba(0, 0, 0, 0.5)",
                        color: "#fff",
                        fontSize: "0.625rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {index + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {!previewResult && !isGenerating && (
          <div
            style={{
              padding: "2rem",
              textAlign: "center",
              color: "#6b7280",
              backgroundColor: "#f9fafb",
              borderRadius: "0.5rem",
            }}
          >
            <Sparkles size={32} style={{ opacity: 0.3, marginBottom: "0.5rem" }} />
            <p style={{ margin: 0 }}>
              Click "Generate Preview" to see a sample slideshow based on your configuration
            </p>
          </div>
        )}
      </div>

      {/* Ready to Activate */}
      {previewResult && (
        <div
          style={{
            padding: "1rem",
            backgroundColor: "#f0fdf4",
            borderRadius: "0.5rem",
            border: "1px solid #bbf7d0",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <Check size={20} style={{ color: "#15803d" }} />
          <div>
            <div style={{ fontWeight: 500, color: "#15803d" }}>
              Your automation is ready!
            </div>
            <div style={{ fontSize: "0.875rem", color: "#166534" }}>
              Click "Create & Activate" to start automated posting, or "Save as Draft" to activate later.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
