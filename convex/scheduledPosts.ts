import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
  internalAction,
  action,
} from "./_generated/server";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Validators
const privacyLevelValidator = v.union(
  v.literal("PUBLIC_TO_EVERYONE"),
  v.literal("MUTUAL_FOLLOW_FRIENDS"),
  v.literal("SELF_ONLY")
);

const postModeValidator = v.union(
  v.literal("DIRECT_POST"),
  v.literal("MEDIA_UPLOAD")
);

const statusValidator = v.union(
  v.literal("scheduled"),
  v.literal("posting"),
  v.literal("posted"),
  v.literal("failed")
);

// ============ Queries ============

// List all scheduled posts for current user
export const list = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const posts = await ctx.db
      .query("scheduledPosts")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("asc")
      .collect();

    // Fetch account details for each post
    const postsWithAccounts = await Promise.all(
      posts.map(async (post) => {
        const account = await ctx.db.get(post.accountId);
        return {
          ...post,
          account: account
            ? {
                _id: account._id,
                platform: account.platform,
                username: account.username,
                displayName: account.displayName,
                avatarUrl: account.avatarUrl,
              }
            : null,
        };
      })
    );

    return postsWithAccounts;
  },
});

// List posts by status (for "Needs Attention" section)
export const listByStatus = query({
  args: { status: statusValidator },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const posts = await ctx.db
      .query("scheduledPosts")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", identity.subject).eq("status", args.status)
      )
      .order("desc")
      .collect();

    // Fetch account details for each post
    const postsWithAccounts = await Promise.all(
      posts.map(async (post) => {
        const account = await ctx.db.get(post.accountId);
        return {
          ...post,
          account: account
            ? {
                _id: account._id,
                platform: account.platform,
                username: account.username,
                displayName: account.displayName,
                avatarUrl: account.avatarUrl,
              }
            : null,
        };
      })
    );

    return postsWithAccounts;
  },
});

// Get single scheduled post by ID
export const get = query({
  args: { id: v.id("scheduledPosts") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const post = await ctx.db.get(args.id);
    if (!post || post.userId !== identity.subject) return null;
    return post;
  },
});

// Get scheduled post with related data (content, account)
export const getWithDetails = query({
  args: { id: v.id("scheduledPosts") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const post = await ctx.db.get(args.id);
    if (!post || post.userId !== identity.subject) return null;

    const content = await ctx.db.get(post.contentId);
    const account = await ctx.db.get(post.accountId);

    // Remove sensitive token data from account
    const safeAccount = account
      ? {
          _id: account._id,
          platform: account.platform,
          username: account.username,
          displayName: account.displayName,
          avatarUrl: account.avatarUrl,
        }
      : null;

    return { ...post, content, account: safeAccount };
  },
});

// ============ Mutations ============

