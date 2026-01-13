import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { UseAutomationWizardReturn } from "../../hooks/useAutomationWizard";
import { Layers } from "lucide-react";

interface StepAccountProps {
  wizard: UseAutomationWizardReturn;
}

export default function StepAccount({ wizard }: StepAccountProps) {
  const accounts = useQuery(api.accounts.list);

  const tiktokAccounts = accounts?.filter((a: { platform: string }) => a.platform === "tiktok") || [];

  return (
    <div style={{ maxWidth: "500px" }}>
      {/* Automation Name */}
      <div style={{ marginBottom: "1.5rem" }}>
        <label
          htmlFor="name"
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: 500,
          }}
        >
          Automation Name <span style={{ color: "#dc2626" }}>*</span>
        </label>
        <input
          id="name"
          type="text"
          className="input"
          placeholder="e.g., Self-Improvement Daily Posts"
          value={wizard.data.name}
          onChange={(e) => wizard.updateData("name", e.target.value)}
        />
        <p style={{ marginTop: "0.25rem", fontSize: "0.8125rem", color: "#6b7280" }}>
          Give your automation a descriptive name
        </p>
      </div>

      {/* TikTok Account Selection */}
      <div style={{ marginBottom: "1.5rem" }}>
        <label
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: 500,
          }}
        >
          TikTok Account <span style={{ color: "#dc2626" }}>*</span>
        </label>

        {tiktokAccounts.length === 0 ? (
          <div
            style={{
              padding: "2rem",
              textAlign: "center",
              backgroundColor: "#f9fafb",
              borderRadius: "0.5rem",
              border: "1px dashed #d1d5db",
            }}
          >
            <p style={{ margin: "0 0 0.5rem 0", color: "#6b7280" }}>
              No TikTok accounts connected
            </p>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "#9ca3af" }}>
              Go to Settings to connect your TikTok account first
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {tiktokAccounts.map((account) => (
              <div
                key={account._id}
                onClick={() => wizard.updateData("accountId", account._id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem 1rem",
                  border:
                    wizard.data.accountId === account._id
                      ? "2px solid #3b82f6"
                      : "1px solid #e5e7eb",
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                  backgroundColor:
                    wizard.data.accountId === account._id ? "#eff6ff" : "#fff",
                  transition: "all 0.15s ease",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    backgroundColor: "#e5e7eb",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  {account.avatarUrl ? (
                    <img
                      src={account.avatarUrl}
                      alt={account.username}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1rem",
                        color: "#6b7280",
                      }}
                    >
                      {account.username[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>
                    @{account.username}
                  </div>
                  {account.displayName && (
                    <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                      {account.displayName}
                    </div>
                  )}
                </div>
                {wizard.data.accountId === account._id && (
                  <div
                    style={{
                      width: "20px",
                      height: "20px",
                      borderRadius: "50%",
                      backgroundColor: "#3b82f6",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Content Type */}
      <div>
        <label
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: 500,
          }}
        >
          Content Type
        </label>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.75rem 1rem",
            border: "2px solid #3b82f6",
            borderRadius: "0.5rem",
            backgroundColor: "#eff6ff",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "0.5rem",
              backgroundColor: "#3b82f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
            }}
          >
            <Layers size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 500 }}>Slideshow</div>
            <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
              Multi-slide carousel posts
            </div>
          </div>
        </div>
        <p style={{ marginTop: "0.5rem", fontSize: "0.8125rem", color: "#6b7280" }}>
          More content types coming soon (Hook + Demo, AI UGC)
        </p>
      </div>
    </div>
  );
}
