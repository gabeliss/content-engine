import { useState, useEffect } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { UseAutomationWizardReturn } from "../../hooks/useAutomationWizard";
import { Loader2, RefreshCw, Check, AlertCircle, Sparkles, MessageSquare, Send } from "lucide-react";
import { Id } from "../../../../../convex/_generated/dataModel";
import { Slide } from "../../../slideshows/types";

interface StepPreviewProps {
  wizard: UseAutomationWizardReturn;
  onActivate?: () => void; // Kept for API compatibility but handled in parent
  initialPreview?: {
    contentId: Id<"content">;
    topic: string;
    caption: string;
  } | null;
}

// Helper to render slide text in preview thumbnail
function SlidePreviewText({ slide }: { slide: Slide }) {
  if (!slide.textElements || slide.textElements.length === 0) {
    return null;
  }

  return (
    <div style={{ textAlign: "center", width: "100%" }}>
      {slide.textElements.map((element, i) => (
        <div
          key={element.id || i}
          style={{
            fontWeight: element.fontWeight || 700,
            fontSize: element.fontSize > 40 ? "0.7rem" : "0.55rem",
            marginBottom: i < slide.textElements!.length - 1 ? "0.25rem" : 0,
          }}
        >
          {element.content.length > 50 ? element.content.slice(0, 50) + "..." : element.content}
        </div>
      ))}
    </div>
  );
}

