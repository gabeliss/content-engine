import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Slide definition for carousels
const slideValidator = v.object({
  text: v.string(),
  imageUrl: v.string(),
  overlay: v.optional(v.boolean()), // Dark overlay for text readability
});

export default defineSchema({
  // Products - Apps/brands/businesses for content context
  products: defineTable({
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_active", ["isActive"])
    .index("by_user", ["userId"]),

  // Accounts - Social media accounts
  accounts: defineTable({
    platform: v.union(
      v.literal("tiktok"),
      v.literal("instagram"),
      v.literal("twitter")
    ),
    username: v.string(),
    displayName: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    productId: v.optional(v.id("products")), // Associated product
    // Credentials stored separately for security
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    tokenExpiresAt: v.optional(v.number()),
    platformUserId: v.optional(v.string()), // Platform-specific user ID
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_platform", ["platform"])
    .index("by_product", ["productId"])
    .index("by_username", ["platform", "username"]),

  // Content - Generated content library (only stores completed slideshows)
  content: defineTable({
    userId: v.string(),
    productId: v.optional(v.id("products")),
    accountId: v.optional(v.id("accounts")),

    // Input parameters used for generation
    inputParams: v.object({
      topic: v.optional(v.string()),
      slideCount: v.optional(v.number()),
      customPrompt: v.optional(v.string()),
      variables: v.optional(v.any()), // Additional variables
    }),

    // Generated content
    content: v.object({
      type: v.string(),
      slides: v.optional(v.array(slideValidator)),
      texts: v.optional(v.array(v.string())), // For threads
      mediaUrls: v.optional(v.array(v.string())),
      config: v.optional(v.object({
        fontSize: v.number(),
        fontColor: v.string(),
        textPosition: v.object({
          x: v.number(),
          y: v.number(),
        }),
        aspectRatio: v.optional(v.union(
          v.literal("1:1"),
          v.literal("4:5"),
          v.literal("9:16")
        )),
      })),
    }),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_product", ["productId"])
    .index("by_account", ["accountId"]),

  // Config - API keys and global settings
  config: defineTable({
    key: v.string(),
    value: v.string(),
    isSecret: v.boolean(), // If true, value is encrypted/masked in UI
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
});
