// Google Gemini provider for text and image generation

// ============ TEXT GENERATION ============

export interface GeminiTextParams {
  model?: "gemini-2.0-flash" | "gemini-1.5-pro" | "gemini-1.5-flash";
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: "json_object" | "text" };
}

export interface GeminiTextResponse {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  cost: number;
}

// Gemini pricing (per 1M tokens, as of Dec 2024)
const TEXT_PRICING: Record<string, { input: number; output: number }> = {
  "gemini-2.0-flash": { input: 0.10 / 1_000_000, output: 0.40 / 1_000_000 },
  "gemini-2.0-flash-exp": { input: 0.10 / 1_000_000, output: 0.40 / 1_000_000 },
  "gemini-1.5-pro": { input: 1.25 / 1_000_000, output: 5.00 / 1_000_000 },
  "gemini-1.5-flash": { input: 0.075 / 1_000_000, output: 0.30 / 1_000_000 },
};

/**
 * Generate text using Gemini
 */
export async function generateText(
  prompt: string,
  systemPrompt?: string,
  params: GeminiTextParams = {}
): Promise<GeminiTextResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const model = params.model || "gemini-2.0-flash";

  // Build the request
  const contents = [];

  // Add system instruction if provided
  const systemInstruction = systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined;

  // Add user prompt
  contents.push({
    role: "user",
    parts: [{ text: prompt }],
  });

  const requestBody: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: params.temperature ?? 0.7,
      maxOutputTokens: params.maxTokens || 2048,
    },
  };

  if (systemInstruction) {
    requestBody.systemInstruction = systemInstruction;
  }

  // If JSON response format requested, add response mime type
  if (params.responseFormat?.type === "json_object") {
    (requestBody.generationConfig as Record<string, unknown>).responseMimeType = "application/json";
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // Extract text from response
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Extract token usage
  const usageMetadata = data.usageMetadata || {};
  const inputTokens = usageMetadata.promptTokenCount || 0;
  const outputTokens = usageMetadata.candidatesTokenCount || 0;

  // Calculate cost
  const pricing = TEXT_PRICING[model] || TEXT_PRICING["gemini-2.0-flash"];
  const cost = inputTokens * pricing.input + outputTokens * pricing.output;

  return {
    text,
    usage: { inputTokens, outputTokens },
    cost,
  };
}

// ============ IMAGE GENERATION ============

export interface GeminiImageParams {
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  numberOfImages?: number;
}

export interface GeminiImageResponse {
  images: string[]; // Base64 encoded images
  cost: number;
}

// Cost per image (as of Dec 2024)
const COST_PER_IMAGE = 0.02;

/**
 * Generate images using Gemini's native image generation
 */
export async function generateImages(
  prompt: string,
  params: GeminiImageParams = {}
): Promise<GeminiImageResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const numberOfImages = params.numberOfImages || 1;
  const images: string[] = [];

  // Generate images one at a time using Gemini Flash Image (outputs PNG)
  for (let i = 0; i < numberOfImages; i++) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    // Extract image from response
    const parts = data.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith("image/")) {
        images.push(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
        break;
      }
    }
  }

  if (images.length === 0) {
    throw new Error("No images generated by Gemini");
  }

  return {
    images,
    cost: images.length * COST_PER_IMAGE,
  };
}

/**
 * Generate a carousel slide image
 */
export async function generateCarouselImage(
  slideText: string,
  style?: string
): Promise<{ image: string; cost: number }> {
  const styleHint = style || "modern, minimal, professional";

  const prompt = `Create a high-quality image for an Instagram/TikTok carousel about: "${slideText}"

Requirements:
- Modern, professional visual that directly relates to the content
- Photography or illustration style
- Clean composition suitable for text overlay
- High contrast areas for text readability
- Engaging and eye-catching
- NO TEXT in the image
- Square 1:1 aspect ratio

Style: ${styleHint}`;

  const response = await generateImages(prompt, {
    aspectRatio: "1:1",
    numberOfImages: 1,
  });

  return {
    image: response.images[0],
    cost: response.cost,
  };
}

/**
 * Generate multiple carousel images in batch
 */
export async function generateCarouselImages(
  slideTexts: string[],
  style?: string
): Promise<{ images: string[]; cost: number }> {
  // Generate images in parallel for speed
  const results = await Promise.all(
    slideTexts.map((text) => generateCarouselImage(text, style))
  );

  return {
    images: results.map((r) => r.image),
    cost: results.reduce((sum, r) => sum + r.cost, 0),
  };
}