export default function StepPreview({ wizard, initialPreview }: StepPreviewProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<{
    contentId: Id<"content">;
    topic: string;
    caption: string;
  } | null>(initialPreview || null);
  const [feedbackText, setFeedbackText] = useState("");
  const [isApplyingFeedback, setIsApplyingFeedback] = useState(false);
  const [feedbackSuggestion, setFeedbackSuggestion] = useState<{
    changes: string[];
    updatedConfig: Partial<typeof wizard.data>;
  } | null>(null);

  const previewGeneration = useAction(api.automations.generate.previewGeneration);
  const analyzeFeedback = useAction(api.automations.feedback.analyzeFeedback);
  const savePreview = useMutation(api.automations.index.savePreview);

  // Initialize from initial preview if provided
  useEffect(() => {
    if (initialPreview && !previewResult) {
      setPreviewResult(initialPreview);
    }
  }, [initialPreview]);

  // Get the generated content if we have a preview
  const previewContent = useQuery(
    api.content.get,
    previewResult?.contentId ? { id: previewResult.contentId } : "skip"
  );

  const handleGeneratePreview = async () => {
    setIsGenerating(true);
    setError(null);
    setFeedbackSuggestion(null);

    try {
      const result = await previewGeneration({
        themeConfig: wizard.data.themeConfig,
        formatConfig: wizard.data.formatConfig,
      });

      if (result.success && result.contentId) {
        const newPreview = {
          contentId: result.contentId,
          topic: result.topic || "",
          caption: result.caption || "",
        };
        setPreviewResult(newPreview);

        // Save preview to automation if in edit mode
        if (wizard.isEditing && wizard.automationId) {
          await savePreview({
            automationId: wizard.automationId,
            contentId: result.contentId,
            topic: result.topic || "",
            caption: result.caption || "",
          });
        }
      } else {
        setError(result.error || "Failed to generate preview");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate preview");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!feedbackText.trim() || !previewResult) return;

    setIsApplyingFeedback(true);
    try {
      const result = await analyzeFeedback({
        feedback: feedbackText,
        currentThemeConfig: wizard.data.themeConfig,
        currentFormatConfig: wizard.data.formatConfig,
        generatedTopic: previewResult.topic,
        generatedCaption: previewResult.caption,
      });

      if (result.success && result.suggestion) {
        // Build updated config from suggestion
        const updatedConfig: Partial<typeof wizard.data> = {};

        if (result.suggestion.themeConfig && Object.keys(result.suggestion.themeConfig).length > 0) {
          updatedConfig.themeConfig = {
            ...wizard.data.themeConfig,
            ...result.suggestion.themeConfig,
          };
        }

        if (result.suggestion.formatConfig && Object.keys(result.suggestion.formatConfig).length > 0) {
          updatedConfig.formatConfig = {
            ...wizard.data.formatConfig,
            ...result.suggestion.formatConfig,
          };
        }

        setFeedbackSuggestion({
          changes: result.suggestion.changes,
          updatedConfig,
        });
      } else {
        setError(result.error || "Failed to analyze feedback");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze feedback");
    } finally {
      setIsApplyingFeedback(false);
      setFeedbackText("");
    }
  };

  const handleApplySuggestion = () => {
    if (!feedbackSuggestion) return;

    // Apply the suggested config changes
    if (feedbackSuggestion.updatedConfig.themeConfig) {
      wizard.updateData("themeConfig", feedbackSuggestion.updatedConfig.themeConfig);
    }
    if (feedbackSuggestion.updatedConfig.formatConfig) {
      wizard.updateData("formatConfig", feedbackSuggestion.updatedConfig.formatConfig);
    }

    // Clear the suggestion and prompt for regeneration
    setFeedbackSuggestion(null);
    setPreviewResult(null);
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
            <span style={{ color: "#6b7280" }}>Visual Style:</span>{" "}
            <span style={{ fontWeight: 500 }}>{wizard.data.formatConfig.visualStyle}</span>
          </div>
          <div>
            <span style={{ color: "#6b7280" }}>Aspect Ratio:</span>{" "}
            <span style={{ fontWeight: 500 }}>{wizard.data.formatConfig.aspectRatio}</span>
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

        {previewResult && !previewContent && (
          <div
            style={{
              padding: "2rem",
              textAlign: "center",
              color: "#6b7280",
            }}
          >
            <Loader2 size={24} className="animate-spin" style={{ margin: "0 auto 0.5rem" }} />
            <p style={{ margin: 0 }}>Loading preview...</p>
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
                      <div
                        style={{
                          color: "#fff",
                          lineHeight: 1.3,
                          textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                          width: "100%",
                        }}
                      >
                        <SlidePreviewText slide={slide as Slide} />
                      </div>
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

            {/* AI Feedback Section */}
            <div style={{ marginTop: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <MessageSquare size={16} style={{ color: "#6b7280" }} />
                <label style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#6b7280" }}>
                  Not quite right? Describe what to change
                </label>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="text"
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="e.g., 'The tone is too casual' or 'I want shorter bullet points'"
                  style={{
                    flex: 1,
                    padding: "0.625rem 0.75rem",
                    border: "1px solid #e5e7eb",
                    borderRadius: "0.375rem",
                    fontSize: "0.875rem",
                  }}
                  disabled={isApplyingFeedback}
                />
                <button
                  className="btn btn-secondary"
                  onClick={handleFeedbackSubmit}
                  disabled={!feedbackText.trim() || isApplyingFeedback}
                >
                  {isApplyingFeedback ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                </button>
              </div>

              {/* Feedback Suggestion Display */}
              {feedbackSuggestion && (
                <div
                  style={{
                    marginTop: "1rem",
                    padding: "1rem",
                    backgroundColor: "#f0f9ff",
                    borderRadius: "0.5rem",
                    border: "1px solid #bae6fd",
                  }}
                >
                  <div style={{ fontWeight: 500, marginBottom: "0.5rem", color: "#0369a1" }}>
                    Suggested Changes
                  </div>
                  <ul style={{ margin: "0 0 0.75rem 0", paddingLeft: "1.25rem", fontSize: "0.875rem", color: "#0c4a6e" }}>
                    {feedbackSuggestion.changes.map((change, i) => (
                      <li key={i} style={{ marginBottom: "0.25rem" }}>{change}</li>
                    ))}
                  </ul>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleApplySuggestion}
                    >
                      Apply Changes
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setFeedbackSuggestion(null)}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
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
