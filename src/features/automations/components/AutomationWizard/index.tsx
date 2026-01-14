import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { X, ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";
import { useAutomationWizard, WizardStep, WizardData } from "../../hooks/useAutomationWizard";
import StepAccount from "./StepAccount";
import StepTheme from "./StepTheme";
import StepFormat from "./StepFormat";
import StepSchedule from "./StepSchedule";
import StepPreview from "./StepPreview";
import { Id } from "../../../../../convex/_generated/dataModel";

interface AutomationWizardProps {
  onClose: () => void;
  onCreated: () => void;
  // Edit mode props
  editMode?: boolean;
  automationId?: Id<"automations">;
  initialData?: Partial<WizardData>;
  initialPreview?: {
    contentId: Id<"content">;
    topic: string;
    caption: string;
  } | null;
}

const stepTitles: Record<WizardStep, string> = {
  account: "Account & Basics",
  theme: "Theme Configuration",
  format: "Format & Style",
  schedule: "Schedule & Settings",
  preview: "Preview & Activate",
};

const stepDescriptions: Record<WizardStep, string> = {
  account: "Select the TikTok account and name your automation",
  theme: "Define your account's niche, voice, and content guidelines",
  format: "Configure slideshow format preferences",
  schedule: "Set up your posting schedule",
  preview: "Test your configuration and activate the automation",
};

export default function AutomationWizard({
  onClose,
  onCreated,
  editMode = false,
  automationId,
  initialData,
  initialPreview,
}: AutomationWizardProps) {
  const wizard = useAutomationWizard({ initialData, editMode, automationId });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createAutomation = useMutation(api.automations.index.create);
  const updateAutomation = useMutation(api.automations.index.update);
  const activateAutomation = useMutation(api.automations.index.activate);

  const handleNext = () => {
    const validation = wizard.validateStep(wizard.currentStep);
    if (!validation.valid) {
      setError(validation.errors[0]);
      return;
    }
    setError(null);
    wizard.goNext();
  };

  const handleBack = () => {
    setError(null);
    wizard.goBack();
  };

  const handleCreate = async (activate: boolean) => {
    if (!wizard.data.accountId) {
      setError("Please select an account");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (editMode && automationId) {
        // Update existing automation
        await updateAutomation({
          id: automationId,
          name: wizard.data.name,
          themeConfig: wizard.data.themeConfig,
          formatConfig: wizard.data.formatConfig,
          scheduleConfig: wizard.data.scheduleConfig,
          postSettings: wizard.data.postSettings,
        });

        // Optionally activate if not already active
        if (activate) {
          try {
            await activateAutomation({ id: automationId });
          } catch {
            // Ignore if already active
          }
        }
      } else {
        // Create the automation
        const newAutomationId = await createAutomation({
          name: wizard.data.name,
          accountId: wizard.data.accountId,
          contentType: wizard.data.contentType,
          themeConfig: wizard.data.themeConfig,
          formatConfig: wizard.data.formatConfig,
          scheduleConfig: wizard.data.scheduleConfig,
          postSettings: wizard.data.postSettings,
        });

        // Optionally activate
        if (activate) {
          await activateAutomation({ id: newAutomationId });
        }
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : editMode ? "Failed to update automation" : "Failed to create automation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (wizard.currentStep) {
      case "account":
        return <StepAccount wizard={wizard} />;
      case "theme":
        return <StepTheme wizard={wizard} />;
      case "format":
        return <StepFormat wizard={wizard} />;
      case "schedule":
        return <StepSchedule wizard={wizard} />;
      case "preview":
        return <StepPreview wizard={wizard} onActivate={() => handleCreate(true)} initialPreview={initialPreview} />;
      default:
        return null;
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "1rem",
          width: "100%",
          maxWidth: "800px",
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.5rem",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
              {stepTitles[wizard.currentStep]}
            </h2>
            <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.875rem", color: "#6b7280" }}>
              {stepDescriptions[wizard.currentStep]}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              padding: "0.5rem",
              cursor: "pointer",
              color: "#6b7280",
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Progress */}
        <div
          style={{
            padding: "1rem 1.5rem",
            backgroundColor: "#f9fafb",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {["account", "theme", "format", "schedule", "preview"].map((step, index) => (
              <div key={step} style={{ display: "flex", alignItems: "center" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    backgroundColor:
                      index < wizard.currentStepIndex
                        ? "#10b981"
                        : index === wizard.currentStepIndex
                        ? "#3b82f6"
                        : "#e5e7eb",
                    color:
                      index <= wizard.currentStepIndex ? "#fff" : "#6b7280",
                  }}
                >
                  {index < wizard.currentStepIndex ? (
                    <Check size={16} />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < 4 && (
                  <div
                    style={{
                      width: "40px",
                      height: "2px",
                      backgroundColor:
                        index < wizard.currentStepIndex ? "#10b981" : "#e5e7eb",
                      margin: "0 0.25rem",
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "1.5rem" }}>
          {renderStep()}
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "#fef2f2",
              color: "#dc2626",
              fontSize: "0.875rem",
              borderTop: "1px solid #fecaca",
            }}
          >
            {error}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            backgroundColor: "#f9fafb",
          }}
        >
          <button
            className="btn btn-secondary"
            onClick={handleBack}
            disabled={wizard.isFirstStep}
            style={{ opacity: wizard.isFirstStep ? 0.5 : 1 }}
          >
            <ChevronLeft size={18} />
            Back
          </button>

          {wizard.isLastStep ? (
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                className="btn btn-secondary"
                onClick={() => handleCreate(false)}
                disabled={isSubmitting}
              >
                {editMode ? "Save Changes" : "Save as Draft"}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleCreate(true)}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    {editMode ? "Saving..." : "Creating..."}
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    {editMode ? "Save & Activate" : "Create & Activate"}
                  </>
                )}
              </button>
            </div>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleNext}
              disabled={!wizard.canProceed()}
            >
              Next
              <ChevronRight size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
