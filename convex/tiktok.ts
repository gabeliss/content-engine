import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

/**
 * Convert a Convex storage URL to a proxy URL served from our verified domain.
 * TikTok's PULL_FROM_URL requires images from a verified domain.
 *
 * Input:  https://<deployment>.convex.cloud/api/storage/<storageId>
 * Output: https://<convex-site-url>/images/<storageId>
 */
function convertToProxyUrl(storageUrl: string): string | null {
  // Extract storage ID from Convex URL
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

// Privacy level type
const privacyLevelValidator = v.union(
  v.literal("PUBLIC_TO_EVERYONE"),
  v.literal("MUTUAL_FOLLOW_FRIENDS"),
  v.literal("SELF_ONLY")
);

// Post mode type
const postModeValidator = v.union(
  v.literal("DIRECT_POST"),
  v.literal("MEDIA_UPLOAD")
);

// Post a slideshow (photo carousel) to TikTok
export const postSlideshow = action({
  args: {
    accountId: v.id("accounts"),
    contentId: v.id("content"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    privacyLevel: privacyLevelValidator,
    postMode: postModeValidator,
    autoAddMusic: v.boolean(),
    disableComment: v.boolean(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string; publishId?: string }> => {
    // Get valid access token (auto-refreshes if needed)
    const tokenResult = await ctx.runAction(internal.accounts.getValidAccessToken, {
      accountId: args.accountId,
    });

    if (!tokenResult.token) {
      return { success: false, error: tokenResult.error || "Failed to get access token" };
    }

    // Get the content/slides
    const content = await ctx.runQuery(internal.tiktok.getContentById, {
      contentId: args.contentId,
    });

    if (!content || !content.content?.slides) {
      return { success: false, error: "Content not found or has no slides" };
    }

    const slides = content.content.slides;
    if (slides.length === 0) {
      return { success: false, error: "No slides to post" };
    }

    // TikTok Photo Post requires 2-35 images
    if (slides.length < 2) {
      return { success: false, error: "TikTok requires at least 2 images for a photo post" };
    }
    if (slides.length > 35) {
      return { success: false, error: "TikTok allows maximum 35 images per post" };
    }

    // Get image URLs from slides and convert to proxy URLs
    // TikTok requires images from a verified domain, so we proxy through our Convex site
    const imageUrls = slides
      .map((slide: { imageUrl?: string }) => {
        if (!slide.imageUrl) return null;
        return convertToProxyUrl(slide.imageUrl);
      })
      .filter((url: string | null): url is string => !!url);

    if (imageUrls.length < 2) {
      return { success: false, error: "Need at least 2 valid image URLs. Make sure CONVEX_SITE_URL is configured." };
    }

    try {
      // Build post_info object
      const postInfo: Record<string, unknown> = {
        privacy_level: args.privacyLevel,
        disable_comment: args.disableComment,
        auto_add_music: args.autoAddMusic,
      };

      // Add title if provided
      if (args.title) {
        postInfo.title = args.title;
      }

      // Add description if provided
      if (args.description) {
        postInfo.description = args.description;
      }

      const requestBody = {
        post_info: postInfo,
        source_info: {
          source: "PULL_FROM_URL",
          photo_cover_index: 0,
          photo_images: imageUrls,
        },
        post_mode: args.postMode,
        media_type: "PHOTO",
      };

      // Log the request for debugging
      console.log("TikTok API Request:", JSON.stringify(requestBody, null, 2));
      console.log("Image URLs being sent:", imageUrls);

      // Initialize photo post
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

      // Log the full response for debugging
      console.log("TikTok API Response:", JSON.stringify(initData, null, 2));

      if (initData.error?.code !== "ok") {
        console.error("TikTok init error:", initData);
        return {
          success: false,
          error: initData.error?.message || `TikTok error: ${JSON.stringify(initData.error)}`,
        };
      }

      const publishId = initData.data?.publish_id;

      if (!publishId) {
        return { success: false, error: `No publish ID returned. Full response: ${JSON.stringify(initData)}` };
      }

      // For MEDIA_UPLOAD mode, we should check the status
      // Status can be: PROCESSING_UPLOAD, PROCESSING_DOWNLOAD, SEND_TO_USER_INBOX, PUBLISH_COMPLETE, FAILED
      console.log("Post initiated successfully. Publish ID:", publishId);

      return {
        success: true,
        publishId,
      };
    } catch (err) {
      console.error("TikTok posting error:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error posting to TikTok",
      };
    }
  },
});

// Check the status of a TikTok post
export const checkPostStatus = action({
  args: {
    accountId: v.id("accounts"),
    publishId: v.string(),
  },
  handler: async (ctx, args): Promise<{ status: string; error?: string }> => {
    const tokenResult = await ctx.runAction(internal.accounts.getValidAccessToken, {
      accountId: args.accountId,
    });

    if (!tokenResult.token) {
      return { status: "error", error: tokenResult.error || "Failed to get access token" };
    }

    try {
      const response = await fetch(
        "https://open.tiktokapis.com/v2/post/publish/status/fetch/",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenResult.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            publish_id: args.publishId,
          }),
        }
      );

      const data = await response.json();

      if (data.error?.code !== "ok") {
        return {
          status: "error",
          error: data.error?.message || "Failed to check status",
        };
      }

      // Status can be: PROCESSING_UPLOAD, PROCESSING_DOWNLOAD, SEND_TO_USER_INBOX,
      // PUBLISH_COMPLETE, FAILED
      return {
        status: data.data?.status || "unknown",
        error: data.data?.fail_reason,
      };
    } catch (err) {
      return {
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  },
});

// Internal query to get content by ID (bypasses auth for internal use)
import { internalQuery } from "./_generated/server";
import { api } from "./_generated/api";

export const getContentById = internalQuery({
  args: { contentId: v.id("content") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.contentId);
  },
});

/**
 * Post rendered slides to TikTok
 * This action accepts pre-rendered base64 WebP images (with text overlays baked in)
 * instead of fetching raw images from storage
 */
export const postRenderedSlideshow = action({
  args: {
    accountId: v.id("accounts"),
    renderedImages: v.array(v.string()), // Array of base64 WebP data URIs
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    privacyLevel: privacyLevelValidator,
    postMode: postModeValidator,
    autoAddMusic: v.boolean(),
    disableComment: v.boolean(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string; publishId?: string }> => {
    // Get valid access token (auto-refreshes if needed)
    const tokenResult = await ctx.runAction(internal.accounts.getValidAccessToken, {
      accountId: args.accountId,
    });

    if (!tokenResult.token) {
      return { success: false, error: tokenResult.error || "Failed to get access token" };
    }

    // Validate slide count
    if (args.renderedImages.length < 2) {
      return { success: false, error: "TikTok requires at least 2 images for a photo post" };
    }
    if (args.renderedImages.length > 35) {
      return { success: false, error: "TikTok allows maximum 35 images per post" };
    }

    try {
      // Upload rendered images to Convex storage and get URLs
      console.log(`Uploading ${args.renderedImages.length} rendered slides to storage...`);

      const storageUrls = await ctx.runAction(api.storage.uploadBase64Images, {
        base64DataArray: args.renderedImages,
      });

      // Convert storage URLs to proxy URLs for TikTok
      const imageUrls = storageUrls
        .map((url: string) => convertToProxyUrl(url))
        .filter((url: string | null): url is string => !!url);

      if (imageUrls.length < 2) {
        return { success: false, error: "Failed to upload rendered images" };
      }

      console.log("Rendered images uploaded, proxy URLs:", imageUrls);

      // Build post_info object
      const postInfo: Record<string, unknown> = {
        privacy_level: args.privacyLevel,
        disable_comment: args.disableComment,
        auto_add_music: args.autoAddMusic,
      };

      if (args.title) {
        postInfo.title = args.title;
      }

      if (args.description) {
        postInfo.description = args.description;
      }

      const requestBody = {
        post_info: postInfo,
        source_info: {
          source: "PULL_FROM_URL",
          photo_cover_index: 0,
          photo_images: imageUrls,
        },
        post_mode: args.postMode,
        media_type: "PHOTO",
      };

      console.log("TikTok API Request (rendered):", JSON.stringify(requestBody, null, 2));

      // Initialize photo post
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
        console.error("TikTok init error:", initData);
        return {
          success: false,
          error: initData.error?.message || `TikTok error: ${JSON.stringify(initData.error)}`,
        };
      }

      const publishId = initData.data?.publish_id;

      if (!publishId) {
        return { success: false, error: `No publish ID returned. Full response: ${JSON.stringify(initData)}` };
      }

      console.log("Rendered slideshow post initiated. Publish ID:", publishId);

      return {
        success: true,
        publishId,
      };
    } catch (err) {
      console.error("TikTok posting error:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error posting to TikTok",
      };
    }
  },
});
