import { useState } from "react";
import { Plus, X, Lightbulb } from "lucide-react";
import { UseAutomationWizardReturn } from "../../hooks/useAutomationWizard";

interface StepThemeProps {
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

// Voice suggestions
const voiceSuggestions = [
  "Motivational and direct",
  "Friendly and conversational",
  "Professional and authoritative",
  "Casual and relatable",
  "Inspirational and uplifting",
];

export default function StepTheme({ wizard }: StepThemeProps) {
  const [newExample, setNewExample] = useState("");

  const { themeConfig } = wizard.data;

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

      {/* Target Audience */}
      <div style={{ marginBottom: "1.5rem" }}>
        <label
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: 500,
          }}
        >
          Target Audience
        </label>
        <input
          type="text"
          className="input"
          placeholder="e.g., Young professionals 20-35 interested in productivity"
          value={themeConfig.targetAudience}
          onChange={(e) => wizard.updateThemeConfig("targetAudience", e.target.value)}
        />
        <p style={{ marginTop: "0.25rem", fontSize: "0.8125rem", color: "#6b7280" }}>
          Describe who your content is for
        </p>
      </div>

      {/* Brand Voice */}
      <div style={{ marginBottom: "1.5rem" }}>
        <label
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: 500,
          }}
        >
          Brand Voice
        </label>
        <input
          type="text"
          className="input"
          placeholder="e.g., Motivational, direct, no-nonsense"
          value={themeConfig.brandVoice}
          onChange={(e) => wizard.updateThemeConfig("brandVoice", e.target.value)}
        />
        <div style={{ marginTop: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
          {voiceSuggestions.map((voice) => (
            <button
              key={voice}
              type="button"
              onClick={() => wizard.updateThemeConfig("brandVoice", voice)}
              style={{
                padding: "0.25rem 0.5rem",
                fontSize: "0.75rem",
                backgroundColor: themeConfig.brandVoice === voice ? "#dbeafe" : "#f3f4f6",
                color: themeConfig.brandVoice === voice ? "#1d4ed8" : "#6b7280",
                border: "none",
                borderRadius: "9999px",
                cursor: "pointer",
              }}
            >
              {voice}
            </button>
          ))}
        </div>
      </div>

      {/* Content Guidelines */}
      <div style={{ marginBottom: "1.5rem" }}>
        <label
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: 500,
          }}
        >
          Content Guidelines <span style={{ color: "#dc2626" }}>*</span>
        </label>
        <textarea
          className="textarea"
          rows={4}
          placeholder="Describe the type of content you want to create. Be specific about topics, themes, and what makes your content unique."
          value={themeConfig.contentGuidelines}
          onChange={(e) => wizard.updateThemeConfig("contentGuidelines", e.target.value)}
        />
        <p style={{ marginTop: "0.25rem", fontSize: "0.8125rem", color: "#6b7280" }}>
          The more detail you provide, the better the AI will understand your content style
        </p>
      </div>

      {/* Topic Examples */}
      <div>
        <label
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: 500,
          }}
        >
          Topic Examples <span style={{ color: "#dc2626" }}>*</span>
          <span style={{ fontWeight: 400, color: "#6b7280", marginLeft: "0.5rem" }}>
            (minimum 3)
          </span>
        </label>
        <p style={{ marginBottom: "0.75rem", fontSize: "0.875rem", color: "#6b7280" }}>
          Add examples of topics that would work well for your account. The AI will use these
          as inspiration to generate new, unique topics.
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
    </div>
  );
}
