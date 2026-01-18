import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Plus, X, Lightbulb, Sparkles, Loader2 } from "lucide-react";
import { UseAutomationWizardReturn } from "../../hooks/useAutomationWizard";

interface StepContentProps {
  wizard: UseAutomationWizardReturn;
}

// Niche suggestions
const nicheSuggestions = [
  "Self-improvement / Personal Development",
  "Fitness & Health",
  "Finance & Investing",
  "Tech & Programming",
  "Productivity & Time Management",
  "Mindset & Motivation",
  "Entrepreneurship & Business",
  "Mental Health & Wellness",
];

const visualStyleOptions = [
  { value: "dark minimalist", label: "Dark Minimalist", description: "Dark backgrounds, clean aesthetic" },
  { value: "bright and colorful", label: "Bright & Colorful", description: "Vibrant colors, energetic feel" },
  { value: "warm and cozy", label: "Warm & Cozy", description: "Soft tones, inviting atmosphere" },
  { value: "modern professional", label: "Modern Professional", description: "Clean, corporate aesthetic" },
  { value: "vintage aesthetic", label: "Vintage Aesthetic", description: "Retro, nostalgic vibes" },
  { value: "nature inspired", label: "Nature Inspired", description: "Natural elements, earthy tones" },
];

const aspectRatioOptions = [
  { value: "4:5", label: "4:5", description: "Instagram/TikTok (Recommended)" },
  { value: "9:16", label: "9:16", description: "Full screen vertical" },
  { value: "1:1", label: "1:1", description: "Square format" },
] as const;

