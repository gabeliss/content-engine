import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type ActionCtx,
  type MutationCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { buildPlannerPrompt, inferSlideCount, normalizePlan } from "./planning";
import {
  type CanonicalSlideshowSlide,
  type CanonicalSlideshowSpec,
  slideshowPlanSchema,
  type SlideshowPlannerOutput,
  type SlideshowPlan,
  type SlideshowTextBlock,
} from "./types";
import { getSlideDimensions } from "./slideshowRenderer";
import { getModelProvider } from "../providers/index";
import type {
  GeneratedAsset,
  ModelInvocationMetadata,
  ModelProvider,
} from "../providers/model";
import { contentRequestStatusValidator } from "../validators";

function currentUserId(identity: { subject: string } | null) {
  if (!identity) throw new Error("Not authenticated");
  return identity.subject;
}

function sumCost(current: number, metadata?: ModelInvocationMetadata) {
  return current + (metadata?.costUsd ?? 0);
}

function providerImagePrompt(slidePrompt: string, aspectRatio: SlideshowPlan["aspectRatio"]) {
  const trimmed = slidePrompt.trim().replace(/\s+/g, " ");
  const hasBackgroundConstraint = /background image only/i.test(trimmed);
  return [
    trimmed,
    `Vertical ${aspectRatio} full-bleed image.`,
    hasBackgroundConstraint
      ? undefined
      : "Background image only, without embedded writing or graphic design elements.",
  ].filter(Boolean).join(" ");
}

async function createRequestArtifact(
  ctx: ActionCtx,
  args: {
    request: Doc<"contentRequests">;
    type: Doc<"artifacts">["type"];
    title?: string;
    storageUrl?: string;
    data?: unknown;
    provider?: "gemini" | "fal" | "openrouter" | "manual";
    model?: string;
    prompt?: string;
    parentArtifactIds?: Id<"artifacts">[];
  }
) {
  return await ctx.runMutation(internal.artifacts.records.createFromRunner, {
    userId: args.request.userId,
    brandId: args.request.brandId,
    contentRequestId: args.request._id,
    parentArtifactIds: args.parentArtifactIds,
    type: args.type,
    title: args.title,
    storageUrl: args.storageUrl,
    data: args.data,
    provider: args.provider,
    model: args.model,
    prompt: args.prompt,
    lifecycle: "preview",
    reviewStatus: "pending",
  });
}

async function waitForImageResult(
  provider: ModelProvider,
  args: {
    jobId?: string;
    model: string;
  }
): Promise<GeneratedAsset | undefined> {
  if (!args.jobId) return undefined;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const result = await provider.getJobStatus({
      jobId: args.jobId,
      model: args.model,
    });
    if (result.status === "succeeded") return result.assets?.[0];
    if (result.status === "failed" || result.status === "canceled") return undefined;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  return undefined;
}

function buildCanonicalSlideshowSpec(args: {
  plan: SlideshowPlan;
  dimensions: { width: number; height: number };
  imageBySlideIndex: Map<number, { artifactId: Id<"artifacts">; url?: string }>;
}): CanonicalSlideshowSpec {
  const now = Date.now();
  return {
    format: "slideshow",
    title: args.plan.title,
    caption: args.plan.caption,
    aspectRatio: args.plan.aspectRatio,
    dimensions: args.dimensions,
    exportSettings: {
      previewMimeType: "image/png",
      publishMimeType: "image/jpeg",
      width: args.dimensions.width,
      height: args.dimensions.height,
    },
    creativeBrief: args.plan.creativeBrief,
    strategy: args.plan.strategy,
    slides: args.plan.slides.map((slide): CanonicalSlideshowSlide => {
      const image = args.imageBySlideIndex.get(slide.index);
      return {
        ...slide,
        status: "active",
        dimensions: args.dimensions,
        backgroundImageUrl: image?.url,
        sourceImageArtifactId: image?.artifactId ? String(image.artifactId) : undefined,
        renderVersion: 1,
        renderStatus: "pending",
        updatedAt: now,
      };
    }),
  };
}

function normalizeCanonicalSpec(value: unknown): CanonicalSlideshowSpec {
  if (!value || typeof value !== "object") {
    throw new Error("Slideshow spec is missing");
  }
  return value as CanonicalSlideshowSpec;
}

