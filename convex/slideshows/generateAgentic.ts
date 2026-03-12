/**
 * Agentic slideshow generation
 *
 * The agent analyzes the prompt and makes ALL creative decisions:
 * - Content style (infographic vs overlay)
 * - Number of slides
 * - Visual style and color palette
 * - For each slide: text content, positioning, sizing, fonts, colors
 * - Image prompts tailored to the design decisions
 *
 * No defaults. No toggles. The agent fills out the complete schema.
 */

import { action } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { generateText, ReferenceImage } from "../providers/gemini";

// The complete slide design that the agent outputs
interface AgentSlideDesign {
  // Image generation
  imagePrompt: string;

  // Text elements - fully specified, no defaults
  textElements: Array<{
    content: string;
    position: { x: number; y: number }; // 0-100 percentage
    size: { width: number; height: number }; // 0-100 percentage
    fontSize: number; // pixels
    fontColor: string; // hex color
    fontWeight: number; // 400, 700, etc
    textAlign: "left" | "center" | "right";
  }>;

  // Display options
  overlay: boolean; // dark overlay for text readability
}

// The complete design plan that the agent creates
interface AgentDesignPlan {
  // Overall decisions
  contentStyle: "overlay" | "infographic";
  aspectRatio: "1:1" | "4:5" | "9:16";
  visualStyle: string; // e.g., "dark minimalist with blue accents"
  colorPalette: {
    primary: string;
    secondary: string;
    text: string;
    accent: string;
  };

  // Slide designs
  slides: AgentSlideDesign[];

  // Reasoning (for debugging/transparency)
  reasoning: string;
}

// Helper to generate unique IDs
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Agentic slideshow generation
 * The agent analyzes the prompt and designs the entire slideshow from scratch
 */
export const generate = action({
  args: {
    prompt: v.string(),
    referenceImageIds: v.optional(v.array(v.id("referenceImages"))),
    productId: v.optional(v.id("products")),
    accountId: v.optional(v.id("accounts")),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ contentId?: Id<"content">; success: boolean; error?: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { success: false, error: "Not authenticated" };
    }

    try {
      // Fetch reference images if provided
      let referenceImages: ReferenceImage[] = [];
      let referenceContext = "";

      if (args.referenceImageIds && args.referenceImageIds.length > 0) {
        const refImageDocs = await ctx.runQuery(internal.referenceImages.getByIds, {
          ids: args.referenceImageIds,
        });

        if (refImageDocs.length > 0) {
          const imageUrls = refImageDocs.map((r) => r.storageUrl);
          referenceImages = await ctx.runAction(api.storage.fetchReferenceImages, {
            imageUrls,
          });

          // Build context about the reference images
          referenceContext = refImageDocs
            .map((r, i) => `Reference ${i + 1}: "${r.name}" - ${r.description || "No description"}`)
            .join("\n");
        }
      }

      // Step 1: Agent designs the complete slideshow
      const designPlan = await createDesignPlan(args.prompt, referenceContext);

      // Step 2: Generate images based on the design plan
      const imageUrls = await generateImagesFromPlan(
        ctx,
        designPlan,
        referenceImages,
        referenceContext
      );

      // Step 3: Assemble final slides
      const slides = designPlan.slides.map((slide, index) => ({
        imageUrl: imageUrls[index],
        imagePrompt: slide.imagePrompt,
        textElements: slide.textElements.map((el) => ({
          id: generateId(),
          content: el.content,
          position: el.position,
          size: el.size,
          fontSize: el.fontSize,
          fontColor: el.fontColor,
          fontWeight: el.fontWeight,
          textAlign: el.textAlign,
        })),
        overlay: slide.overlay,
      }));

      // Step 4: Save to database
      const contentId = await ctx.runMutation(api.content.create, {
        userId: identity.subject,
        productId: args.productId,
        accountId: args.accountId,
        inputParams: {
          topic: args.prompt,
          slideCount: slides.length,
        },
        content: {
          type: "carousel",
          slides,
          config: {
            aspectRatio: designPlan.aspectRatio,
          },
        },
      });

      return { contentId, success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Agentic generation failed:", errorMessage);
      return { success: false, error: errorMessage };
    }
  },
});

/**
 * The agent's planning step - analyzes the prompt and creates a complete design plan
 */
