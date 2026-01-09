import { Play, Loader } from "lucide-react";
import { Id } from "../../../../convex/_generated/dataModel";
import { Product } from "../types";

interface GenerationFormProps {
  products: Product[] | undefined;
  selectedProduct: Id<"products"> | "";
  onProductChange: (productId: Id<"products"> | "") => void;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  isGenerating: boolean;
  error: string | null;
  onGenerate: () => void;
}

export function GenerationForm({
  products,
  selectedProduct,
  onProductChange,
  prompt,
  onPromptChange,
  isGenerating,
  error,
  onGenerate,
}: GenerationFormProps) {
  return (
    <div className="card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600 }}>1. Prompt</h3>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "0.75rem",
            color: "#6b7280",
          }}
        >
          <span>Product Context:</span>
          <select
            style={{
              border: "none",
              background: "transparent",
              color: "#3b82f6",
              fontWeight: 500,
              cursor: "pointer",
              fontSize: "0.75rem",
              outline: "none",
            }}
            value={selectedProduct}
            onChange={(e) => onProductChange(e.target.value as Id<"products"> | "")}
            disabled={isGenerating}
          >
            <option value="">Select product...</option>
            {products?.map((product) => (
              <option key={product._id} value={product._id}>
                {product.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <textarea
        className="textarea"
        placeholder="I want 12 slides about personal growth and habit building. The first slide should say 'WAIT. you're giving up???' written in a conversational, motivational tone using second person perspective..."
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        disabled={isGenerating}
        autoComplete="off"
        style={{
          minHeight: "300px",
          fontSize: "0.875rem",
          lineHeight: "1.6",
          marginBottom: "1rem",
        }}
      />

      <button
        className="btn btn-primary btn-lg"
        onClick={onGenerate}
        disabled={isGenerating || !prompt.trim()}
        style={{ width: "100%" }}
      >
        {isGenerating ? (
          <>
            <Loader size={18} className="spinner" />
            Generating...
          </>
        ) : (
          <>
            <Play size={18} />
            Generate
          </>
        )}
      </button>
    </div>
  );
}
