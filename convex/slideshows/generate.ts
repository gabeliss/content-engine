// Simple slideshow generation - no abstraction layers
import { action } from "../_generated/server";
import { api } from "../_generated/api";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import {
  generateText,
  generateCarouselImages,
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
    const slideCount = args.slideCount || 5;

    // Step 1: Generate text content
    const prompt = `Generate ${slideCount} engaging carousel slides about: ${args.topic}

Requirements:
- Each slide should have 1-2 short, punchy sentences (max 90 characters)
- Make them attention-grabbing and valuable
- Format as a cohesive story or tips

IMPORTANT: Return EXACTLY this JSON format (slides must be an array of strings):
{
  "slides": ["slide 1 text", "slide 2 text", "slide 3 text", ...]
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

    // Step 2: Generate images for each slide
    const imageResponse = await generateCarouselImages(slideTexts);

    // Step 3: Upload images to Convex storage
    const storageUrls = await ctx.runAction(api.storage.uploadBase64Images, {
      base64DataArray: imageResponse.images,
    });

    // Step 4: Create final slides
    const slides = slideTexts.map((text, index) => ({
      text,
      imageUrl: storageUrls[index],
    }));

    // Step 5: Save completed slideshow to DB
    const contentId = await ctx.runMutation(api.content.create, {
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
 * Regenerate a single slide's image
 */
export const regenerateSlideImage = action({
  args: {
    contentId: v.id("content"),
    slideIndex: v.number(),
    slideText: v.string(),
    style: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; imageUrl?: string; error?: string }> => {
    try {
      // Get the content item
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

      // Generate a new image for this slide
      const { generateCarouselImage } = await import("../providers/gemini");
      const result = await generateCarouselImage(
        args.slideText,
        args.style
      );

      // Upload base64 image to Convex storage and get URL
      const storageUrl = await ctx.runAction(api.storage.uploadBase64Image, {
        base64Data: result.image,
        filename: `slide-${args.slideIndex}`,
      });

      // Update the slide with new image
      await ctx.runMutation(api.content.updateSlide, {
        id: args.contentId,
        slideIndex: args.slideIndex,
        slide: {
          text: currentSlide.text,
          imageUrl: storageUrl,
          overlay: currentSlide.overlay,
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
