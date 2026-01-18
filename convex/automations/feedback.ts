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
    topicExamples?: string[];
  };
  formatConfig?: {
    visualStyle?: string;
    aspectRatio?: "1:1" | "4:5" | "9:16";
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
- Topic Examples: ${args.currentThemeConfig.topicExamples.join(", ")}

Format Config:
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
3. For topicExamples, you can add new examples if the user wants different topic styles
4. Keep changes minimal - don't overhaul everything for minor feedback
5. The tone/voice is inferred from the topic examples, so suggest adding examples with the desired tone

Return ONLY valid JSON in this exact format:
{
  "changes": [
    "Human-readable description of change 1",
    "Human-readable description of change 2"
  ],
  "themeConfig": {
    // Only include fields that should change
    "accountNiche": "Updated niche if needed",
    "topicExamples": ["new example 1", "new example 2"]
  },
  "formatConfig": {
    // Only include fields that should change
    "visualStyle": "new style if needed"
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
