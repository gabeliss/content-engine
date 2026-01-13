// Shared validators used across schema and mutations
import { v } from "convex/values";

// Slide definition for carousels
export const slideValidator = v.object({
  text: v.string(),
  imageUrl: v.string(),
  overlay: v.optional(v.boolean()), // Dark overlay for text readability
  imagePrompt: v.optional(v.string()), // Prompt used to generate current image (from visual planning or manual regeneration)
});

// Content validator
export const contentValidator = v.object({
  type: v.string(),
  slides: v.optional(v.array(slideValidator)),
  texts: v.optional(v.array(v.string())),
  mediaUrls: v.optional(v.array(v.string())),
  config: v.optional(
    v.object({
      fontSize: v.number(),
      fontColor: v.string(),
      textPosition: v.object({
        x: v.number(),
        y: v.number(),
      }),
      aspectRatio: v.optional(
        v.union(v.literal("1:1"), v.literal("4:5"), v.literal("9:16"))
      ),
    })
  ),
});

// Aspect ratio validator (shared)
export const aspectRatioValidator = v.union(
  v.literal("1:1"),
  v.literal("4:5"),
  v.literal("9:16")
);

// Privacy level validator (shared with scheduledPosts)
export const privacyLevelValidator = v.union(
  v.literal("PUBLIC_TO_EVERYONE"),
  v.literal("MUTUAL_FOLLOW_FRIENDS"),
  v.literal("SELF_ONLY")
);

// Automation theme configuration
export const themeConfigValidator = v.object({
  accountNiche: v.string(), // e.g., "self-improvement / habit tracking"
  targetAudience: v.optional(v.string()), // e.g., "young professionals 20-35"
  brandVoice: v.optional(v.string()), // e.g., "motivational, direct, no-nonsense"
  contentGuidelines: v.string(), // Detailed instructions for AI
  topicExamples: v.array(v.string()), // Example topics for inspiration
});

// Automation format configuration
export const formatConfigValidator = v.object({
  slideCount: v.object({
    min: v.number(),
    max: v.number(),
  }),
  textStyle: v.optional(
    v.object({
      maxCharsPerSlide: v.optional(v.number()),
      tone: v.optional(v.string()), // "punchy", "detailed", "casual"
    })
  ),
  visualStyle: v.optional(v.string()), // "dark minimalist", "bright colorful"
  aspectRatio: aspectRatioValidator,
});

// Automation schedule configuration
export const scheduleConfigValidator = v.object({
  timezone: v.string(), // e.g., "America/New_York"
  postingTimes: v.array(
    v.object({
      dayOfWeek: v.number(), // 0-6 (Sunday-Saturday)
      hour: v.number(), // 0-23
      minute: v.number(), // 0-59
    })
  ),
});

// Automation post settings
export const postSettingsValidator = v.object({
  privacyLevel: privacyLevelValidator,
  autoAddMusic: v.boolean(),
});

// Automation run status
export const automationRunStatusValidator = v.union(
  v.literal("pending"),
  v.literal("generating"),
  v.literal("scheduling"),
  v.literal("completed"),
  v.literal("failed")
);

// Content type (extensible for future content types)
export const contentTypeValidator = v.literal("slideshow");
