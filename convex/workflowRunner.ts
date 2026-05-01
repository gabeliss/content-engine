import { v } from "convex/values";
import { internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  buildStructuredGenerationPrompt,
  defaultStructuredArtifactType,
  defaultStructuredSchema,
  type ArtifactType,
} from "./contentFormatContracts";
import { getModelProvider } from "./providers";
import type { ModelProviderName } from "./providers/model";

type WorkflowStep = Doc<"workflowVersions">["steps"][number];
type ExecutionContext = NonNullable<
  Awaited<ReturnType<typeof getRunExecutionContext>>
>;
type SlideshowSpec = {
  format?: string;
  aspectRatio?: string;
  hook?: string;
  caption?: string;
  slides?: Array<{
    index?: number;
    role?: string;
    headline?: string;
    body?: string;
    visualPrompt?: string;
    layout?: unknown;
  }>;
};

async function getRunExecutionContext(
  ctx: ActionCtx,
  runId: Id<"workflowRuns">
) {
  return await ctx.runQuery(internal.workflowRuns.getExecutionContext, { runId });
}

function getConfig(step: WorkflowStep): Record<string, unknown> {
  return step.config && typeof step.config === "object"
    ? (step.config as Record<string, unknown>)
    : {};
}

function getStringConfig(
  config: Record<string, unknown>,
  key: string
): string | undefined {
  const value = config[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function getModelProviderName(
  value: unknown,
  fallback: ModelProviderName
): ModelProviderName {
  if (
    value === "gemini" ||
    value === "fal" ||
    value === "openrouter" ||
    value === "manual"
  ) {
    return value;
  }

  return fallback;
}

function getArtifactType(value: unknown, fallback: ArtifactType): ArtifactType {
  const artifactTypes: ArtifactType[] = [
    "prompt",
    "text_draft",
    "caption",
    "script",
    "scene_spec",
    "shot_list",
    "image",
    "image_prompt",
    "slide_spec",
    "rendered_slide",
    "rendered_asset",
    "video",
    "thumbnail",
    "publish_payload",
  ];

  return typeof value === "string" && artifactTypes.includes(value as ArtifactType)
    ? (value as ArtifactType)
    : fallback;
}

function buildDefaultPrompt(
  context: ExecutionContext,
  step: WorkflowStep
): string {
  return [
    `Create ${context.workflow.contentFormat} content for ${context.brand.name}.`,
    context.brand.audience ? `Audience: ${context.brand.audience}` : undefined,
    context.brand.voice ? `Voice: ${context.brand.voice}` : undefined,
    context.brand.visualStyle ? `Visual style: ${context.brand.visualStyle}` : undefined,
    context.workflow.description ? `Workflow: ${context.workflow.description}` : undefined,
    `Step: ${step.name}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function artifactIdsForRefs(
  outputs: Record<string, Id<"artifacts">[]>,
  refs?: string[]
): Id<"artifacts">[] {
  if (!refs || refs.length === 0) {
    return Object.values(outputs).flat();
  }

  return refs.flatMap((ref) => outputs[ref] ?? []);
}

async function recordEvent(
  ctx: ActionCtx,
  context: ExecutionContext,
  step: WorkflowStep | null,
  type:
    | "step_started"
    | "step_completed"
    | "model_call"
    | "artifact_created"
    | "approval_requested"
    | "publish_requested"
    | "error",
  message: string,
  data?: unknown
) {
  await ctx.runMutation(internal.workflowRuns.recordEvent, {
    userId: context.run.userId,
    workflowRunId: context.run._id,
    workflowId: context.workflow._id,
    type,
    stepId: step?.id,
    message,
    data,
  });
}

async function createArtifact(
  ctx: ActionCtx,
  context: ExecutionContext,
  step: WorkflowStep,
  args: {
    type: ArtifactType;
    title: string;
    data?: unknown;
    storageUrl?: string;
    provider?: ModelProviderName;
    model?: string;
    prompt?: string;
    parentArtifactIds?: Id<"artifacts">[];
    reviewStatus?: "not_required" | "pending";
  }
): Promise<Id<"artifacts">> {
  const artifactId = await ctx.runMutation(internal.artifacts.createFromRunner, {
    userId: context.run.userId,
    brandId: context.run.brandId,
    workflowId: context.workflow._id,
    workflowRunId: context.run._id,
    parentArtifactIds: args.parentArtifactIds,
    type: args.type,
    title: args.title,
    storageUrl: args.storageUrl,
    data: args.data,
    provider: args.provider,
    model: args.model,
    prompt: args.prompt,
    reviewStatus: args.reviewStatus ?? "not_required",
  });

  await recordEvent(ctx, context, step, "artifact_created", `Created ${args.type}.`, {
    artifactId,
    outputRef: step.outputRef,
  });

  return artifactId;
}

function getJobInfo(artifact: Doc<"artifacts">):
  | {
      jobId: string;
      provider: ModelProviderName;
      model: string;
      prompt?: string;
    }
  | null {
  if (!artifact.data || typeof artifact.data !== "object") return null;

  const data = artifact.data as Record<string, unknown>;
  if (
    typeof data.jobId !== "string" ||
    !artifact.provider ||
    !artifact.model
  ) {
    return null;
  }

  return {
    jobId: data.jobId,
    provider: artifact.provider,
    model: artifact.model,
    prompt: artifact.prompt,
  };
}

async function executeResolveModelJobStep(
  ctx: ActionCtx,
  context: ExecutionContext,
  step: WorkflowStep,
  outputs: Record<string, Id<"artifacts">[]>
): Promise<Id<"artifacts">[]> {
  const jobArtifacts = await getArtifactsForRefs(ctx, outputs, step.inputRefs);
  const resolvedArtifactIds: Id<"artifacts">[] = [];

  for (const jobArtifact of jobArtifacts) {
    const job = getJobInfo(jobArtifact);
    if (!job) continue;

    const provider = getModelProvider(job.provider);
    const result = await provider.getJobStatus({
      jobId: job.jobId,
      model: job.model,
    });

    await recordEvent(ctx, context, step, "model_call", "Polled model job.", result.metadata);

    if (result.status === "failed") {
      await ctx.runMutation(internal.artifacts.updateFromRunner, {
        artifactId: jobArtifact._id,
        userId: context.run.userId,
        data: {
          ...(jobArtifact.data && typeof jobArtifact.data === "object"
            ? (jobArtifact.data as Record<string, unknown>)
            : {}),
          status: result.status,
          errorMessage: result.errorMessage,
        },
      });
      continue;
    }

    if (result.status !== "succeeded") {
      await ctx.runMutation(internal.artifacts.updateFromRunner, {
        artifactId: jobArtifact._id,
        userId: context.run.userId,
        data: {
          ...(jobArtifact.data && typeof jobArtifact.data === "object"
            ? (jobArtifact.data as Record<string, unknown>)
            : {}),
          status: result.status,
        },
      });
      resolvedArtifactIds.push(jobArtifact._id);
      continue;
    }

    for (const [index, asset] of (result.assets ?? []).entries()) {
      const artifactId = await createArtifact(ctx, context, step, {
        type: asset.mimeType.startsWith("video/") ? "video" : "image",
        title: `${jobArtifact.title ?? step.name} result ${index + 1}`,
        storageUrl: asset.url,
        data: {
          url: asset.url,
          data: asset.url ? undefined : asset.data,
          mimeType: asset.mimeType,
          jobId: job.jobId,
        },
        provider: result.metadata.provider,
        model: result.metadata.model,
        prompt: job.prompt,
        parentArtifactIds: [jobArtifact._id],
        reviewStatus: context.workflow.approvalPolicy.mode === "never" ? "not_required" : "pending",
      });
      resolvedArtifactIds.push(artifactId);
    }
  }

  return resolvedArtifactIds;
}

async function executeModelStep(
  ctx: ActionCtx,
  context: ExecutionContext,
  step: WorkflowStep,
  outputs: Record<string, Id<"artifacts">[]>
): Promise<{ artifactIds: Id<"artifacts">[]; costUsd: number }> {
  const config = getConfig(step);
  const modelDefaults = context.version.modelDefaults;
  const prompt = getStringConfig(config, "prompt") ?? buildDefaultPrompt(context, step);
  const parentArtifactIds = artifactIdsForRefs(outputs, step.inputRefs);

  if (step.type === "generate_structured") {
    const providerName = getModelProviderName(
      config.provider,
      modelDefaults?.textProvider ?? "openrouter"
    );
    const provider = getModelProvider(providerName);
    const schema =
      config.schema && typeof config.schema === "object"
        ? config.schema
        : defaultStructuredSchema(context.workflow.contentFormat);
    const structuredPrompt =
      getStringConfig(config, "prompt") ??
      buildStructuredGenerationPrompt({
        format: context.workflow.contentFormat,
        brandName: context.brand.name,
        audience: context.brand.audience,
        voice: context.brand.voice,
        visualStyle: context.brand.visualStyle,
        offer: context.brand.offer,
        constraints: context.brand.constraints,
        workflowName: context.workflow.name,
        workflowDescription: context.workflow.description,
        stepName: step.name,
      });
    const response = await provider.generateStructured({
      prompt: structuredPrompt,
      systemPrompt:
        getStringConfig(config, "systemPrompt") ??
        "You produce production-ready structured content artifacts for an agentic content workflow.",
      model: getStringConfig(config, "model") ?? modelDefaults?.preferredTextModel,
      schema,
      schemaName:
        getStringConfig(config, "schemaName") ??
        `${context.workflow.contentFormat}_spec`,
      metadata:
        config.metadata && typeof config.metadata === "object"
          ? (config.metadata as Record<string, unknown>)
          : undefined,
    });
    const artifactType = getArtifactType(
      config.artifactType,
      defaultStructuredArtifactType(context.workflow.contentFormat)
    );

    await recordEvent(ctx, context, step, "model_call", "Generated structured content.", response.metadata);

    const artifactId = await createArtifact(ctx, context, step, {
      type: artifactType,
      title: step.name,
      data: response.object,
      provider: response.metadata.provider,
      model: response.metadata.model,
      prompt: structuredPrompt,
      parentArtifactIds,
      reviewStatus: context.workflow.approvalPolicy.mode === "never" ? "not_required" : "pending",
    });

    return {
      artifactIds: [artifactId],
      costUsd: response.metadata.costUsd ?? 0,
    };
  }

  if (step.type === "generate_text" || step.type === "create_caption") {
    const providerName = getModelProviderName(
      config.provider,
      modelDefaults?.textProvider ?? "openrouter"
    );
    const provider = getModelProvider(providerName);
    const response = await provider.generateText({
      prompt,
      systemPrompt: getStringConfig(config, "systemPrompt"),
      model: getStringConfig(config, "model") ?? modelDefaults?.preferredTextModel,
      responseFormat:
        config.responseFormat === "json_object" ? { type: "json_object" } : undefined,
      metadata:
        config.metadata && typeof config.metadata === "object"
          ? (config.metadata as Record<string, unknown>)
          : undefined,
    });

    await recordEvent(ctx, context, step, "model_call", "Generated text.", response.metadata);

    const artifactId = await createArtifact(ctx, context, step, {
      type: step.type === "create_caption" ? "caption" : "text_draft",
      title: step.name,
      data: { text: response.text },
      provider: response.metadata.provider,
      model: response.metadata.model,
      prompt,
      parentArtifactIds,
      reviewStatus: context.workflow.approvalPolicy.mode === "never" ? "not_required" : "pending",
    });

    return {
      artifactIds: [artifactId],
      costUsd: response.metadata.costUsd ?? 0,
    };
  }

  if (step.type === "generate_image") {
    const providerName = getModelProviderName(
      config.provider,
      modelDefaults?.mediaProvider ?? "fal"
    );
    const provider = getModelProvider(providerName);
    const artifactIds: Id<"artifacts">[] = [];
    let totalCostUsd = 0;
    const imagePrompts = await getArtifactsForRefs(ctx, outputs, step.inputRefs, "image_prompt");
    const prompts =
      imagePrompts.length > 0
        ? imagePrompts.map((artifact) => ({
            prompt:
              artifact.data &&
              typeof artifact.data === "object" &&
              typeof (artifact.data as Record<string, unknown>).prompt === "string"
                ? ((artifact.data as Record<string, unknown>).prompt as string)
                : artifact.prompt ?? prompt,
            title: artifact.title ?? step.name,
            parentArtifactIds: [artifact._id],
          }))
        : [{ prompt, title: step.name, parentArtifactIds }];

    for (const promptInput of prompts) {
      const response = await provider.generateImage({
        prompt: promptInput.prompt,
        model: getStringConfig(config, "model") ?? modelDefaults?.preferredImageModel,
        aspectRatio: getStringConfig(config, "aspectRatio"),
        count: typeof config.count === "number" ? config.count : undefined,
        metadata:
          config.metadata && typeof config.metadata === "object"
            ? (config.metadata as Record<string, unknown>)
            : undefined,
      });

      totalCostUsd += response.metadata.costUsd ?? 0;
      await recordEvent(ctx, context, step, "model_call", "Requested image generation.", response.metadata);

      for (const [index, image] of response.images.entries()) {
        artifactIds.push(
          await createArtifact(ctx, context, step, {
            type: "image",
            title: `${promptInput.title} image ${index + 1}`,
            storageUrl: image.url,
            data: image.url ? { url: image.url, mimeType: image.mimeType } : image,
            provider: response.metadata.provider,
            model: response.metadata.model,
            prompt: promptInput.prompt,
            parentArtifactIds: promptInput.parentArtifactIds,
            reviewStatus: context.workflow.approvalPolicy.mode === "never" ? "not_required" : "pending",
          })
        );
      }

      if (response.jobId) {
        artifactIds.push(
          await createArtifact(ctx, context, step, {
            type: "image",
            title: `${promptInput.title} image job`,
            data: {
              jobId: response.jobId,
              status: response.status,
            },
            provider: response.metadata.provider,
            model: response.metadata.model,
            prompt: promptInput.prompt,
            parentArtifactIds: promptInput.parentArtifactIds,
          })
        );
      }
    }

    return { artifactIds, costUsd: totalCostUsd };
  }

  if (step.type === "generate_video") {
    const providerName = getModelProviderName(
      config.provider,
      modelDefaults?.mediaProvider ?? "fal"
    );
    const provider = getModelProvider(providerName);
    const response = await provider.generateVideo({
      prompt,
      model: getStringConfig(config, "model") ?? modelDefaults?.preferredVideoModel,
      aspectRatio: getStringConfig(config, "aspectRatio"),
      durationSeconds: typeof config.durationSeconds === "number" ? config.durationSeconds : undefined,
      metadata:
        config.metadata && typeof config.metadata === "object"
          ? (config.metadata as Record<string, unknown>)
          : undefined,
    });

    await recordEvent(ctx, context, step, "model_call", "Requested video generation.", response.metadata);

    const artifactId = await createArtifact(ctx, context, step, {
      type: "video",
      title: `${step.name} job`,
      data: {
        jobId: response.jobId,
        status: response.status,
      },
      provider: response.metadata.provider,
      model: response.metadata.model,
      prompt,
      parentArtifactIds,
    });

    return { artifactIds: [artifactId], costUsd: response.metadata.costUsd ?? 0 };
  }

  throw new Error(`Unsupported model step: ${step.type}`);
}

async function getArtifactsForRefs(
  ctx: ActionCtx,
  outputs: Record<string, Id<"artifacts">[]>,
  refs: string[] | undefined,
  type?: ArtifactType
): Promise<Doc<"artifacts">[]> {
  const artifactIds = artifactIdsForRefs(outputs, refs);
  const artifacts = await Promise.all(
    artifactIds.map((artifactId) =>
      ctx.runQuery(internal.artifacts.getForRunner, { artifactId })
    )
  );

  return artifacts.filter(
    (artifact): artifact is Doc<"artifacts"> =>
      Boolean(artifact && (!type || artifact.type === type))
  );
}

function isSlideshowSpec(value: unknown): value is SlideshowSpec {
  return Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray((value as SlideshowSpec).slides)
  );
}

function getArtifactUrl(artifact: Doc<"artifacts">): string | undefined {
  if (artifact.storageUrl) return artifact.storageUrl;
  if (!artifact.data || typeof artifact.data !== "object") return undefined;

  const data = artifact.data as Record<string, unknown>;
  return typeof data.url === "string" ? data.url : undefined;
}

function getSlideIndexFromImageArtifact(artifact: Doc<"artifacts">): number | undefined {
  const parentTitle = artifact.title ?? "";
  const match = parentTitle.match(/Slide\s+(\d+)/i);
  if (match?.[1]) return Number(match[1]);

  if (!artifact.data || typeof artifact.data !== "object") return undefined;
  const data = artifact.data as Record<string, unknown>;
  const slide = data.slide;
  if (!slide || typeof slide !== "object") return undefined;

  const index = (slide as Record<string, unknown>).index;
  return typeof index === "number" ? index : undefined;
}

function getSlideDimensions(aspectRatio: string): { width: number; height: number } {
  if (aspectRatio === "1:1") return { width: 1080, height: 1080 };
  if (aspectRatio === "4:5") return { width: 1080, height: 1350 };
  if (aspectRatio === "16:9") return { width: 1920, height: 1080 };

  return { width: 1080, height: 1920 };
}

function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapText(value: string | undefined, maxChars: number): string[] {
  if (!value?.trim()) return [];

  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length > maxChars && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = nextLine;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}

async function fetchImageDataUri(url: string | undefined): Promise<string | undefined> {
  if (!url) return undefined;

  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;

    const contentType = response.headers.get("content-type") ?? "image/png";
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    const chunkSize = 8192;

    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
    }

    return `data:${contentType};base64,${btoa(binary)}`;
  } catch {
    return undefined;
  }
}

function renderSlideSvg(args: {
  dimensions: { width: number; height: number };
  backgroundImageDataUri?: string;
  headline?: string;
  body?: string;
  role?: string;
  slideIndex: number;
}): string {
  const { width, height } = args.dimensions;
  const margin = Math.round(width * 0.075);
  const panelHeight = Math.round(height * 0.36);
  const panelY = height - panelHeight;
  const headlineSize = Math.round(width * 0.065);
  const bodySize = Math.round(width * 0.036);
  const eyebrowSize = Math.round(width * 0.026);
  const maxHeadlineChars = width > height ? 34 : 21;
  const maxBodyChars = width > height ? 72 : 42;
  const headlineLines = wrapText(args.headline, maxHeadlineChars).slice(0, 4);
  const bodyLines = wrapText(args.body, maxBodyChars).slice(0, 4);
  const background = args.backgroundImageDataUri
    ? `<image href="${args.backgroundImageDataUri}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" />`
    : `<linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#203428" />
        <stop offset="48%" stop-color="#877c5e" />
        <stop offset="100%" stop-color="#f2bd5f" />
      </linearGradient>
      <rect width="${width}" height="${height}" fill="url(#background)" />`;
  const headlineText = headlineLines
    .map(
      (line, index) =>
        `<tspan x="${margin}" dy="${index === 0 ? 0 : headlineSize * 1.08}">${escapeXml(line)}</tspan>`
    )
    .join("");
  const bodyText = bodyLines
    .map(
      (line, index) =>
        `<tspan x="${margin}" dy="${index === 0 ? 0 : bodySize * 1.35}">${escapeXml(line)}</tspan>`
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Rendered slide ${args.slideIndex}">
    <defs>
      <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#101712" stop-opacity="0" />
        <stop offset="38%" stop-color="#101712" stop-opacity="0.74" />
        <stop offset="100%" stop-color="#101712" stop-opacity="0.96" />
      </linearGradient>
    </defs>
    ${background}
    <rect width="${width}" height="${height}" fill="#101712" opacity="${args.backgroundImageDataUri ? 0.18 : 0}" />
    <rect y="${panelY}" width="${width}" height="${panelHeight}" fill="url(#panel)" />
    <text x="${margin}" y="${panelY + margin * 0.9}" fill="#f8f3e7" font-family="Georgia, 'Times New Roman', serif" font-size="${eyebrowSize}" font-weight="700" letter-spacing="${Math.round(width * 0.004)}">${escapeXml(args.role ?? `Slide ${args.slideIndex}`)}</text>
    <text x="${margin}" y="${panelY + margin * 1.72}" fill="#ffffff" font-family="Georgia, 'Times New Roman', serif" font-size="${headlineSize}" font-weight="800" letter-spacing="-2">${headlineText}</text>
    <text x="${margin}" y="${panelY + margin * 1.95 + headlineLines.length * headlineSize * 1.08}" fill="#f2eee3" font-family="Arial, sans-serif" font-size="${bodySize}" font-weight="500">${bodyText}</text>
  </svg>`;
}

async function executeRenderSlideshowStep(
  ctx: ActionCtx,
  context: ExecutionContext,
  step: WorkflowStep,
  outputs: Record<string, Id<"artifacts">[]>
): Promise<Id<"artifacts">[]> {
  const slideSpecs = await getArtifactsForRefs(ctx, outputs, step.inputRefs, "slide_spec");
  const images = await getArtifactsForRefs(ctx, outputs, step.inputRefs, "image");
  const imageBySlideIndex = new Map<number, Doc<"artifacts">>();

  for (const image of images) {
    const slideIndex = getSlideIndexFromImageArtifact(image);
    if (slideIndex && !imageBySlideIndex.has(slideIndex)) {
      imageBySlideIndex.set(slideIndex, image);
    }
  }

  const artifactIds: Id<"artifacts">[] = [];
  for (const slideSpecArtifact of slideSpecs) {
    if (!isSlideshowSpec(slideSpecArtifact.data)) continue;

    const aspectRatio = slideSpecArtifact.data.aspectRatio ?? "9:16";
    const dimensions = getSlideDimensions(aspectRatio);

    for (const slide of slideSpecArtifact.data.slides ?? []) {
      const slideIndex = slide.index ?? artifactIds.length + 1;
      const image = imageBySlideIndex.get(slideIndex);
      const imageUrl = image ? getArtifactUrl(image) : undefined;
      const backgroundImageDataUri = await fetchImageDataUri(imageUrl);
      const svg = renderSlideSvg({
        dimensions,
        backgroundImageDataUri,
        headline: slide.headline,
        body: slide.body,
        role: slide.role,
        slideIndex,
      });
      const storageId = await ctx.storage.store(
        new Blob([svg], { type: "image/svg+xml" })
      );
      const renderedImageUrl = (await ctx.storage.getUrl(storageId)) ?? undefined;

      artifactIds.push(
        await createArtifact(ctx, context, step, {
          type: "rendered_slide",
          title: `Rendered slide ${slideIndex}`,
          storageUrl: renderedImageUrl,
          data: {
            format: "rendered_slide",
            mimeType: "image/svg+xml",
            slideIndex,
            aspectRatio,
            dimensions,
            renderedImageUrl,
            storageId,
            backgroundImageUrl: imageUrl,
            backgroundEmbedded: Boolean(backgroundImageDataUri),
            headline: slide.headline,
            body: slide.body,
            role: slide.role,
            visualPrompt: slide.visualPrompt,
            layout: slide.layout,
            sourceSlideSpecArtifactId: slideSpecArtifact._id,
            sourceImageArtifactId: image?._id,
          },
          parentArtifactIds: [
            slideSpecArtifact._id,
            ...(image ? [image._id] : []),
          ],
          reviewStatus: context.workflow.approvalPolicy.mode === "never" ? "not_required" : "pending",
        })
      );
    }
  }

  return artifactIds;
}

async function executeImagePromptStep(
  ctx: ActionCtx,
  context: ExecutionContext,
  step: WorkflowStep,
  outputs: Record<string, Id<"artifacts">[]>
): Promise<Id<"artifacts">[]> {
  const slideSpecs = await getArtifactsForRefs(ctx, outputs, step.inputRefs, "slide_spec");
  const artifactIds: Id<"artifacts">[] = [];

  for (const slideSpecArtifact of slideSpecs) {
    if (!isSlideshowSpec(slideSpecArtifact.data)) continue;

    for (const slide of slideSpecArtifact.data.slides ?? []) {
      if (!slide.visualPrompt?.trim()) continue;

      artifactIds.push(
        await createArtifact(ctx, context, step, {
          type: "image_prompt",
          title: `Slide ${slide.index ?? artifactIds.length + 1} image prompt`,
          data: {
            prompt: slide.visualPrompt,
            slide,
            aspectRatio: slideSpecArtifact.data.aspectRatio,
            hook: slideSpecArtifact.data.hook,
          },
          prompt: slide.visualPrompt,
          parentArtifactIds: [slideSpecArtifact._id],
          reviewStatus: context.workflow.approvalPolicy.mode === "never" ? "not_required" : "pending",
        })
      );
    }
  }

  return artifactIds;
}

async function executeDistributionPlanStep(
  ctx: ActionCtx,
  context: ExecutionContext,
  step: WorkflowStep,
  outputs: Record<string, Id<"artifacts">[]>
): Promise<Id<"artifacts">[]> {
  const config = getConfig(step);
  const artifactIds = artifactIdsForRefs(outputs, step.inputRefs);
  const socialAccountIds = context.run.socialAccountId ? [context.run.socialAccountId] : [];
  const scheduledFor = typeof config.scheduledFor === "number" ? config.scheduledFor : undefined;
  const timezone = getStringConfig(config, "timezone");

  const planId = await ctx.runMutation(internal.distributionPlans.createFromRunner, {
    userId: context.run.userId,
    brandId: context.run.brandId,
    workflowId: context.workflow._id,
    workflowRunId: context.run._id,
    artifactIds,
    socialAccountIds,
    provider: context.workflow.publishingPolicy.provider,
    status: context.workflow.approvalPolicy.mode === "never" ? "draft" : "waiting_for_approval",
    scheduledFor,
    timezone,
    providerPayload: {
      stepId: step.id,
      autoPublish: context.workflow.publishingPolicy.autoPublish,
      defaultPlatforms: context.workflow.publishingPolicy.defaultPlatforms,
    },
  });

  const artifactId = await createArtifact(ctx, context, step, {
    type: "publish_payload",
    title: step.name,
    data: {
      distributionPlanId: planId,
      artifactIds,
      socialAccountIds,
    },
    parentArtifactIds: artifactIds,
    reviewStatus: context.workflow.approvalPolicy.mode === "never" ? "not_required" : "pending",
  });

  return [artifactId];
}

export const executeRun = internalAction({
  args: { runId: v.id("workflowRuns") },
  handler: async (ctx, args) => {
    const context = await getRunExecutionContext(ctx, args.runId);
    if (!context) {
      throw new Error("Workflow run context not found");
    }

    const outputs: Record<string, Id<"artifacts">[]> = {};
    let totalCostUsd = 0;

    await ctx.runMutation(internal.workflowRuns.transitionRun, {
      runId: context.run._id,
      status: "running",
    });

    try {
      for (const step of context.version.steps) {
        await ctx.runMutation(internal.workflowRuns.transitionRun, {
          runId: context.run._id,
          status: "running",
          currentStepId: step.id,
          costUsd: totalCostUsd,
        });
        await recordEvent(ctx, context, step, "step_started", `Started ${step.name}.`);

        let artifactIds: Id<"artifacts">[] = [];
        let costUsd = 0;

        if (
          step.type === "generate_text" ||
          step.type === "generate_structured" ||
          step.type === "create_caption" ||
          step.type === "generate_image" ||
          step.type === "generate_video"
        ) {
          const result = await executeModelStep(ctx, context, step, outputs);
          artifactIds = result.artifactIds;
          costUsd = result.costUsd;
        } else if (step.type === "create_distribution_plan") {
          artifactIds = await executeDistributionPlanStep(ctx, context, step, outputs);
        } else if (step.type === "create_image_prompts") {
          artifactIds = await executeImagePromptStep(ctx, context, step, outputs);
        } else if (step.type === "resolve_model_job") {
          artifactIds = await executeResolveModelJobStep(ctx, context, step, outputs);
        } else if (step.type === "render_slideshow") {
          artifactIds = await executeRenderSlideshowStep(ctx, context, step, outputs);
        } else if (step.type === "request_approval") {
          await recordEvent(ctx, context, step, "approval_requested", "Workflow is waiting for approval.");
          await ctx.runMutation(internal.workflowRuns.transitionRun, {
            runId: context.run._id,
            status: "waiting_for_approval",
            currentStepId: step.id,
            costUsd: totalCostUsd,
          });
          return;
        } else {
          throw new Error(`Unsupported workflow step type: ${step.type}`);
        }

        totalCostUsd += costUsd;
        if (step.outputRef) {
          outputs[step.outputRef] = artifactIds;
        }

        await recordEvent(ctx, context, step, "step_completed", `Completed ${step.name}.`, {
          artifactIds,
          costUsd,
        });
      }

      await ctx.runMutation(internal.workflowRuns.transitionRun, {
        runId: context.run._id,
        status: "completed",
        summary: `Completed ${context.version.steps.length} workflow steps.`,
        costUsd: totalCostUsd,
        completedAt: Date.now(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Workflow runner failed.";
      await recordEvent(ctx, context, null, "error", message);
      await ctx.runMutation(internal.workflowRuns.transitionRun, {
        runId: context.run._id,
        status: "failed",
        costUsd: totalCostUsd,
        errorMessage: message,
        completedAt: Date.now(),
      });
    }
  },
});