export default function StepContent({ wizard }: StepContentProps) {
  const [newExample, setNewExample] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const { themeConfig, formatConfig } = wizard.data;

  const generateTopicExamples = useAction(api.automations.generate.generateTopicExamples);

  const addExample = () => {
    if (newExample.trim()) {
      wizard.updateThemeConfig("topicExamples", [
        ...themeConfig.topicExamples,
        newExample.trim(),
      ]);
      setNewExample("");
    }
  };

  const removeExample = (index: number) => {
    wizard.updateThemeConfig(
      "topicExamples",
      themeConfig.topicExamples.filter((_, i) => i !== index)
    );
  };

  const handleGenerateExamples = async () => {
    if (!themeConfig.accountNiche.trim()) return;

    setIsGenerating(true);
    try {
      const result = await generateTopicExamples({
        accountNiche: themeConfig.accountNiche,
      });
      if (result.topics.length > 0) {
        wizard.updateThemeConfig("topicExamples", result.topics);
      }
    } catch (error) {
      console.error("Failed to generate examples:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div>
      {/* Account Niche */}
      <div style={{ marginBottom: "1.5rem" }}>
        <label
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: 500,
          }}
        >
          Account Niche <span style={{ color: "#dc2626" }}>*</span>
        </label>
        <input
          type="text"
          className="input"
          placeholder="e.g., Self-improvement / Habit Tracking"
          value={themeConfig.accountNiche}
          onChange={(e) => wizard.updateThemeConfig("accountNiche", e.target.value)}
        />
        <div style={{ marginTop: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
          {nicheSuggestions.map((niche) => (
            <button
              key={niche}
              type="button"
              onClick={() => wizard.updateThemeConfig("accountNiche", niche)}
              style={{
                padding: "0.25rem 0.5rem",
                fontSize: "0.75rem",
                backgroundColor: themeConfig.accountNiche === niche ? "#dbeafe" : "#f3f4f6",
                color: themeConfig.accountNiche === niche ? "#1d4ed8" : "#6b7280",
                border: "none",
                borderRadius: "9999px",
                cursor: "pointer",
              }}
            >
              {niche}
            </button>
          ))}
        </div>
      </div>

      {/* Topic Examples */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <label style={{ fontWeight: 500 }}>
            Topic Examples <span style={{ color: "#dc2626" }}>*</span>
            <span style={{ fontWeight: 400, color: "#6b7280", marginLeft: "0.5rem" }}>
              (minimum 3)
            </span>
          </label>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleGenerateExamples}
            disabled={!themeConfig.accountNiche.trim() || isGenerating}
            style={{ fontSize: "0.8125rem" }}
          >
            {isGenerating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Generate Examples
              </>
            )}
          </button>
        </div>
        <p style={{ marginBottom: "0.75rem", fontSize: "0.875rem", color: "#6b7280" }}>
          Add examples of topics that work well for your account, or generate some based on your niche.
          The AI will use these to generate new, unique topics with a similar style and tone.
        </p>

        {/* Example List */}
        <div style={{ marginBottom: "0.75rem" }}>
          {themeConfig.topicExamples.map((example, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 0.75rem",
                marginBottom: "0.5rem",
                backgroundColor: "#f9fafb",
                borderRadius: "0.375rem",
                border: "1px solid #e5e7eb",
              }}
            >
              <Lightbulb size={16} style={{ color: "#f59e0b", flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: "0.875rem" }}>{example}</span>
              <button
                type="button"
                onClick={() => removeExample(index)}
                style={{
                  background: "none",
                  border: "none",
                  padding: "0.25rem",
                  cursor: "pointer",
                  color: "#9ca3af",
                }}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>

        {/* Add Example Input */}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="text"
            className="input"
            placeholder="e.g., 5 habits that rewire your brain for self-discipline"
            value={newExample}
            onChange={(e) => setNewExample(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addExample();
              }
            }}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={addExample}
            disabled={!newExample.trim()}
          >
            <Plus size={16} />
            Add
          </button>
        </div>

        {themeConfig.topicExamples.length < 3 && (
          <p style={{ marginTop: "0.5rem", fontSize: "0.8125rem", color: "#dc2626" }}>
            Add at least {3 - themeConfig.topicExamples.length} more example{3 - themeConfig.topicExamples.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Visual Style */}
      <div style={{ marginBottom: "1.5rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>
          Visual Style
        </label>
        <p style={{ marginBottom: "0.75rem", fontSize: "0.875rem", color: "#6b7280" }}>
          Choose an aesthetic for the generated background images.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
          {visualStyleOptions.map((style) => (
            <div
              key={style.value}
              onClick={() => wizard.updateFormatConfig("visualStyle", style.value)}
              style={{
                padding: "0.75rem",
                border: formatConfig.visualStyle === style.value
                  ? "2px solid #3b82f6"
                  : "1px solid #e5e7eb",
                borderRadius: "0.5rem",
                cursor: "pointer",
                backgroundColor: formatConfig.visualStyle === style.value ? "#eff6ff" : "#fff",
                textAlign: "center",
              }}
            >
              <div style={{ fontWeight: 500, fontSize: "0.8125rem" }}>{style.label}</div>
              <div style={{ fontSize: "0.6875rem", color: "#6b7280", marginTop: "0.125rem" }}>
                {style.description}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "0.75rem" }}>
          <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.8125rem", color: "#6b7280" }}>
            Or enter custom style
          </label>
          <input
            type="text"
            className="input"
            placeholder="e.g., cyberpunk neon aesthetic"
            value={!visualStyleOptions.some(s => s.value === formatConfig.visualStyle) ? formatConfig.visualStyle : ""}
            onChange={(e) => wizard.updateFormatConfig("visualStyle", e.target.value)}
          />
        </div>
      </div>

      {/* Aspect Ratio */}
      <div>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>
          Aspect Ratio
        </label>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          {aspectRatioOptions.map((ratio) => (
            <div
              key={ratio.value}
              onClick={() => wizard.updateFormatConfig("aspectRatio", ratio.value)}
              style={{
                flex: 1,
                padding: "1rem",
                border: formatConfig.aspectRatio === ratio.value
                  ? "2px solid #3b82f6"
                  : "1px solid #e5e7eb",
                borderRadius: "0.5rem",
                cursor: "pointer",
                backgroundColor: formatConfig.aspectRatio === ratio.value ? "#eff6ff" : "#fff",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: ratio.value === "1:1" ? "40px" : ratio.value === "4:5" ? "32px" : "22px",
                  height: "40px",
                  backgroundColor: formatConfig.aspectRatio === ratio.value ? "#3b82f6" : "#d1d5db",
                  borderRadius: "0.25rem",
                  margin: "0 auto 0.5rem",
                }}
              />
              <div style={{ fontWeight: 500 }}>{ratio.label}</div>
              <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{ratio.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