async function createDesignPlan(
  prompt: string,
  referenceContext: string
): Promise<AgentDesignPlan> {
  const systemPrompt = `You are an expert content designer for social media carousels. You analyze prompts and create complete, detailed design specifications.

Your job is to make ALL creative decisions - there are no defaults. You must specify every detail of the design.`;

  const userPrompt = `Create a complete design plan for a social media carousel based on this prompt:

"${prompt}"

${referenceContext ? `\nReference images available:\n${referenceContext}\n` : ""}

You must decide EVERYTHING:

1. CONTENT STYLE - Choose one:
   - "overlay": Background images with text overlaid on top (editable text elements)
   - "infographic": Text baked into the AI-generated image (complete graphics)

   Consider: Infographic works better for educational content with diagrams/illustrations.
   Overlay works better for motivational content, quotes, lifestyle content.

2. ASPECT RATIO - Choose based on platform/content type:
   - "4:5": Best for Instagram feed, general purpose
   - "9:16": Best for TikTok, Instagram Stories, vertical content
   - "1:1": Square format, works everywhere

3. VISUAL STYLE - Describe the overall aesthetic (e.g., "dark minimalist with neon accents", "bright and cheerful with pastels")

4. COLOR PALETTE - Choose colors that work together:
   - primary: Main background/brand color (hex)
   - secondary: Supporting color (hex)
   - text: Text color (hex) - ensure contrast!
   - accent: Highlight color (hex)

5. SLIDES - Design each slide completely:
   - How many slides? (typically 3-10 based on content)
   - For EACH slide, specify:

   a) imagePrompt: What should the AI generate?
      - For "overlay" style: Describe a background image that works well WITH text on top
      - For "infographic" style: Describe the COMPLETE graphic INCLUDING the text as part of the design
      ${referenceContext ? "- Include the reference character/elements naturally in the scene" : ""}

   b) textElements: Array of text blocks (can be empty for infographic style)

      IMPORTANT RULES FOR TEXT ELEMENTS:
      - Each text element should be a COMPLETE thought (title, subtitle, heading, etc.)
      - NEVER split a single sentence/phrase across multiple text boxes
      - Title slides can have: title (required) + optional subtitle (2 elements max)
      - Content slides: 1-2 text elements max (heading + optional description)
      - Keep text concise - short punchy phrases work best

      For EACH text element:
      - content: The actual text (keep titles as ONE complete string, not split up)
      - position: { x: 0-100, y: 0-100 } - center point as percentage
      - size: { width: 0-100, height: 0-100 } - as percentage of slide
      - fontSize: pixels - USE LARGE READABLE SIZES:
        * Title slides: 48-72px (big, bold, attention-grabbing)
        * Headings: 40-56px (clear and prominent)
        * Body text: 28-40px (easily readable)
        * NEVER use sizes below 24px - text must be readable on mobile!
      - fontColor: hex color (ensure contrast! white #ffffff works on dark/busy images)
      - fontWeight: 400 (normal) or 700 (bold) - prefer 700 for headings
      - textAlign: "left", "center", or "right"

      TEXT POSITIONING GUIDELINES:
      - Title slides: ONE centered text element (y: 40-60) with the complete title
      - Content slides: Position text where it's VISIBLE and READABLE
      - Use y: 30-70 range for main content (avoid extreme top/bottom)
      - width: 70-90% for most text (give it room to breathe)
      - height: 15-30% depending on text length

   c) overlay: true/false - add dark overlay for text readability?
      (typically true for overlay style with light/busy backgrounds)

6. REASONING - Briefly explain your design decisions

Return ONLY valid JSON matching this exact structure:
{
  "contentStyle": "overlay" | "infographic",
  "aspectRatio": "1:1" | "4:5" | "9:16",
  "visualStyle": "description of visual style",
  "colorPalette": {
    "primary": "#hex",
    "secondary": "#hex",
    "text": "#hex",
    "accent": "#hex"
  },
  "slides": [
    {
      "imagePrompt": "lifestyle photo of person in relevant setting",
      "textElements": [
        {
          "content": "5 Best Ways To Improve Yourself in 2026",
          "position": { "x": 50, "y": 50 },
          "size": { "width": 85, "height": 30 },
          "fontSize": 56,
          "fontColor": "#ffffff",
          "fontWeight": 700,
          "textAlign": "center"
        }
      ],
      "overlay": true
    },
    {
      "imagePrompt": "content slide image description",
      "textElements": [
        {
          "content": "1. Prioritize Mental Health",
          "position": { "x": 50, "y": 50 },
          "size": { "width": 80, "height": 20 },
          "fontSize": 48,
          "fontColor": "#ffffff",
          "fontWeight": 700,
          "textAlign": "center"
        }
      ],
      "overlay": true
    }
  ],
  "reasoning": "explanation of design choices"
}`;

  const response = await generateText(
    userPrompt,
    systemPrompt,
    {
      model: "gemini-2.0-flash",
      responseFormat: { type: "json_object" },
      temperature: 0.7,
    }
  );

  const plan = JSON.parse(response.text) as AgentDesignPlan;

  // Validate and sanitize the plan
  return validateDesignPlan(plan);
}

