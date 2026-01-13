/**
 * Topic and content generation for automations
 * Handles AI-powered topic generation based on theme configuration
 */

import { action, internalAction } from "../_generated/server";
import { internal, api } from "../_generated/api";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { generateText } from "../providers/gemini";
import {
  themeConfigValidator,
  formatConfigValidator,
} from "../validators";

export interface TopicGenerationResult {
  topic: string;
  slideCount: number;
  caption: string;
}

export interface ThemeConfig {
  accountNiche: string;
  targetAudience?: string;
  brandVoice?: string;
  contentGuidelines: string;
  topicExamples: string[];
}

export interface FormatConfig {
  slideCount: { min: number; max: number };
  textStyle?: {
    maxCharsPerSlide?: number;
    tone?: string;
  };
  visualStyle?: string;
  aspectRatio: "1:1" | "4:5" | "9:16";
}

/**
 * Generate a topic for an automation run
 * This uses AI to create a fresh, unique topic based on the theme configuration
 */
export async function generateTopic(
  themeConfig: ThemeConfig,
  formatConfig: FormatConfig
): Promise<TopicGenerationResult> {
  const { accountNiche, targetAudience, brandVoice, contentGuidelines, topicExamples } = themeConfig;
  const { slideCount, textStyle } = formatConfig;

  // Build the prompt
  const examplesList = topicExamples.length > 0
    ? topicExamples.map((e, i) => `${i + 1}. ${e}`).join("\n")
    : "No examples provided.";

  const audienceSection = targetAudience
    ? `Target audience: ${targetAudience}`
    : "";

  const voiceSection = brandVoice
    ? `Brand voice: ${brandVoice}`
    : "";

  const toneSection = textStyle?.tone
    ? `Content tone: ${textStyle.tone}`
    : "";

  const prompt = `You are a content strategist for a ${accountNiche} TikTok/Instagram account.

${audienceSection}
${voiceSection}

Content guidelines:
${contentGuidelines}

Example topics that perform well for this account:
${examplesList}

${toneSection}

Generate ONE new carousel topic that:
1. Fits perfectly with the account's niche and voice
2. Follows the style and pattern of the example topics
3. Is NOT a direct copy of any example - be creative!
4. Is specific, actionable, and valuable to the audience
5. Would make viewers want to save and share
6. Has a hook that stops the scroll

The topic should work for a carousel with ${slideCount.min}-${slideCount.max} slides.

Return ONLY valid JSON in this exact format:
{
  "topic": "the complete topic/title for the carousel (this will be the hook slide text)",
  "slideCount": ${Math.floor((slideCount.min + slideCount.max) / 2)},
  "caption": "engaging TikTok caption with relevant hashtags (2-3 sentences max)"
}`;

  const response = await generateText(
    prompt,
    "You are an expert social media content strategist who creates viral, engaging carousel content.",
    {
      model: "gemini-2.0-flash",
      responseFormat: { type: "json_object" },
      temperature: 0.9, // Higher temperature for more creative variety
    }
  );

  const parsed = JSON.parse(response.text);

  // Validate and clamp slide count
  let generatedSlideCount = parsed.slideCount || Math.floor((slideCount.min + slideCount.max) / 2);
  generatedSlideCount = Math.max(slideCount.min, Math.min(slideCount.max, generatedSlideCount));

  return {
    topic: parsed.topic || "Untitled Topic",
    slideCount: generatedSlideCount,
    caption: parsed.caption || "",
  };
}

/**
 * Test topic generation - callable from the frontend for preview
 */
export const testTopicGeneration = action({
  args: {
    themeConfig: themeConfigValidator,
    formatConfig: formatConfigValidator,
  },
  handler: async (ctx, args): Promise<TopicGenerationResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    return generateTopic(args.themeConfig, args.formatConfig);
  },
});

/**
 * Generate a complete slideshow for an automation
 * This is the full pipeline: topic -> content -> save
 */
export const generateForAutomation = internalAction({
  args: {
    automationId: v.id("automations"),
    runId: v.id("automationRuns"),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    contentId?: Id<"content">;
    topic?: string;
    caption?: string;
    error?: string;
    errorStep?: string;
  }> => {
    // Get the automation
    const automation = await ctx.runQuery(internal.automations.internal.getAutomation, {
      id: args.automationId,
    });

    if (!automation) {
      return { success: false, error: "Automation not found", errorStep: "initialization" };
    }

    const { themeConfig, formatConfig } = automation;

    try {
      // Step 1: Generate topic
      await ctx.runMutation(internal.automations.internal.updateRunStatus, {
        runId: args.runId,
        status: "generating",
        startedAt: Date.now(),
      });

      const topicResult = await generateTopic(themeConfig, formatConfig);

      // Update run with generated topic
      await ctx.runMutation(internal.automations.internal.updateRunTopic, {
        runId: args.runId,
        topic: topicResult.topic,
        caption: topicResult.caption,
      });

      // Step 2: Generate slideshow content using the existing generate action
      // We call the slideshow generate action with the topic
      const generateResult = await ctx.runAction(api.slideshows.generate.generateWithConfig, {
        topic: topicResult.topic,
        slideCount: topicResult.slideCount,
        formatConfig: {
          visualStyle: formatConfig.visualStyle,
          aspectRatio: formatConfig.aspectRatio,
          textStyle: formatConfig.textStyle,
        },
      });

      if (!generateResult.success || !generateResult.contentId) {
        return {
          success: false,
          error: "Failed to generate slideshow content",
          errorStep: "content_generation",
        };
      }

      // Update run status to scheduling
      await ctx.runMutation(internal.automations.internal.updateRunStatus, {
        runId: args.runId,
        status: "scheduling",
      });

      // Step 3: The content is created, but we don't schedule immediately
      // The post will be created when the scheduled time arrives
      // For now, we just mark the run as complete with the content

      await ctx.runMutation(internal.automations.internal.completeRun, {
        runId: args.runId,
        contentId: generateResult.contentId,
      });

      return {
        success: true,
        contentId: generateResult.contentId,
        topic: topicResult.topic,
        caption: topicResult.caption,
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: errorMessage,
        errorStep: "content_generation",
      };
    }
  },
});

/**
 * Preview generation - generates content but doesn't schedule
 * Used in the wizard for testing the automation configuration
 */
export const previewGeneration = action({
  args: {
    themeConfig: themeConfigValidator,
    formatConfig: formatConfigValidator,
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    contentId?: Id<"content">;
    topic?: string;
    caption?: string;
    error?: string;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    try {
      // Step 1: Generate topic
      const topicResult = await generateTopic(args.themeConfig, args.formatConfig);

      // Step 2: Generate slideshow
      const generateResult = await ctx.runAction(api.slideshows.generate.generateWithConfig, {
        topic: topicResult.topic,
        slideCount: topicResult.slideCount,
        formatConfig: {
          visualStyle: args.formatConfig.visualStyle,
          aspectRatio: args.formatConfig.aspectRatio,
          textStyle: args.formatConfig.textStyle,
        },
      });

      if (!generateResult.success) {
        return {
          success: false,
          error: "Failed to generate slideshow",
        };
      }

      return {
        success: true,
        contentId: generateResult.contentId,
        topic: topicResult.topic,
        caption: topicResult.caption,
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: errorMessage,
      };
    }
  },
});
