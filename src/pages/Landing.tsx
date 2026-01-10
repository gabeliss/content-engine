import { SignInButton, useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { Zap, Layers, Sparkles, ArrowRight } from "lucide-react";

export default function Landing() {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#ffffff" }}>
      {/* Header */}
      <header
        style={{
          padding: "1.5rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Zap size={24} color="#3b82f6" />
          <span style={{ fontSize: "1.25rem", fontWeight: 600, color: "#111827" }}>
            Content Engine
          </span>
        </div>
        {isSignedIn ? (
          <button
            onClick={() => navigate("/dashboard")}
            style={{
              padding: "0.625rem 1.25rem",
              backgroundColor: "#111827",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            Go to Dashboard
            <ArrowRight size={16} />
          </button>
        ) : (
          <SignInButton mode="modal">
            <button
              style={{
                padding: "0.625rem 1.25rem",
                backgroundColor: "#111827",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              Sign in
              <ArrowRight size={16} />
            </button>
          </SignInButton>
        )}
      </header>

      {/* Hero */}
      <main
        style={{
          maxWidth: "800px",
          margin: "0 auto",
          padding: "6rem 2rem 4rem",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: "3.5rem",
            fontWeight: 700,
            color: "#111827",
            lineHeight: 1.1,
            marginBottom: "1.5rem",
            letterSpacing: "-0.02em",
          }}
        >
          Create stunning slideshows
          <br />
          <span style={{ color: "#3b82f6" }}>in seconds</span>
        </h1>
        <p
          style={{
            fontSize: "1.25rem",
            color: "#6b7280",
            marginBottom: "2.5rem",
            lineHeight: 1.6,
          }}
        >
          AI-powered content generation for social media carousels.
          <br />
          Just describe your idea and watch it come to life.
        </p>
        {isSignedIn ? (
          <button
            onClick={() => navigate("/dashboard")}
            style={{
              padding: "1rem 2rem",
              backgroundColor: "#3b82f6",
              color: "#ffffff",
              border: "none",
              borderRadius: "12px",
              fontSize: "1.125rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.75rem",
              boxShadow: "0 4px 14px rgba(59, 130, 246, 0.3)",
            }}
          >
            Go to Dashboard
            <ArrowRight size={20} />
          </button>
        ) : (
          <SignInButton mode="modal">
            <button
              style={{
                padding: "1rem 2rem",
                backgroundColor: "#3b82f6",
                color: "#ffffff",
                border: "none",
                borderRadius: "12px",
                fontSize: "1.125rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.75rem",
                boxShadow: "0 4px 14px rgba(59, 130, 246, 0.3)",
              }}
            >
              Get started with Google
              <ArrowRight size={20} />
            </button>
          </SignInButton>
        )}
      </main>

      {/* Features */}
      <section
        style={{
          maxWidth: "1000px",
          margin: "0 auto",
          padding: "4rem 2rem",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "2rem",
          }}
        >
          <div
            style={{
              padding: "2rem",
              backgroundColor: "#f9fafb",
              borderRadius: "16px",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                backgroundColor: "#dbeafe",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "1rem",
              }}
            >
              <Sparkles size={24} color="#3b82f6" />
            </div>
            <h3
              style={{
                fontSize: "1.125rem",
                fontWeight: 600,
                color: "#111827",
                marginBottom: "0.5rem",
              }}
            >
              AI-Generated Content
            </h3>
            <p style={{ fontSize: "0.875rem", color: "#6b7280", lineHeight: 1.6 }}>
              Describe your topic and let AI create compelling text and matching visuals.
            </p>
          </div>

          <div
            style={{
              padding: "2rem",
              backgroundColor: "#f9fafb",
              borderRadius: "16px",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                backgroundColor: "#dbeafe",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "1rem",
              }}
            >
              <Layers size={24} color="#3b82f6" />
            </div>
            <h3
              style={{
                fontSize: "1.125rem",
                fontWeight: 600,
                color: "#111827",
                marginBottom: "0.5rem",
              }}
            >
              Multiple Slides
            </h3>
            <p style={{ fontSize: "0.875rem", color: "#6b7280", lineHeight: 1.6 }}>
              Generate 3-20 slides at once. Perfect for TikTok and Instagram carousels.
            </p>
          </div>

          <div
            style={{
              padding: "2rem",
              backgroundColor: "#f9fafb",
              borderRadius: "16px",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                backgroundColor: "#dbeafe",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "1rem",
              }}
            >
              <Zap size={24} color="#3b82f6" />
            </div>
            <h3
              style={{
                fontSize: "1.125rem",
                fontWeight: 600,
                color: "#111827",
                marginBottom: "0.5rem",
              }}
            >
              Instant Export
            </h3>
            <p style={{ fontSize: "0.875rem", color: "#6b7280", lineHeight: 1.6 }}>
              Download your slideshows as images ready to post on any platform.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          padding: "2rem",
          textAlign: "center",
          color: "#9ca3af",
          fontSize: "0.875rem",
        }}
      >
        Built with Convex and Gemini AI
      </footer>
    </div>
  );
}
