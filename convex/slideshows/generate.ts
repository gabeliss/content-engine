// Simple slideshow generation - no abstraction layers
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import {
  generateText,
  generateCarouselImages,
  generateVisualDescriptions,
} from "../providers/gemini";

/**
 * Generate a carousel slideshow
 * Only saves to DB on success - no intermediate status tracking
 */
export const generate = action({
  args: {
    productId: v.optional(v.id("products")),
    topic: v.string(),
    slideCount: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ contentId: Id<"content">; success: boolean }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const slideCount = args.slideCount || 5;

    // Step 1: Generate text content + extract image style
    const prompt = `Generate ${slideCount} engaging carousel slides about: ${args.topic}

Requirements:
- Slide 1 (Title Slide): This is the hook slide. The text should be the main topic/title - essentially what the carousel is about. For example, if the topic is "3 habits that make you healthier", the title slide text should be "3 habits that make you healthier" or a slightly refined version of it. Keep it short, punchy, and attention-grabbing.
- Slides 2+: Each slide should have 1-2 short, punchy sentences (max 90 characters) that deliver the actual content/tips/story
- Make them attention-grabbing and valuable
- Format as a cohesive story or tips

Also extract any image style preferences from the user's prompt (e.g., "dark and minimalist", "bright and colorful", "vintage aesthetic"). If no style is specified, set imageStyle to null.

IMPORTANT: Return EXACTLY this JSON format:
{
  "slides": ["slide 1 text", "slide 2 text", "slide 3 text", ...],
  "imageStyle": "extracted style or null"
}

Each element in the "slides" array must be a single string containing all the text for that slide.`;

    const textResponse = await generateText(prompt,
      "You are a social media expert creating viral TikTok/Instagram carousels.",
      {
        model: "gemini-2.0-flash",
        responseFormat: { type: "json_object" },
      }
    );

    // Parse the response
    const parsed = JSON.parse(textResponse.text);
    const slideTexts: string[] = parsed.slides || [];
    const imageStyle: string | null = parsed.imageStyle || null;

    // Step 2: Generate visual descriptions for each slide
    const visualPlan = await generateVisualDescriptions(
      slideTexts,
      args.topic,
      imageStyle
    );

    // Step 3: Generate images using visual descriptions
    const imageResponse = await generateCarouselImages(
      visualPlan.descriptions,
      imageStyle
    );

    // Step 4: Upload images to Convex storage
    const storageUrls = await ctx.runAction(api.storage.uploadBase64Images, {
      base64DataArray: imageResponse.images,
    });

    // Step 5: Create final slides with image prompts
    const slides = slideTexts.map((text, index) => ({
      text,
      imageUrl: storageUrls[index],
      imagePrompt: visualPlan.descriptions[index],
    }));

    // Step 6: Save completed slideshow to DB
    const contentId = await ctx.runMutation(api.content.create, {
      userId: identity.subject,
      productId: args.productId,
      inputParams: {
        topic: args.topic,
        slideCount,
      },
      content: {
        type: "carousel",
        slides,
        config: {
          fontSize: 48,
          fontColor: "#FFFFFF",
          textPosition: { x: 50, y: 50 },
        },
      },
    });

    return { contentId, success: true };
  },
});

/**
 * Generate a carousel slideshow with format configuration
 * Used by automations for more control over generation parameters
 */