function getArtifactData(artifact: Doc<"artifacts">): Record<string, unknown> {
  return artifact.data && typeof artifact.data === "object" && !Array.isArray(artifact.data)
    ? artifact.data as Record<string, unknown>
    : {};
}

function getSlideshowArtifactRefs(artifact: Doc<"artifacts">): {
  slideshowId: Id<"slideshows">;
  slideId: string;
} {
  const data = getArtifactData(artifact);
  if (typeof data.sourceSlideshowId !== "string" || typeof data.sourceSlideId !== "string") {
    throw new Error("Rendered slide image is not linked to a slideshow spec");
  }

  return {
    slideshowId: data.sourceSlideshowId as Id<"slideshows">,
    slideId: data.sourceSlideId,
  };
}

function appendRevision(
  slideshow: Doc<"slideshows">,
  event: Record<string, unknown>
): Array<Record<string, unknown>> {
  const existing = Array.isArray(slideshow.revisionHistory)
    ? slideshow.revisionHistory as Array<Record<string, unknown>>
    : [];
  return [
    ...existing,
    {
      ...event,
      at: Date.now(),
    },
  ];
}

function reindexActiveSlides(spec: CanonicalSlideshowSpec): CanonicalSlideshowSpec {
  let activeIndex = 1;
  return {
    ...spec,
    slides: spec.slides.map((slide) => {
      if (slide.status === "deleted") return slide;
      const nextSlide = {
        ...slide,
        index: activeIndex,
        updatedAt: Date.now(),
      };
      activeIndex += 1;
      return nextSlide;
    }),
  };
}

async function cleanupArtifactStorage(ctx: MutationCtx, artifact: Doc<"artifacts">) {
  const data = getArtifactData(artifact);
  const storageIds = [data.storageId, data.publishStorageId].filter(
    (value): value is Id<"_storage"> => typeof value === "string"
  );

  for (const storageId of storageIds) {
    try {
      await ctx.storage.delete(storageId);
    } catch {
      // Storage cleanup is best-effort; rows are still the durable state.
    }
  }
}

