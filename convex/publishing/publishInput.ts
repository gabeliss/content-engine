import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { getPublishingProvider } from "../providers";
import type { PublishContentInput, UploadedMedia } from "../providers/publishing";

export type DistributionPublishContext = {
  plan: Doc<"distributionPlans">;
  artifacts: Doc<"artifacts">[];
  socialAccounts: Doc<"socialAccounts">[];
};

function extractArtifactText(artifacts: Doc<"artifacts">[]): string | undefined {
  for (const artifact of artifacts) {
    if (artifact.type !== "caption" && artifact.type !== "text_draft") continue;
    if (!artifact.data || typeof artifact.data !== "object") continue;

    const data = artifact.data as Record<string, unknown>;
    const text = data.text ?? data.caption ?? data.content;
    if (typeof text === "string" && text.trim()) {
      return text.trim();
    }
  }

  return undefined;
}

function inferMimeType(artifact: Doc<"artifacts">): string {
  if (artifact.data && typeof artifact.data === "object") {
    const data = artifact.data as Record<string, unknown>;
    if (typeof data.mimeType === "string") return data.mimeType;
  }
  if (artifact.type === "video") return "video/mp4";
  if (artifact.type === "rendered_slide_image") return "image/png";
  if (!artifact.storageUrl) return "image/png";
  if (artifact.storageUrl.endsWith(".jpg") || artifact.storageUrl.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (artifact.storageUrl.endsWith(".webp")) return "image/webp";
  return "image/png";
}

async function mediaFromArtifact(
  provider: ReturnType<typeof getPublishingProvider>,
  artifact: Doc<"artifacts">
): Promise<UploadedMedia | null> {
  if (
    artifact.type !== "image" &&
    artifact.type !== "video" &&
    artifact.type !== "rendered_slide_image" &&
    artifact.type !== "rendered_asset" &&
    artifact.type !== "thumbnail"
  ) {
    return null;
  }

  const data = artifact.data && typeof artifact.data === "object"
    ? (artifact.data as Record<string, unknown>)
    : {};
  const externalMediaId = data.externalMediaId;
  if (typeof externalMediaId === "string") {
    return {
      externalMediaId,
      url: typeof data.url === "string" ? data.url : artifact.storageUrl,
      metadata: data,
    };
  }

  const source =
    artifact.type === "rendered_slide_image" && typeof data.publishImageUrl === "string"
      ? data.publishImageUrl
      : typeof data.url === "string"
        ? data.url
        : artifact.storageUrl;
  if (!source) return null;

  const mimeType =
    artifact.type === "rendered_slide_image" && typeof data.publishMimeType === "string"
      ? data.publishMimeType
      : typeof data.mimeType === "string"
        ? data.mimeType
        : inferMimeType(artifact);
  if (mimeType === "image/svg+xml") {
    throw new Error("SVG slideshow renders cannot be published. Render raster slide images first.");
  }

  if (source.startsWith("data:")) {
    return await provider.uploadMedia({
      filename: `${artifact._id}.${mimeType.split("/").pop() ?? "bin"}`,
      mimeType,
      data: source,
      encoding: "base64",
    });
  }

  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`Could not fetch artifact media: ${response.status}`);
  }

  return await provider.uploadMedia({
    filename: `${artifact._id}.${mimeType.split("/").pop() ?? "bin"}`,
    mimeType,
    data: await response.arrayBuffer(),
  });
}

export function mapProviderStatus(status: string):
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "canceled" {
  if (
    status === "draft" ||
    status === "scheduled" ||
    status === "publishing" ||
    status === "published" ||
    status === "failed" ||
    status === "canceled"
  ) {
    return status;
  }

  return "publishing";
}

export function compactMetrics(metrics: {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  clicks?: number;
  followersGained?: number;
}) {
  return Object.fromEntries(
    Object.entries(metrics).filter(([, value]) => value !== undefined)
  ) as {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
    clicks?: number;
    followersGained?: number;
  };
}

export async function loadPublishInput(
  provider: ReturnType<typeof getPublishingProvider>,
  context: DistributionPublishContext
): Promise<PublishContentInput> {
  const text = context.plan.caption ?? extractArtifactText(context.artifacts);
  const orderedArtifacts = [...context.artifacts].sort((first, second) => {
    const firstData = first.data && typeof first.data === "object" ? first.data as Record<string, unknown> : {};
    const secondData = second.data && typeof second.data === "object" ? second.data as Record<string, unknown> : {};
    const firstIndex = typeof firstData.slideIndex === "number" ? firstData.slideIndex : first.createdAt;
    const secondIndex = typeof secondData.slideIndex === "number" ? secondData.slideIndex : second.createdAt;
    return firstIndex - secondIndex;
  });
  const hasTikTokTarget = context.socialAccounts.some((account) => account.platform === "tiktok");
  const renderedSlideArtifacts = orderedArtifacts.filter((artifact) => artifact.type === "rendered_slide_image");
  const mediaArtifacts =
    hasTikTokTarget || renderedSlideArtifacts.length > 0
      ? renderedSlideArtifacts
      : orderedArtifacts;
  if (hasTikTokTarget) {
    if (renderedSlideArtifacts.length === 0) {
      throw new Error("TikTok photo carousel publishing requires rendered raster slide image artifacts.");
    }
    const invalidCarouselArtifact = renderedSlideArtifacts.find((artifact) => {
      const data = artifact.data && typeof artifact.data === "object"
        ? artifact.data as Record<string, unknown>
        : {};
      const mimeType = typeof data.publishMimeType === "string"
        ? data.publishMimeType
        : typeof data.mimeType === "string"
          ? data.mimeType
          : inferMimeType(artifact);
      return mimeType === "image/svg+xml" || !mimeType.startsWith("image/");
    });
    if (invalidCarouselArtifact) {
      throw new Error("TikTok photo carousel publishing requires raster slide image artifacts.");
    }
  }
  const media = (
    await Promise.all(
      mediaArtifacts.map((artifact) => mediaFromArtifact(provider, artifact))
    )
  ).filter((item): item is UploadedMedia => item !== null);

  return {
    targets: context.socialAccounts.map((account) => ({
      accountId: account.externalAccountId,
      platform:
        account.metadata &&
        typeof account.metadata === "object" &&
        typeof (account.metadata as Record<string, unknown>).identifier === "string"
          ? ((account.metadata as Record<string, unknown>).identifier as string)
          : account.platform,
      content: text,
      media,
    })),
    text,
    media,
    publishAt: context.plan.scheduledFor,
    timezone: context.plan.timezone,
    metadata: {
      distributionPlanId: context.plan._id,
    },
  };
}

export async function getDistributionPlanContext(
  ctx: ActionCtx,
  id: Id<"distributionPlans">,
  userId: string
): Promise<DistributionPublishContext | null> {
  return await ctx.runQuery(internal.publishing.distributionPlans.getPublishContext, {
    id,
    userId,
  });
}
