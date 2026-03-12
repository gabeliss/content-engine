import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

interface UseSlideshowGenerationOptions {
  onSuccess?: () => void;
}

export function useSlideshowGeneration(options?: UseSlideshowGenerationOptions) {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedReferenceImages, setSelectedReferenceImages] = useState<Id<"referenceImages">[]>([]);

  // Use the new agentic generation
  const generateAgentic = useAction(api.slideshows.generateAgentic.generate);

  const generate = async (productId?: Id<"products">) => {
    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Agentic generation - the AI decides everything
      const result = await generateAgentic({
        prompt: prompt.trim(),
        productId: productId || undefined,
        referenceImageIds: selectedReferenceImages.length > 0 ? selectedReferenceImages : undefined,
      });

      if (!result.success) {
        throw new Error(result.error || "Generation failed");
      }

      setPrompt("");
      options?.onSuccess?.();
    } catch (err) {
      console.error("Generation failed:", err);
      setError(err instanceof Error ? err.message : "Failed to generate slideshow");
    } finally {
      setIsGenerating(false);
    }
  };

  const clearError = () => setError(null);

  return {
    prompt,
    setPrompt,
    isGenerating,
    error,
    generate,
    clearError,
    selectedReferenceImages,
    setSelectedReferenceImages,
  };
}