async function deleteArtifactsForRequest(
  ctx: MutationCtx,
  args: { requestId: Id<"contentRequests">; userId: string }
) {
  const artifacts = await ctx.db
    .query("artifacts")
    .withIndex("by_content_request", (q) => q.eq("contentRequestId", args.requestId))
    .collect();

  for (const artifact of artifacts) {
    if (artifact.userId !== args.userId) continue;
    await cleanupArtifactStorage(ctx, artifact);
    await ctx.db.delete(artifact._id);
  }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = currentUserId(await ctx.auth.getUserIdentity());
    return await ctx.db
      .query("contentRequests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const createSlideshow = mutation({
  args: {
    brandId: v.id("brands"),
    socialAccountId: v.optional(v.id("socialAccounts")),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = currentUserId(await ctx.auth.getUserIdentity());
    const prompt = args.prompt.trim();
    if (!prompt) throw new Error("Prompt is required");

    const brand = await ctx.db.get(args.brandId);
    if (!brand || brand.userId !== userId) throw new Error("Brand not found");

    if (args.socialAccountId) {
      const account = await ctx.db.get(args.socialAccountId);
      if (!account || account.userId !== userId) throw new Error("Social account not found");
    }

    const now = Date.now();
    const requestId = await ctx.db.insert("contentRequests", {
      userId,
      brandId: args.brandId,
      socialAccountId: args.socialAccountId,
      contentFormat: "slideshow",
      prompt,
      status: "queued",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.content.requests.execute, { requestId });
    return requestId;
  },
});

export const reviseSlideshow = mutation({
  args: {
    id: v.id("contentRequests"),
    revisionPrompt: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = currentUserId(await ctx.auth.getUserIdentity());
    const request = await ctx.db.get(args.id);
    if (!request || request.userId !== userId) throw new Error("Content request not found");
    const revisionPrompt = args.revisionPrompt.trim();
    if (!revisionPrompt) throw new Error("Revision prompt is required");

    await deleteArtifactsForRequest(ctx, { requestId: args.id, userId });
    await ctx.db.patch(args.id, {
      revisionPrompt,
      status: "queued",
      errorMessage: undefined,
      completedAt: undefined,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.content.requests.execute, { requestId: args.id });
  },
});

export const save = mutation({
  args: { id: v.id("contentRequests") },
  handler: async (ctx, args) => {
    const userId = currentUserId(await ctx.auth.getUserIdentity());
    const request = await ctx.db.get(args.id);
    if (!request || request.userId !== userId) throw new Error("Content request not found");

    const now = Date.now();
    const artifacts = await ctx.db
      .query("artifacts")
      .withIndex("by_content_request", (q) => q.eq("contentRequestId", args.id))
      .collect();

    for (const artifact of artifacts) {
      if (artifact.userId !== userId) continue;
      await ctx.db.patch(artifact._id, {
        lifecycle: "saved",
        reviewStatus: "approved",
        updatedAt: now,
      });
    }

    const slideshows = await ctx.db
      .query("slideshows")
      .withIndex("by_content_request", (q) => q.eq("contentRequestId", args.id))
      .collect();
    for (const slideshow of slideshows) {
      if (slideshow.userId !== userId) continue;
      await ctx.db.patch(slideshow._id, {
        status: "saved",
        savedAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(args.id, {
      status: "saved",
      savedAt: now,
      updatedAt: now,
    });
  },
});

export const discard = mutation({
  args: { id: v.id("contentRequests") },
  handler: async (ctx, args) => {
    const userId = currentUserId(await ctx.auth.getUserIdentity());
    const request = await ctx.db.get(args.id);
    if (!request || request.userId !== userId) throw new Error("Content request not found");

    await deleteArtifactsForRequest(ctx, { requestId: args.id, userId });
    const slideshows = await ctx.db
      .query("slideshows")
      .withIndex("by_content_request", (q) => q.eq("contentRequestId", args.id))
      .collect();
    for (const slideshow of slideshows) {
      if (slideshow.userId !== userId) continue;
      await ctx.db.patch(slideshow._id, {
        status: "discarded",
        updatedAt: Date.now(),
      });
    }
    await ctx.db.patch(args.id, {
      status: "discarded",
      updatedAt: Date.now(),
    });
  },
});

export const getExecutionContext = internalQuery({
  args: { requestId: v.id("contentRequests") },
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request) return null;

    const brand = await ctx.db.get(request.brandId);
    const socialAccount = request.socialAccountId
      ? await ctx.db.get(request.socialAccountId)
      : null;

    if (!brand) return null;
    return { request, brand, socialAccount };
  },
});

export const transition = internalMutation({
  args: {
    requestId: v.id("contentRequests"),
    status: contentRequestStatusValidator,
    plan: v.optional(v.any()),
    summary: v.optional(v.string()),
    costUsd: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const patch: Partial<Doc<"contentRequests">> = {
      status: args.status,
      updatedAt: Date.now(),
    };
    if (args.status === "planning") patch.startedAt = Date.now();
    if (args.plan !== undefined) patch.plan = args.plan;
    if (args.summary !== undefined) patch.summary = args.summary;
    if (args.costUsd !== undefined) patch.costUsd = args.costUsd;
    if (args.errorMessage !== undefined) patch.errorMessage = args.errorMessage;
    if (args.completedAt !== undefined) patch.completedAt = args.completedAt;

    await ctx.db.patch(args.requestId, patch);
  },
});

function textBlocksFromEdit(args: {
  primaryText: string;
  secondaryText?: string;
  bullets?: string[];
}): SlideshowTextBlock[] {
  const blocks: SlideshowTextBlock[] = [
    {
      role: "headline",
      text: args.primaryText.trim(),
      items: [],
      emphasis: "primary",
    },
  ];

  const bullets = (args.bullets ?? []).filter((item) => item.trim()).slice(0, 4);
  if (bullets.length > 0) {
    blocks.push({
      role: "bullet_list",
      text: "",
      items: bullets,
      emphasis: "secondary",
    });
  } else if (args.secondaryText?.trim()) {
    blocks.push({
      role: "body",
      text: args.secondaryText.trim(),
      items: [],
      emphasis: "secondary",
    });
  }

  return blocks;
}

export const deleteSlide = mutation({
  args: { artifactId: v.id("artifacts") },
  handler: async (ctx, args) => {
    const userId = currentUserId(await ctx.auth.getUserIdentity());
    const artifact = await ctx.db.get(args.artifactId);
    if (!artifact || artifact.userId !== userId || artifact.type !== "rendered_slide_image") {
      throw new Error("Rendered slide not found");
    }
    const refs = getSlideshowArtifactRefs(artifact);
    const slideshow = await ctx.db.get(refs.slideshowId);
    if (!slideshow || slideshow.userId !== userId) {
      throw new Error("Slideshow not found");
    }
    const spec = normalizeCanonicalSpec(slideshow.spec);
    const nextSpec = reindexActiveSlides({
      ...spec,
      slides: spec.slides.map((slide) =>
        slide.slideId === refs.slideId
          ? { ...slide, status: "deleted", updatedAt: Date.now() }
          : slide
      ),
    });

    await ctx.db.patch(slideshow._id, {
      spec: nextSpec,
      revisionHistory: appendRevision(slideshow, {
        type: "delete_slide",
        slideId: refs.slideId,
      }),
      updatedAt: Date.now(),
    });
    await cleanupArtifactStorage(ctx, artifact);
    await ctx.db.delete(args.artifactId);
  },
});

export const duplicateSlide = action({
  args: { artifactId: v.id("artifacts") },
  handler: async (ctx, args): Promise<Id<"artifacts">> => {
    const userId = currentUserId(await ctx.auth.getUserIdentity());
    const artifact: Doc<"artifacts"> | null = await ctx.runQuery(internal.artifacts.records.getForRunner, {
      artifactId: args.artifactId,
    });
    if (!artifact || artifact.userId !== userId || artifact.type !== "rendered_slide_image") {
      throw new Error("Rendered slide not found");
    }
    if (!artifact.contentRequestId) {
      throw new Error("Only one-off slideshow slides can be duplicated here");
    }
    const refs = getSlideshowArtifactRefs(artifact);
    const slideshow = await ctx.runQuery(internal.content.slideshows.getForRunner, {
      slideshowId: refs.slideshowId,
    });
    if (!slideshow || slideshow.userId !== userId) throw new Error("Slideshow not found");
    const context = await ctx.runQuery(internal.content.requests.getExecutionContext, {
      requestId: artifact.contentRequestId,
    });
    if (!context || context.request.userId !== userId) throw new Error("Content request not found");

    const spec = normalizeCanonicalSpec(slideshow.spec);
    const sourceSlide = spec.slides.find((slide) => slide.slideId === refs.slideId);
    if (!sourceSlide || sourceSlide.status === "deleted") throw new Error("Slide not found");

    const activeSlides = spec.slides.filter((slide) => slide.status !== "deleted");
    const duplicatedSlide: CanonicalSlideshowSlide = {
      ...sourceSlide,
      slideId: `${sourceSlide.slideId}-copy-${Date.now()}`,
      index: activeSlides.length + 1,
      renderVersion: 1,
      renderStatus: "pending",
      renderDurationMs: undefined,
      failedRenderReason: undefined,
      outputFileSize: undefined,
      publishFileSize: undefined,
      updatedAt: Date.now(),
    };
    const nextSpec = reindexActiveSlides({
      ...spec,
      slides: [...spec.slides, duplicatedSlide],
    });

    await ctx.runMutation(internal.content.slideshows.updateFromRunner, {
      slideshowId: slideshow._id,
      userId,
      spec: nextSpec,
      revisionHistory: appendRevision(slideshow, {
        type: "duplicate_slide",
        sourceSlideId: refs.slideId,
        newSlideId: duplicatedSlide.slideId,
      }),
    });

    const renderedArtifactId: Id<"artifacts"> = await ctx.runAction(internal.content.rendering.renderSlideForContentRequest, {
      requestId: context.request._id,
      slideshowId: slideshow._id,
      parentArtifactIds: [artifact._id],
      slideId: duplicatedSlide.slideId,
    });

    await ctx.runMutation(internal.content.slideshows.updateFromRunner, {
      slideshowId: slideshow._id,
      userId,
      spec: {
        ...nextSpec,
        slides: nextSpec.slides.map((slide) =>
          slide.slideId === duplicatedSlide.slideId
            ? { ...slide, renderStatus: "succeeded" as const, updatedAt: Date.now() }
            : slide
        ),
      },
    });

    return renderedArtifactId;
  },
});

export const moveSlide = mutation({
  args: {
    artifactId: v.id("artifacts"),
    direction: v.union(v.literal("left"), v.literal("right")),
  },
  handler: async (ctx, args) => {
    const userId = currentUserId(await ctx.auth.getUserIdentity());
    const artifact = await ctx.db.get(args.artifactId);
    if (!artifact || artifact.userId !== userId || artifact.type !== "rendered_slide_image" || !artifact.contentRequestId) {
      throw new Error("Rendered slide not found");
    }
    const refs = getSlideshowArtifactRefs(artifact);
    const slideshow = await ctx.db.get(refs.slideshowId);
    if (!slideshow || slideshow.userId !== userId) {
      throw new Error("Slideshow not found");
    }

    const siblings = await ctx.db
      .query("artifacts")
      .withIndex("by_content_request", (q) => q.eq("contentRequestId", artifact.contentRequestId!))
      .collect();
    const slides = siblings
      .filter((item) => item.type === "rendered_slide_image" && item.userId === userId)
      .sort((first, second) => {
        const firstData = first.data && typeof first.data === "object" ? first.data as Record<string, unknown> : {};
        const secondData = second.data && typeof second.data === "object" ? second.data as Record<string, unknown> : {};
        const firstIndex = typeof firstData.slideIndex === "number" ? firstData.slideIndex : first.createdAt;
        const secondIndex = typeof secondData.slideIndex === "number" ? secondData.slideIndex : second.createdAt;
        return firstIndex - secondIndex;
      });
    const currentIndex = slides.findIndex((item) => item._id === args.artifactId);
    const targetIndex = args.direction === "left" ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= slides.length) return;

    const current = slides[currentIndex];
    const target = slides[targetIndex];
    const currentRefs = getSlideshowArtifactRefs(current);
    const targetRefs = getSlideshowArtifactRefs(target);
    const currentData = current.data && typeof current.data === "object" ? current.data as Record<string, unknown> : {};
    const targetData = target.data && typeof target.data === "object" ? target.data as Record<string, unknown> : {};
    const currentSlideIndex = typeof currentData.slideIndex === "number" ? currentData.slideIndex : currentIndex + 1;
    const targetSlideIndex = typeof targetData.slideIndex === "number" ? targetData.slideIndex : targetIndex + 1;
    const now = Date.now();
    const spec = normalizeCanonicalSpec(slideshow.spec);
    const nextSpec = {
      ...spec,
      slides: spec.slides.map((slide) => {
        if (slide.slideId === currentRefs.slideId) {
          return { ...slide, index: targetSlideIndex, updatedAt: now };
        }
        if (slide.slideId === targetRefs.slideId) {
          return { ...slide, index: currentSlideIndex, updatedAt: now };
        }
        return slide;
      }),
    };

    await ctx.db.patch(slideshow._id, {
      spec: nextSpec,
      revisionHistory: appendRevision(slideshow, {
        type: "move_slide",
        slideId: currentRefs.slideId,
        direction: args.direction,
      }),
      updatedAt: now,
    });

    await ctx.db.patch(current._id, {
      title: `Slide ${targetSlideIndex}`,
      data: { ...currentData, slideIndex: targetSlideIndex },
      updatedAt: now,
    });
    await ctx.db.patch(target._id, {
      title: `Slide ${currentSlideIndex}`,
      data: { ...targetData, slideIndex: currentSlideIndex },
      updatedAt: now,
    });
  },
});

export const updateSlideText = action({
  args: {
    artifactId: v.id("artifacts"),
    primaryText: v.string(),
    secondaryText: v.optional(v.string()),
    bullets: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<{
    renderedImageUrl?: string;
    publishImageUrl?: string;
    renderDurationMs: number;
    outputFileSize: number;
    publishFileSize: number;
  }> => {
    const userId = currentUserId(await ctx.auth.getUserIdentity());
    const artifact: Doc<"artifacts"> | null = await ctx.runQuery(internal.artifacts.records.getForRunner, {
      artifactId: args.artifactId,
    });
    if (!artifact || artifact.userId !== userId || artifact.type !== "rendered_slide_image") {
      throw new Error("Rendered slide not found");
    }
    const primaryText = args.primaryText.trim();
    if (!primaryText) throw new Error("Primary text is required");

    const refs = getSlideshowArtifactRefs(artifact);
    const slideshow: Doc<"slideshows"> | null = await ctx.runQuery(internal.content.slideshows.getForRunner, {
      slideshowId: refs.slideshowId,
    });
    if (!slideshow || slideshow.userId !== userId) throw new Error("Slideshow not found");
    const spec = normalizeCanonicalSpec(slideshow.spec);
    const slide = spec.slides.find((item) => item.slideId === refs.slideId);
    if (!slide || slide.status === "deleted") throw new Error("Slide not found");
    const textBlocks = textBlocksFromEdit({
      primaryText,
      secondaryText: args.secondaryText,
      bullets: args.bullets,
    });
    const nextSlide: CanonicalSlideshowSlide = {
      ...slide,
      textBlocks,
      renderVersion: slide.renderVersion + 1,
      renderStatus: "rendering",
      failedRenderReason: undefined,
      updatedAt: Date.now(),
    };
    const renderingSpec = {
      ...spec,
      slides: spec.slides.map((item) =>
        item.slideId === refs.slideId ? nextSlide : item
      ),
    };
    await ctx.runMutation(internal.content.slideshows.updateFromRunner, {
      slideshowId: slideshow._id,
      userId,
      spec: renderingSpec,
      revisionHistory: appendRevision(slideshow, {
        type: "update_slide_text",
        slideId: refs.slideId,
      }),
    });
    const rendered: {
      renderedImageUrl?: string;
      publishImageUrl?: string;
      renderDurationMs: number;
      outputFileSize: number;
      publishFileSize: number;
    } = await ctx.runAction(
      internal.content.rendering.rerenderSlideArtifact,
      {
        artifactId: artifact._id,
        userId,
      }
    );
    await ctx.runMutation(internal.content.slideshows.updateFromRunner, {
      slideshowId: slideshow._id,
      userId,
      spec: {
        ...renderingSpec,
        slides: renderingSpec.slides.map((item) =>
          item.slideId === refs.slideId
            ? {
                ...item,
                renderStatus: "succeeded" as const,
                renderDurationMs: rendered.renderDurationMs,
                outputFileSize: rendered.outputFileSize,
                publishFileSize: rendered.publishFileSize,
              }
            : item
        ),
      },
    });

    return rendered;
  },
});

export const execute = internalAction({
  args: { requestId: v.id("contentRequests") },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internal.content.requests.getExecutionContext, {
      requestId: args.requestId,
    });
    if (!context) throw new Error("Content request not found");

    let costUsd = 0;
    try {
      await ctx.runMutation(internal.content.requests.transition, {
        requestId: args.requestId,
        status: "planning",
      });

      const slideCountHint = inferSlideCount(context.request.prompt);
      const textProvider = getModelProvider("openrouter");
      const structured = await textProvider.generateStructured<SlideshowPlannerOutput>({
        systemPrompt: "You are a senior short-form content creative director and slideshow planner.",
        prompt: buildPlannerPrompt({
          prompt: context.request.prompt,
          revisionPrompt: context.request.revisionPrompt,
          brand: context.brand,
          socialAccount: context.socialAccount,
          targetSlideCount: slideCountHint.targetSlideCount,
          slideCountReasoning: slideCountHint.reasoning,
        }),
        schema: slideshowPlanSchema,
        schemaName: "slideshow_create_plan",
        model: process.env.CONTENT_ENGINE_TEXT_MODEL?.trim() || undefined,
        temperature: 0.7,
        parser: (text) => JSON.parse(text) as SlideshowPlannerOutput,
      });
      costUsd = sumCost(costUsd, structured.metadata);
      const plan = normalizePlan(
        structured.object,
        context.request.prompt,
        context.request.revisionPrompt,
        slideCountHint.targetSlideCount
      );

      await ctx.runMutation(internal.content.requests.transition, {
        requestId: args.requestId,
        status: "generating",
        plan,
        summary: plan.creativeBrief,
        costUsd,
      });

      const specArtifactId = await createRequestArtifact(ctx, {
        request: context.request,
        type: "slide_spec",
        title: plan.title,
        data: plan,
        provider: structured.metadata.provider,
        model: structured.metadata.model,
        prompt: context.request.prompt,
      });

      const imageProvider = getModelProvider("fal");
      const imageModel = process.env.CONTENT_ENGINE_IMAGE_MODEL?.trim() || "fal-ai/nano-banana";
      const imageBySlideIndex = new Map<number, { artifactId: Id<"artifacts">; url?: string }>();

      for (const slide of plan.slides) {
        const prompt = providerImagePrompt(slide.visualPrompt, plan.aspectRatio);
        try {
          const image = await imageProvider.generateImage({
            prompt,
            model: imageModel,
            aspectRatio: plan.aspectRatio,
            count: 1,
            metadata: {
              arguments: {
                aspect_ratio: plan.aspectRatio,
                output_format: "png",
              },
            },
          });
          costUsd = sumCost(costUsd, image.metadata);
          const asset = image.images[0] ?? await waitForImageResult(imageProvider, {
            jobId: image.jobId,
            model: image.metadata.model,
          });
          const url = asset?.url ?? asset?.data;
          const artifactId = await createRequestArtifact(ctx, {
            request: context.request,
            type: "image",
            title: `Slide ${slide.index} image`,
            storageUrl: url,
            data: {
              format: "slideshow_background",
              slideIndex: slide.index,
              url,
              jobId: image.jobId,
              status: asset ? "succeeded" : image.status ?? "queued",
              prompt,
            },
            provider: image.metadata.provider,
            model: image.metadata.model,
            prompt,
            parentArtifactIds: [specArtifactId],
          });
          imageBySlideIndex.set(slide.index, { artifactId, url });
        } catch (error) {
          await createRequestArtifact(ctx, {
            request: context.request,
            type: "image_prompt",
            title: `Slide ${slide.index} image prompt`,
            data: {
              slideIndex: slide.index,
              prompt,
              errorMessage: error instanceof Error ? error.message : "Image generation failed",
            },
            provider: "manual",
            prompt,
            parentArtifactIds: [specArtifactId],
          });
        }
      }

      await ctx.runMutation(internal.content.requests.transition, {
        requestId: args.requestId,
        status: "rendering",
        costUsd,
      });

      const dimensions = getSlideDimensions(plan.aspectRatio);
      const canonicalSpec = buildCanonicalSlideshowSpec({
        plan,
        dimensions,
        imageBySlideIndex,
      });
      const slideshowId = await ctx.runMutation(internal.content.slideshows.createFromRunner, {
        userId: context.request.userId,
        brandId: context.request.brandId,
        socialAccountId: context.request.socialAccountId,
        contentRequestId: context.request._id,
        title: canonicalSpec.title,
        caption: canonicalSpec.caption,
        status: "preview",
        spec: canonicalSpec,
        renderVersion: 1,
        revisionHistory: [
          {
            type: "create",
            at: Date.now(),
            sourceSlideSpecArtifactId: specArtifactId,
          },
        ],
      });

      for (const slide of canonicalSpec.slides) {
        const imageArtifactId =
          slide.sourceImageArtifactId ? (slide.sourceImageArtifactId as Id<"artifacts">) : undefined;
        await ctx.runAction(internal.content.rendering.renderSlideForContentRequest, {
          requestId: context.request._id,
          slideshowId,
          slideId: slide.slideId,
          specArtifactId,
          parentArtifactIds: [
            specArtifactId,
            ...(imageArtifactId ? [imageArtifactId] : []),
          ],
        });
      }

      await ctx.runMutation(internal.content.slideshows.updateFromRunner, {
        slideshowId,
        userId: context.request.userId,
        spec: {
          ...canonicalSpec,
          slides: canonicalSpec.slides.map((slide) => ({
            ...slide,
            renderStatus: "succeeded" as const,
          })),
        },
      });

      await ctx.runMutation(internal.content.requests.transition, {
        requestId: args.requestId,
        status: "ready",
        summary: `${plan.slides.length} slide preview ready.`,
        costUsd,
        completedAt: Date.now(),
      });
    } catch (error) {
      await ctx.runMutation(internal.content.requests.transition, {
        requestId: args.requestId,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Content generation failed",
        costUsd,
        completedAt: Date.now(),
      });
    }
  },
});