export const generateWithConfig = action({
  args: {
    productId: v.optional(v.id("products")),
    topic: v.string(),
    slideCount: v.optional(v.number()),
    formatConfig: v.optional(
      v.object({
        visualStyle: v.optional(v.string()),
        aspectRatio: v.optional(
          v.union(v.literal("1:1"), v.literal("4:5"), v.literal("9:16"))
        ),
        textStyle: v.optional(
          v.object({
            maxCharsPerSlide: v.optional(v.number()),
            tone: v.optional(v.string()),
          })
        ),
      })
    ),
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
      const slideCount = args.slideCount || 5;
      const visualStyle = args.formatConfig?.visualStyle;
      const aspectRatio = args.formatConfig?.aspectRatio || "4:5";
      const textStyle = args.formatConfig?.textStyle;

      // Build tone instruction
      const toneInstruction = textStyle?.tone
        ? `Write in a ${textStyle.tone} tone.`
        : "";

      // Build character limit instruction
      const charLimit = textStyle?.maxCharsPerSlide || 90;

      // Step 1: Generate text content + use provided visual style
      const prompt = `Generate ${slideCount} engaging carousel slides about: ${args.topic}

Requirements:
- Slide 1 (Title Slide): This is the hook slide. The text should be the main topic/title - essentially what the carousel is about. For example, if the topic is "3 habits that make you healthier", the title slide text should be "3 habits that make you healthier" or a slightly refined version of it. Keep it short, punchy, and attention-grabbing.
- Slides 2+: Each slide should have 1-2 short, punchy sentences (max ${charLimit} characters) that deliver the actual content/tips/story
- Make them attention-grabbing and valuable
- Format as a cohesive story or tips
${toneInstruction}

IMPORTANT: Return EXACTLY this JSON format:
{
  "slides": ["slide 1 text", "slide 2 text", "slide 3 text", ...]
}

Each element in the "slides" array must be a single string containing all the text for that slide.`;

      const textResponse = await generateText(
        prompt,
        "You are a social media expert creating viral TikTok/Instagram carousels.",
        {
          model: "gemini-2.0-flash",
          responseFormat: { type: "json_object" },
        }
      );

      // Parse the response
      const parsed = JSON.parse(textResponse.text);
      const slideTexts: string[] = parsed.slides || [];

      // Step 2: Generate visual descriptions for each slide
      const visualPlan = await generateVisualDescriptions(
        slideTexts,
        args.topic,
        visualStyle
      );

      // Step 3: Generate images using visual descriptions with aspect ratio
      const imageResponse = await generateCarouselImagesWithAspectRatio(
        visualPlan.descriptions,
        visualStyle,
        aspectRatio
      );

      // Step 4: Upload images to Convex storage
      const storageUrls = await ctx.runAction(api.storage.uploadBase64Images, {
        base64DataArray: imageResponse.images,
      });

      // Step 5: Create final slides with image prompts
      const slides = slideTexts.map((text, index) => ({
        text,
        imageUrl: storageUrls[index],
        imagePrompt: visualPlan.descriptions[index],
      }));

      // Step 6: Save completed slideshow to DB
      const contentId = await ctx.runMutation(api.content.create, {
        userId: identity.subject,
        productId: args.productId,
        inputParams: {
          topic: args.topic,
          slideCount,
        },
        content: {
          type: "carousel",
          slides,
          config: {
            fontSize: 48,
            fontColor: "#FFFFFF",
            textPosition: { x: 50, y: 50 },
            aspectRatio,
          },
        },
      });

      return { contentId, success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: errorMessage };
    }
  },
});

/**
 * Helper to generate carousel images with a specific aspect ratio
 */
async function generateCarouselImagesWithAspectRatio(
  visualDescriptions: string[],
  userStyle: string | null | undefined,
  aspectRatio: "1:1" | "4:5" | "9:16"
): Promise<{ images: string[]; cost: number }> {
  const { generateImages } = await import("../providers/gemini");

  const styleHint = userStyle || "modern, minimal, professional";

  const results = await Promise.all(
    visualDescriptions.map(async (visualDescription) => {
      const prompt = `Create a high-quality image: ${visualDescription}

Requirements:
- Clean composition suitable for text overlay
- High contrast areas for text readability
- NO TEXT in the image
- Fill the entire frame edge-to-edge, no borders, margins, or white space around the edges

Style: ${styleHint}`;

      const response = await generateImages(prompt, { aspectRatio });
      return response;
    })
  );

  return {
    images: results.map((r) => r.image),
    cost: results.reduce((sum, r) => sum + r.cost, 0),
  };
}

/**
 * Regenerate a single slide's image with a custom prompt
 */
export const regenerateSlideImage = action({
  args: {
    contentId: v.id("content"),
    slideIndex: v.number(),
    prompt: v.string(), // Custom prompt for image generation
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; imageUrl?: string; error?: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { success: false, error: "Not authenticated" };
    }

    try {
      // Get the content item (auth check is done in the query)
      const contentItem = await ctx.runQuery(api.content.get, {
        id: args.contentId,
      });

      if (!contentItem) {
        throw new Error("Content item not found");
      }

      const currentSlide = contentItem.content?.slides?.[args.slideIndex];
      if (!currentSlide) {
        throw new Error("Slide not found");
      }

      // Generate a new image for this slide using the custom prompt
      const { generateCarouselImage } = await import("../providers/gemini");
      const result = await generateCarouselImage(args.prompt);

      // Upload base64 image to Convex storage and get URL
      const storageUrl = await ctx.runAction(api.storage.uploadBase64Image, {
        base64Data: result.image,
        filename: `slide-${args.slideIndex}`,
      });

      // Delete the old image from storage (fire and forget - don't fail if this fails)
      if (currentSlide.imageUrl) {
        try {
          await ctx.runMutation(api.storage.deleteByUrl, {
            url: currentSlide.imageUrl,
          });
        } catch (e) {
          // Log but don't fail the operation if cleanup fails
          console.error("Failed to delete old image:", e);
        }
      }

      // Update the slide with new image and overwrite the image prompt
      await ctx.runMutation(api.content.updateSlide, {
        id: args.contentId,
        slideIndex: args.slideIndex,
        slide: {
          text: currentSlide.text,
          imageUrl: storageUrl,
          overlay: currentSlide.overlay,
          imagePrompt: args.prompt, // Overwrite with new prompt
        },
      });

      return { success: true, imageUrl: storageUrl };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: errorMessage };
    }
  },
});
