import { UseAutomationWizardReturn } from "../../hooks/useAutomationWizard";

interface StepFormatProps {
  wizard: UseAutomationWizardReturn;
}

const toneOptions = [
  { value: "punchy", label: "Punchy & Direct", description: "Short, impactful sentences" },
  { value: "casual", label: "Casual & Friendly", description: "Conversational and approachable" },
  { value: "professional", label: "Professional", description: "Authoritative and polished" },
  { value: "inspirational", label: "Inspirational", description: "Uplifting and motivating" },
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

export default function StepFormat({ wizard }: StepFormatProps) {
  const { formatConfig } = wizard.data;

  return (
    <div>
      {/* Slide Count */}
      <div style={{ marginBottom: "2rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>
          Slide Count Range
        </label>
        <p style={{ marginBottom: "0.75rem", fontSize: "0.875rem", color: "#6b7280" }}>
          The AI will generate slideshows with a random number of slides within this range.
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.8125rem", color: "#6b7280" }}>
              Minimum
            </label>
            <select
              className="select"
              value={formatConfig.slideCount.min}
              onChange={(e) =>
                wizard.updateFormatConfig("slideCount", {
                  ...formatConfig.slideCount,
                  min: parseInt(e.target.value),
                })
              }
              style={{ width: "100px" }}
            >
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n} slides</option>
              ))}
            </select>
          </div>

          <span style={{ color: "#6b7280", marginTop: "1.25rem" }}>to</span>

          <div>
            <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.8125rem", color: "#6b7280" }}>
              Maximum
            </label>
            <select
              className="select"
              value={formatConfig.slideCount.max}
              onChange={(e) =>
                wizard.updateFormatConfig("slideCount", {
                  ...formatConfig.slideCount,
                  max: parseInt(e.target.value),
                })
              }
              style={{ width: "100px" }}
            >
              {[4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>{n} slides</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Text Style */}
      <div style={{ marginBottom: "2rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>
          Text Style
        </label>

        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.8125rem", color: "#6b7280" }}>
            Tone
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem" }}>
            {toneOptions.map((tone) => (
              <div
                key={tone.value}
                onClick={() =>
                  wizard.updateFormatConfig("textStyle", {
                    ...formatConfig.textStyle,
                    tone: tone.value,
                  })
                }
                style={{
                  padding: "0.75rem",
                  border: formatConfig.textStyle.tone === tone.value
                    ? "2px solid #3b82f6"
                    : "1px solid #e5e7eb",
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                  backgroundColor: formatConfig.textStyle.tone === tone.value ? "#eff6ff" : "#fff",
                }}
              >
                <div style={{ fontWeight: 500, fontSize: "0.875rem" }}>{tone.label}</div>
                <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{tone.description}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.8125rem", color: "#6b7280" }}>
            Max Characters Per Slide
          </label>
          <select
            className="select"
            value={formatConfig.textStyle.maxCharsPerSlide}
            onChange={(e) =>
              wizard.updateFormatConfig("textStyle", {
                ...formatConfig.textStyle,
                maxCharsPerSlide: parseInt(e.target.value),
              })
            }
            style={{ width: "200px" }}
          >
            <option value={60}>60 characters (Very short)</option>
            <option value={90}>90 characters (Short)</option>
            <option value={120}>120 characters (Medium)</option>
            <option value={150}>150 characters (Longer)</option>
          </select>
        </div>
      </div>

      {/* Visual Style */}
      <div style={{ marginBottom: "2rem" }}>
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
