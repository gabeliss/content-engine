import { UseAutomationWizardReturn } from "../../hooks/useAutomationWizard";
import ScheduleBuilder from "../ScheduleBuilder";

interface StepScheduleProps {
  wizard: UseAutomationWizardReturn;
}

export default function StepSchedule({ wizard }: StepScheduleProps) {
  const { scheduleConfig, postSettings } = wizard.data;

  return (
    <div>
      {/* Schedule Builder */}
      <div style={{ marginBottom: "2rem" }}>
        <ScheduleBuilder
          postingTimes={scheduleConfig.postingTimes}
          onChange={(times) => wizard.updateScheduleConfig("postingTimes", times)}
          timezone={scheduleConfig.timezone}
          onTimezoneChange={(tz) => wizard.updateScheduleConfig("timezone", tz)}
        />
      </div>

      {/* Post Settings */}
      <div
        style={{
          padding: "1.5rem",
          backgroundColor: "#f9fafb",
          borderRadius: "0.5rem",
          border: "1px solid #e5e7eb",
        }}
      >
        <h3 style={{ margin: "0 0 1rem 0", fontSize: "1rem", fontWeight: 600 }}>
          Post Settings
        </h3>

        {/* Privacy Level */}
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>
            Privacy Level
          </label>
          <select
            className="select"
            value={postSettings.privacyLevel}
            onChange={(e) =>
              wizard.updatePostSettings(
                "privacyLevel",
                e.target.value as typeof postSettings.privacyLevel
              )
            }
            style={{ maxWidth: "300px" }}
          >
            <option value="PUBLIC_TO_EVERYONE">Public</option>
            <option value="MUTUAL_FOLLOW_FRIENDS">Friends Only</option>
            <option value="SELF_ONLY">Private (Only Me)</option>
          </select>
          <p style={{ marginTop: "0.25rem", fontSize: "0.8125rem", color: "#6b7280" }}>
            Who can see your automated posts
          </p>
        </div>

        {/* Auto Add Music */}
        <div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={postSettings.autoAddMusic}
              onChange={(e) => wizard.updatePostSettings("autoAddMusic", e.target.checked)}
              style={{
                width: "18px",
                height: "18px",
                accentColor: "#3b82f6",
              }}
            />
            <div>
              <div style={{ fontWeight: 500 }}>Auto-add music</div>
              <div style={{ fontSize: "0.8125rem", color: "#6b7280" }}>
                TikTok will automatically add trending music to your posts
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Schedule Summary */}
      {scheduleConfig.postingTimes.length > 0 && (
        <div
          style={{
            marginTop: "1.5rem",
            padding: "1rem",
            backgroundColor: "#f0fdf4",
            borderRadius: "0.5rem",
            border: "1px solid #bbf7d0",
          }}
        >
          <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.875rem", fontWeight: 600, color: "#15803d" }}>
            Schedule Summary
          </h4>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "#166534" }}>
            Your automation will generate and post <strong>{scheduleConfig.postingTimes.length}</strong> slideshow{scheduleConfig.postingTimes.length !== 1 ? "s" : ""} per week
            to TikTok.
          </p>
        </div>
      )}
    </div>
  );
}