// Create a scheduled post
export const create = mutation({
  args: {
    contentId: v.id("content"),
    accountId: v.id("accounts"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    privacyLevel: privacyLevelValidator,
    postMode: postModeValidator,
    autoAddMusic: v.boolean(),
    renderedImageUrls: v.array(v.string()),
    scheduledFor: v.number(),
    timezone: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Validate minimum time buffer (15 minutes from now)
    const minScheduleTime = Date.now() + 15 * 60 * 1000;
    if (args.scheduledFor < minScheduleTime) {
      throw new Error(
        "Scheduled time must be at least 15 minutes in the future"
      );
    }

    // Validate content exists and belongs to user
    const content = await ctx.db.get(args.contentId);
    if (!content || content.userId !== identity.subject) {
      throw new Error("Content not found");
    }

    // Validate account exists and belongs to user
    const account = await ctx.db.get(args.accountId);
    if (!account || account.userId !== identity.subject) {
      throw new Error("Account not found");
    }

    // Validate rendered images count (TikTok requirement)
    if (args.renderedImageUrls.length < 2 || args.renderedImageUrls.length > 35) {
      throw new Error("TikTok requires 2-35 images");
    }

    const now = Date.now();
    return await ctx.db.insert("scheduledPosts", {
      userId: identity.subject,
      contentId: args.contentId,
      accountId: args.accountId,
      title: args.title,
      description: args.description,
      privacyLevel: args.privacyLevel,
      postMode: args.postMode,
      autoAddMusic: args.autoAddMusic,
      renderedImageUrls: args.renderedImageUrls,
      scheduledFor: args.scheduledFor,
      timezone: args.timezone,
      status: "scheduled",
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update metadata only (title, description, privacy, postMode)
export const update = mutation({
  args: {
    id: v.id("scheduledPosts"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    privacyLevel: v.optional(privacyLevelValidator),
    postMode: v.optional(postModeValidator),
    autoAddMusic: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const post = await ctx.db.get(args.id);
    if (!post || post.userId !== identity.subject) {
      throw new Error("Post not found");
    }

    if (post.status !== "scheduled") {
      throw new Error("Can only update scheduled posts");
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (args.privacyLevel !== undefined) updates.privacyLevel = args.privacyLevel;
    if (args.postMode !== undefined) updates.postMode = args.postMode;
    if (args.autoAddMusic !== undefined) updates.autoAddMusic = args.autoAddMusic;

    await ctx.db.patch(args.id, updates);
  },
});

// Reschedule a post
export const reschedule = mutation({
  args: {
    id: v.id("scheduledPosts"),
    scheduledFor: v.number(),
    timezone: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const post = await ctx.db.get(args.id);
    if (!post || post.userId !== identity.subject) {
      throw new Error("Post not found");
    }

    if (post.status !== "scheduled" && post.status !== "failed") {
      throw new Error("Can only reschedule scheduled or failed posts");
    }

    const minScheduleTime = Date.now() + 15 * 60 * 1000;
    if (args.scheduledFor < minScheduleTime) {
      throw new Error(
        "Scheduled time must be at least 15 minutes in the future"
      );
    }

    await ctx.db.patch(args.id, {
      scheduledFor: args.scheduledFor,
      timezone: args.timezone,
      status: "scheduled", // Reset status if was failed
      errorMessage: undefined,
      updatedAt: Date.now(),
    });
  },
});

// Delete a scheduled post
export const remove = mutation({
  args: { id: v.id("scheduledPosts") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const post = await ctx.db.get(args.id);
    if (!post || post.userId !== identity.subject) {
      throw new Error("Post not found");
    }

    if (post.status === "posting") {
      throw new Error("Cannot delete a post that is currently being published");
    }

    await ctx.db.delete(args.id);
  },
});

// ============ Post Now Action (user-triggered) ============

export const postNow = action({
  args: { id: v.id("scheduledPosts") },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; error?: string; publishId?: string }> => {
    // Get the scheduled post
    const post = await ctx.runQuery(api.scheduledPosts.get, { id: args.id });

    if (!post) {
      return { success: false, error: "Post not found" };
    }

    if (post.status !== "scheduled" && post.status !== "failed") {
      return { success: false, error: "Post is not in a valid state to publish" };
    }

    // Process the post
    return await ctx.runAction(internal.scheduledPosts.processScheduledPost, {
      postId: args.id,
    });
  },
});

// ============ Internal Functions for Cron ============

// Internal query to get post (bypasses auth for cron)
export const getInternal = internalQuery({
  args: { id: v.id("scheduledPosts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Internal mutation to update post status
export const updateStatus = internalMutation({
  args: {
    id: v.id("scheduledPosts"),
    status: statusValidator,
    publishId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    postedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {
      status: args.status,
      updatedAt: Date.now(),
    };

    if (args.publishId !== undefined) updates.publishId = args.publishId;
    if (args.errorMessage !== undefined) updates.errorMessage = args.errorMessage;
    if (args.postedAt !== undefined) updates.postedAt = args.postedAt;

    await ctx.db.patch(args.id, updates);
  },
});

// Internal query to find due posts
export const getDuePosts = internalQuery({
  handler: async (ctx) => {
    const now = Date.now();

    // Get all scheduled posts that are due
    const allScheduled = await ctx.db
      .query("scheduledPosts")
      .withIndex("by_status", (q) => q.eq("status", "scheduled"))
      .collect();

    // Filter for posts that are due (scheduledFor <= now)
    const duePosts = allScheduled.filter((post) => post.scheduledFor <= now);

    // Limit to 10 posts per cron run to avoid timeouts
    return duePosts.slice(0, 10);
  },
});

/**
 * Convert a Convex storage URL to a proxy URL served from our verified domain.
 * TikTok's PULL_FROM_URL requires images from a verified domain.
 */
function convertToProxyUrl(storageUrl: string): string | null {
  const match = storageUrl.match(/\/api\/storage\/([a-zA-Z0-9_-]+)/);
  if (!match || !match[1]) {
    return null;
  }

  const storageId = match[1];
  const siteUrl = process.env.CONVEX_SITE_URL;

  if (!siteUrl) {
    console.error("CONVEX_SITE_URL not configured");
    return null;
  }

  return `${siteUrl}/images/${storageId}`;
}

// Internal action to process a single scheduled post
export const processScheduledPost = internalAction({
  args: { postId: v.id("scheduledPosts") },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; error?: string; publishId?: string }> => {
    // Get the scheduled post
    const post = await ctx.runQuery(internal.scheduledPosts.getInternal, {
      id: args.postId,
    });

    if (!post) {
      return { success: false, error: "Post not found" };
    }

    // Mark as posting
    await ctx.runMutation(internal.scheduledPosts.updateStatus, {
      id: args.postId,
      status: "posting",
    });

    try {
      // Get valid access token (auto-refreshes if needed)
      const tokenResult = await ctx.runAction(
        internal.accounts.getValidAccessToken,
        {
          accountId: post.accountId,
        }
      );

      if (!tokenResult.token) {
        throw new Error(tokenResult.error || "Failed to get access token");
      }

      // Convert storage URLs to proxy URLs for TikTok
      const imageUrls = post.renderedImageUrls
        .map((url: string) => convertToProxyUrl(url))
        .filter((url: string | null): url is string => !!url);

      if (imageUrls.length < 2) {
        throw new Error(
          "Failed to process rendered images. Make sure CONVEX_SITE_URL is configured."
        );
      }

      // Build post_info object
      const postInfo: Record<string, unknown> = {
        privacy_level: post.privacyLevel,
        disable_comment: false,
        auto_add_music: post.autoAddMusic,
      };

      if (post.title) postInfo.title = post.title;
      if (post.description) postInfo.description = post.description;

      const requestBody = {
        post_info: postInfo,
        source_info: {
          source: "PULL_FROM_URL",
          photo_cover_index: 0,
          photo_images: imageUrls,
        },
        post_mode: post.postMode,
        media_type: "PHOTO",
      };

      console.log(
        "Processing scheduled post:",
        args.postId,
        JSON.stringify(requestBody, null, 2)
      );

      // Call TikTok API
      const initResponse = await fetch(
        "https://open.tiktokapis.com/v2/post/publish/content/init/",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenResult.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

      const initData = await initResponse.json();
      console.log("TikTok API Response:", JSON.stringify(initData, null, 2));

      if (initData.error?.code !== "ok") {
        throw new Error(
          initData.error?.message ||
            `TikTok error: ${JSON.stringify(initData.error)}`
        );
      }

      const publishId = initData.data?.publish_id;

      if (!publishId) {
        throw new Error("No publish ID returned from TikTok");
      }

      // Mark as posted
      await ctx.runMutation(internal.scheduledPosts.updateStatus, {
        id: args.postId,
        status: "posted",
        publishId,
        postedAt: Date.now(),
      });

      // Schedule polling to link this post to the video once TikTok processing completes
      // This enables fallback thumbnails for slideshows and proper source tracking
      await ctx.runMutation(internal.tiktokAnalytics.schedulePollPostStatus, {
        accountId: post.accountId,
        publishId,
        contentId: post.contentId,
        scheduledPostId: args.postId,
        delayMs: 30000, // Start checking after 30 seconds
      });

      console.log("Scheduled post published successfully:", args.postId, publishId);

      return { success: true, publishId };
    } catch (err) {
      console.error("Error processing scheduled post:", args.postId, err);

      // Mark as failed
      await ctx.runMutation(internal.scheduledPosts.updateStatus, {
        id: args.postId,
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      });

      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },
});

// Internal action to process all due posts (called by cron)
export const processDuePosts = internalAction({
  handler: async (ctx): Promise<{ processed: number }> => {
    const duePosts = await ctx.runQuery(internal.scheduledPosts.getDuePosts);

    console.log(`Cron: Found ${duePosts.length} due posts to process`);

    if (duePosts.length === 0) {
      return { processed: 0 };
    }

    const results = await Promise.allSettled(
      duePosts.map((post: { _id: Id<"scheduledPosts"> }) =>
        ctx.runAction(internal.scheduledPosts.processScheduledPost, {
          postId: post._id,
        })
      )
    );

    // Log results
    results.forEach((result, index) => {
      const post = duePosts[index] as { _id: Id<"scheduledPosts"> };
      if (result.status === "fulfilled") {
        const value = result.value as { success: boolean; error?: string };
        console.log(
          `Post ${post._id}: ${value.success ? "Success" : value.error}`
        );
      } else {
        console.log(`Post ${post._id}: Failed - ${result.reason}`);
      }
    });

    return { processed: duePosts.length };
  },
});