/**
 * Validate and sanitize the design plan
 */
function validateDesignPlan(plan: AgentDesignPlan): AgentDesignPlan {
  // Ensure valid content style
  if (!["overlay", "infographic"].includes(plan.contentStyle)) {
    plan.contentStyle = "overlay";
  }

  // Ensure valid aspect ratio
  if (!["1:1", "4:5", "9:16"].includes(plan.aspectRatio)) {
    plan.aspectRatio = "4:5";
  }

  // Validate each slide
  plan.slides = plan.slides.map((slide) => {
    // Ensure textElements is an array
    if (!Array.isArray(slide.textElements)) {
      slide.textElements = [];
    }

    // Validate each text element
    slide.textElements = slide.textElements.map((el) => ({
      content: el.content || "",
      position: {
        x: clamp(el.position?.x ?? 50, 0, 100),
        // Clamp y position to avoid text at extreme edges (keep in 15-85 range)
        y: clamp(el.position?.y ?? 50, 15, 85),
      },
      size: {
        // Minimum width of 50% to ensure text has room
        width: clamp(el.size?.width ?? 80, 50, 100),
        height: clamp(el.size?.height ?? 20, 10, 50),
      },
      // Minimum font size of 28px to ensure readability on mobile
      fontSize: clamp(el.fontSize ?? 48, 28, 120),
      fontColor: el.fontColor || "#ffffff",
      fontWeight: [400, 500, 600, 700, 800, 900].includes(el.fontWeight) ? el.fontWeight : 700,
      textAlign: ["left", "center", "right"].includes(el.textAlign) ? el.textAlign : "center",
    }));

    // Ensure overlay is boolean
    slide.overlay = Boolean(slide.overlay);

    return slide;
  });

  return plan;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Generate images based on the design plan
 */
async function generateImagesFromPlan(
  ctx: any,
  plan: AgentDesignPlan,
  referenceImages: ReferenceImage[],
  referenceContext: string
): Promise<string[]> {
  const { generateImages } = await import("../providers/gemini");

  const hasReferences = referenceImages.length > 0;
  const isInfographic = plan.contentStyle === "infographic";

  const results = await Promise.all(
    plan.slides.map(async (slide) => {
      let prompt: string;

      if (isInfographic) {
        // Infographic mode: the image prompt already includes the complete design
        prompt = `Create a high-quality infographic image:

${slide.imagePrompt}

Style: ${plan.visualStyle}
Color palette: Primary ${plan.colorPalette.primary}, Secondary ${plan.colorPalette.secondary}, Accent ${plan.colorPalette.accent}

Requirements:
- This is an INFOGRAPHIC - text should be beautifully integrated into the design
- Use clean, readable typography
- Professional graphic design with clear visual hierarchy
- Fill the entire frame edge-to-edge
- Bold, clear text that is easy to read`;
      } else {
        // Overlay mode: generate a background suitable for text overlay
        prompt = `Create a high-quality background image:

${slide.imagePrompt}

Style: ${plan.visualStyle}

Requirements:
- Clean composition suitable for text overlay
- NO TEXT in the image
- Leave space/contrast areas where text will be placed
- Fill the entire frame edge-to-edge`;
      }

      // Add reference context if available
      if (hasReferences && referenceContext) {
        prompt += `

IMPORTANT - Maintain visual consistency with the reference image(s):
${referenceContext}`;
      }

      const response = await generateImages(prompt, {
        aspectRatio: plan.aspectRatio,
        referenceImages: hasReferences ? referenceImages : undefined,
      });

      return response.image;
    })
  );

  // Upload all images to storage
  const storageUrls = await ctx.runAction(api.storage.uploadBase64Images, {
    base64DataArray: results,
  });

  return storageUrls;
}
