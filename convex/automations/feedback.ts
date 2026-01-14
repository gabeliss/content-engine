/**
 * AI-powered feedback analysis for automation configuration
 * Allows users to describe issues in plain English and get config suggestions
 */

import { action } from "../_generated/server";
import { v } from "convex/values";
import { generateText } from "../providers/gemini";
import {
  themeConfigValidator,
  formatConfigValidator,
} from "../validators";

interface ConfigSuggestion {
  changes: string[];
  themeConfig?: {
    accountNiche?: string;
    targetAudience?: string;
    brandVoice?: string;
    contentGuidelines?: string;
    topicExamples?: string[];
  };
  formatConfig?: {
    slideCount?: { min: number; max: number };
    textStyle?: {
      maxCharsPerSlide?: number;
      tone?: string;
    };
    visualStyle?: string;
  };
}

/**
 * Analyze user feedback and suggest configuration changes
 */
export const analyzeFeedback = action({
  args: {
    feedback: v.string(),
    currentThemeConfig: themeConfigValidator,
    currentFormatConfig: formatConfigValidator,
    generatedTopic: v.optional(v.string()),
    generatedCaption: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    suggestion?: ConfigSuggestion;
    error?: string;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { success: false, error: "Not authenticated" };
    }

    try {
      const prompt = `You are an AI assistant helping a user configure their content automation settings.

CURRENT CONFIGURATION:
Theme Config:
- Account Niche: ${args.currentThemeConfig.accountNiche}
- Target Audience: ${args.currentThemeConfig.targetAudience || "Not specified"}
- Brand Voice: ${args.currentThemeConfig.brandVoice || "Not specified"}
- Content Guidelines: ${args.currentThemeConfig.contentGuidelines}
- Topic Examples: ${args.currentThemeConfig.topicExamples.join(", ")}

Format Config:
- Slide Count: ${args.currentFormatConfig.slideCount.min}-${args.currentFormatConfig.slideCount.max}
- Text Tone: ${args.currentFormatConfig.textStyle?.tone || "Not specified"}
- Max Chars Per Slide: ${args.currentFormatConfig.textStyle?.maxCharsPerSlide || "Not specified"}
- Visual Style: ${args.currentFormatConfig.visualStyle || "Not specified"}
- Aspect Ratio: ${args.currentFormatConfig.aspectRatio}

${args.generatedTopic ? `GENERATED CONTENT THAT USER IS REVIEWING:
Topic: ${args.generatedTopic}
Caption: ${args.generatedCaption || "Not provided"}` : ""}

USER FEEDBACK:
"${args.feedback}"

Based on this feedback, determine what configuration changes would address the user's concerns.

Rules for your response:
1. Only suggest changes that directly address the feedback
2. Be specific about what should change and why
3. For contentGuidelines, ADD to the existing guidelines rather than replacing them entirely
4. For topicExamples, you can add new examples if the user wants different topic styles
5. Keep changes minimal - don't overhaul everything for minor feedback

Return ONLY valid JSON in this exact format:
{
  "changes": [
    "Human-readable description of change 1",
    "Human-readable description of change 2"
  ],
  "themeConfig": {
    // Only include fields that should change
    "contentGuidelines": "Updated guidelines if needed",
    "brandVoice": "Updated voice if needed"
  },
  "formatConfig": {
    // Only include fields that should change
    "textStyle": {
      "tone": "new tone if needed"
    }
  }
}

If no configuration changes are needed (e.g., the feedback is about something outside the config), return:
{
  "changes": ["Explanation of why no changes are suggested"],
  "themeConfig": {},
  "formatConfig": {}
}`;

      const response = await generateText(
        prompt,
        "You are an expert at understanding user feedback and translating it into actionable configuration changes. Be precise and helpful.",
        {
          model: "gemini-2.0-flash",
          responseFormat: { type: "json_object" },
        }
      );

      const parsed = JSON.parse(response.text) as ConfigSuggestion;

      return {
        success: true,
        suggestion: {
          changes: parsed.changes || [],
          themeConfig: parsed.themeConfig,
          formatConfig: parsed.formatConfig,
        },
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: errorMessage };
    }
  },
});
