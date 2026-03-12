import { Play, Loader } from "lucide-react";
import { Id } from "../../../../convex/_generated/dataModel";
import { Product } from "../types";
import { ReferenceImagePicker } from "../../../components/ReferenceImagePicker";

interface GenerationFormProps {
  products: Product[] | undefined;
  selectedProduct: Id<"products"> | "";
  onProductChange: (productId: Id<"products"> | "") => void;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  isGenerating: boolean;
  error: string | null;
  onGenerate: () => void;
  selectedReferenceImages?: Id<"referenceImages">[];
  onReferenceImagesChange?: (ids: Id<"referenceImages">[]) => void;
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
  selectedReferenceImages = [],
  onReferenceImagesChange,
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
        placeholder="Describe what you want to create. The AI will design everything - layout, style, colors, text placement, and images.

Examples:
• 5 tricep exercises for bigger arms (infographic style with illustrations)
• Morning routine tips with motivational quotes
• Step-by-step guide to making perfect pasta
• 7 habits that changed my life - dark minimalist aesthetic"
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        disabled={isGenerating}
        autoComplete="off"
        style={{
          minHeight: "250px",
          fontSize: "0.875rem",
          lineHeight: "1.6",
          marginBottom: "1rem",
        }}
      />

      {onReferenceImagesChange && (
        <ReferenceImagePicker
          selectedIds={selectedReferenceImages}
          onSelectionChange={onReferenceImagesChange}
          disabled={isGenerating}
          compact
        />
      )}

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
