import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { requireBetaAccessForAction } from "../auth/actionAccess";
import { ensureCurrentUser, requireBetaAccess } from "../auth/users";
import {
  videoAnalysisModeValidator,
  videoAnalysisSourcePlatformValidator,
  videoAnalysisStatusValidator,
} from "../validators";
import {
  requireWorkspaceMember,
  resolveWritableWorkspace,
} from "../workspaces/workspaces";

const DEFAULT_ANALYSIS_MODEL = "gemini-2.5-flash";
const GEMINI_PROVIDER = "gemini";
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

type VideoAnalysisJob = Doc<"videoAnalysisJobs">;
type VideoAnalysisResult = {
  title?: string;
  summary?: string;
  transcript?: {
    text?: string;
    confidenceNotes?: string;
    notablePhrases?: string[];
  };
  visuals?: {
    style?: string;
    setting?: string;
    subjects?: string[];
    cameraAndEditing?: string;
    onScreenText?: string[];
    sceneBreakdown?: Array<{
      timestamp?: string;
      description?: string;
      visualNotes?: string;
      audioNotes?: string;
      creatorPurpose?: string;
    }>;
  };
  audio?: {
    speechDelivery?: string;
    musicAndSound?: string;
    extractableNotes?: string[];
  };
  creativeAnalysis?: {
    hook?: string;
    structure?: string[];
    pacing?: string;
    whyItWorks?: string[];
    risksToAvoid?: string[];
  };
  reuseBrief?: {
    copyablePattern?: string;
    originalVersionPrompt?: string;
    shotList?: string[];
    scriptTemplate?: string;
    generationPrompt?: string;
  };
};

function currentUserId(identity: { subject: string } | null) {
  if (!identity) throw new Error("Not authenticated");
  return identity.subject;
}

function cleanOptionalText(value?: string) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function getGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required for video analysis");
  }

  return apiKey;
}

function sourcePlatformForUrl(urlValue: string): VideoAnalysisJob["sourcePlatform"] {
  try {
    const hostname = new URL(urlValue).hostname.toLowerCase();
    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) return "youtube";
    if (hostname.includes("tiktok.com")) return "tiktok";
    if (hostname.includes("instagram.com")) return "instagram";
    if (hostname.includes("facebook.com") || hostname.includes("fb.watch")) return "facebook";
    if (/\.(mp4|mov|webm|m4v|mp3|wav|m4a)(\?|$)/i.test(urlValue)) return "direct_file";
    return "unknown";
  } catch {
    throw new Error("Paste a valid video URL");
  }
}

function buildAnalysisPrompt(job: VideoAnalysisJob) {
  const modeInstructions: Record<VideoAnalysisJob["mode"], string> = {
    inspiration:
      "Extract everything important: transcript, on-screen text, visual scenes, audio cues, hook, structure, pacing, creator strategy, reusable patterns, and a practical brief for making an original version. If the source is a tutorial, also capture steps, tools, commands, settings, code, and implementation caveats.",
    technical:
      "Prioritize exact steps, commands, UI actions, tools, code, file paths, settings, and implementation caveats shown or mentioned.",
    transcript:
      "Prioritize a clean transcript, speaker/audio notes, on-screen text, and timestamps. Still include a concise visual scene breakdown.",
  };

  return [
    "Analyze this source for a creator using Content Engine.",
    modeInstructions[job.mode],
    "Default behavior is comprehensive analysis. The user should not need to choose between transcript, visuals, audio, or creative strategy.",
    "Return only valid JSON. Do not wrap it in Markdown.",
    "If details are not visible or audible, use an empty string or empty array instead of guessing.",
    "For transcript text, preserve meaningful wording but remove filler only when it improves readability.",
    "For scene timestamps, use approximate mm:ss timestamps.",
    job.customPrompt ? `User focus: ${job.customPrompt}` : "",
    "",
    "JSON shape:",
    JSON.stringify({
      title: "Short descriptive title",
      summary: "Plain-language summary of what happens and why it matters",
      platformRead: "What platform/style this resembles",
      durationEstimate: "Approximate duration if detectable",
      transcript: {
        text: "Speech transcript or empty string",
        confidenceNotes: "Any uncertainty about speech/audio",
        notablePhrases: ["phrases worth reusing structurally"],
      },
      visuals: {
        style: "Visual style and art direction",
        setting: "Primary environment",
        subjects: ["people, products, props, UI, or scenes shown"],
        cameraAndEditing: "Framing, camera movement, cuts, overlays, captions",
        onScreenText: ["visible text"],
        sceneBreakdown: [
          {
            timestamp: "00:00",
            description: "What happens",
            visualNotes: "Composition, text, motion, objects",
            audioNotes: "Speech, music, sound, silence",
            creatorPurpose: "Why this moment exists",
          },
        ],
      },
      audio: {
        speechDelivery: "Voice, tone, speed, speaker dynamics",
        musicAndSound: "Music, sound effects, audio bed, rhythm",
        extractableNotes: ["audio cues or reusable timing notes"],
      },
      creativeAnalysis: {
        hook: "What makes the first moment work",
        structure: ["beat-by-beat narrative structure"],
        pacing: "How fast the piece moves",
        whyItWorks: ["specific strengths"],
        risksToAvoid: ["things to avoid copying directly or weak points"],
      },
      reuseBrief: {
        copyablePattern: "The reusable pattern without copying the creator's IP",
        originalVersionPrompt: "Prompt for making an original concept from this pattern",
        shotList: ["shots to create an original version"],
        scriptTemplate: "Reusable script template",
        generationPrompt: "Detailed prompt another LLM/video tool can use",
      },
    }),
  ].filter(Boolean).join("\n");
}

function stripJsonFence(text: string) {
  return text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function parseAnalysisResult(text: string): VideoAnalysisResult {
  const parsed = JSON.parse(stripJsonFence(text)) as VideoAnalysisResult;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Gemini returned an invalid analysis object");
  }

  return parsed;
}

function analysisTitle(result: VideoAnalysisResult, fallback: string) {
  return cleanOptionalText(result.title)?.slice(0, 120) ?? fallback;
}

function analysisSummary(result: VideoAnalysisResult) {
  return cleanOptionalText(result.summary)?.slice(0, 1400);
}

function analysisTranscript(result: VideoAnalysisResult) {
  return cleanOptionalText(result.transcript?.text);
}

async function geminiGenerateContent(args: {
  contents: unknown[];
  generationConfig?: Record<string, unknown>;
  model?: string;
}) {
  const apiKey = getGeminiApiKey();
  const model = args.model ?? DEFAULT_ANALYSIS_MODEL;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: args.contents,
        generationConfig: args.generationConfig,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini analysis failed: ${await response.text()}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("Gemini returned an empty response");

  return { data, text };
}

async function uploadFileToGemini(args: {
  bytes: ArrayBuffer;
  displayName: string;
  mimeType: string;
}) {
  const apiKey = getGeminiApiKey();
  const startResponse = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(args.bytes.byteLength),
        "X-Goog-Upload-Header-Content-Type": args.mimeType,
        "X-Goog-Upload-Protocol": "resumable",
      },
      body: JSON.stringify({
        file: { display_name: args.displayName },
      }),
    }
  );

  if (!startResponse.ok) {
    throw new Error(`Gemini file upload failed to start: ${await startResponse.text()}`);
  }

  const uploadUrl = startResponse.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Gemini did not return an upload URL");

  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(args.bytes.byteLength),
      "Content-Type": args.mimeType,
      "X-Goog-Upload-Command": "upload, finalize",
      "X-Goog-Upload-Offset": "0",
    },
    body: args.bytes,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Gemini file upload failed: ${await uploadResponse.text()}`);
  }

  const data = await uploadResponse.json();
  const file = data.file;
  if (!file?.uri) throw new Error("Gemini file upload returned no file URI");

  return {
    mimeType: file.mimeType ?? args.mimeType,
    uri: file.uri as string,
  };
}

async function analyzeYoutubeUrl(job: VideoAnalysisJob) {
  if (!job.sourceUrl) throw new Error("Source URL is missing");
  const prompt = buildAnalysisPrompt(job);
  const response = await geminiGenerateContent({
    contents: [
      {
        role: "user",
        parts: [
          { fileData: { fileUri: job.sourceUrl } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.25,
      maxOutputTokens: 8192,
    },
    model: job.model,
  });

  return {
    raw: response.data,
    result: parseAnalysisResult(response.text),
  };
}

async function analyzeUploadedSource(job: VideoAnalysisJob, storageUrl: string) {
  const response = await fetch(storageUrl);
  if (!response.ok) {
    throw new Error(`Could not fetch uploaded media: ${response.status}`);
  }

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("Upload is too large for inline analysis. Use a clip under 100 MB.");
  }

  const mimeType = job.mimeType ?? response.headers.get("content-type") ?? "video/mp4";
  const geminiFile = await uploadFileToGemini({
    bytes,
    displayName: job.fileName ?? "Content Engine analysis upload",
    mimeType,
  });
  const prompt = buildAnalysisPrompt(job);
  const analysis = await geminiGenerateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            fileData: {
              fileUri: geminiFile.uri,
              mimeType: geminiFile.mimeType,
            },
          },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.25,
      maxOutputTokens: 8192,
    },
    model: job.model,
  });

  return {
    raw: analysis.data,
    result: parseAnalysisResult(analysis.text),
  };
}

async function hasJobAccess(
  ctx: QueryCtx | MutationCtx,
  job: VideoAnalysisJob,
  userId: string
) {
  if (job.workspaceId) {
    await requireWorkspaceMember(ctx, job.workspaceId, userId);
    return true;
  }

  return job.userId === userId;
}

export const list = query({
  args: { workspaceId: v.optional(v.id("workspaces")) },
  handler: async (ctx, args) => {
    const identity = await requireBetaAccess(ctx);
    const userId = currentUserId(identity);

    if (args.workspaceId) {
      await requireWorkspaceMember(ctx, args.workspaceId, userId);
      return await ctx.db
        .query("videoAnalysisJobs")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
        .order("desc")
        .take(30);
    }

    return await ctx.db
      .query("videoAnalysisJobs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(30);
  },
});

export const get = query({
  args: { id: v.id("videoAnalysisJobs") },
  handler: async (ctx, args) => {
    const identity = await requireBetaAccess(ctx);
    const userId = currentUserId(identity);
    const job = await ctx.db.get(args.id);
    if (!job || !(await hasJobAccess(ctx, job, userId))) return null;
    return job;
  },
});

export const listQuestions = query({
  args: { jobId: v.id("videoAnalysisJobs") },
  handler: async (ctx, args) => {
    const identity = await requireBetaAccess(ctx);
    const userId = currentUserId(identity);
    const job = await ctx.db.get(args.jobId);
    if (!job || !(await hasJobAccess(ctx, job, userId))) return [];

    return await ctx.db
      .query("videoAnalysisQuestions")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await ensureCurrentUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const createFromUrl = mutation({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    url: v.string(),
    mode: v.optional(videoAnalysisModeValidator),
    customPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, defaultWorkspace } = await ensureCurrentUser(ctx);
    const url = args.url.trim();
    if (!url) throw new Error("Video URL is required");
    const platform = sourcePlatformForUrl(url);
    const workspace = args.workspaceId
      ? await resolveWritableWorkspace(ctx, userId, args.workspaceId)
      : defaultWorkspace;
    if (!workspace) throw new Error("Workspace not found");

    const now = Date.now();
    const jobId = await ctx.db.insert("videoAnalysisJobs", {
      userId,
      workspaceId: workspace._id,
      sourceType: "url",
      sourcePlatform: platform,
      sourceUrl: url,
      provider: GEMINI_PROVIDER,
      model: DEFAULT_ANALYSIS_MODEL,
      mode: args.mode ?? "inspiration",
      customPrompt: cleanOptionalText(args.customPrompt),
      status: "queued",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.analyze.videoAnalysis.executeJob, { jobId });
    return jobId;
  },
});

export const createFromUpload = mutation({
  args: {
    workspaceId: v.optional(v.id("workspaces")),
    storageId: v.id("_storage"),
    fileName: v.optional(v.string()),
    mimeType: v.optional(v.string()),
    byteLength: v.optional(v.number()),
    mode: v.optional(videoAnalysisModeValidator),
    customPrompt: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    sourcePlatform: v.optional(videoAnalysisSourcePlatformValidator),
  },
  handler: async (ctx, args) => {
    const { userId, defaultWorkspace } = await ensureCurrentUser(ctx);
    if (args.byteLength && args.byteLength > MAX_UPLOAD_BYTES) {
      throw new Error("Upload a clip under 100 MB for analysis");
    }
    const workspace = args.workspaceId
      ? await resolveWritableWorkspace(ctx, userId, args.workspaceId)
      : defaultWorkspace;
    if (!workspace) throw new Error("Workspace not found");

    const storageUrl = await ctx.storage.getUrl(args.storageId);
    if (!storageUrl) throw new Error("Uploaded file not found");

    const now = Date.now();
    const jobId = await ctx.db.insert("videoAnalysisJobs", {
      userId,
      workspaceId: workspace._id,
      sourceType: "upload",
      sourcePlatform: args.sourcePlatform ?? "unknown",
      sourceUrl: cleanOptionalText(args.sourceUrl),
      storageId: args.storageId,
      storageUrl,
      fileName: cleanOptionalText(args.fileName),
      mimeType: cleanOptionalText(args.mimeType),
      byteLength: args.byteLength,
      provider: GEMINI_PROVIDER,
      model: DEFAULT_ANALYSIS_MODEL,
      mode: args.mode ?? "inspiration",
      customPrompt: cleanOptionalText(args.customPrompt),
      status: "queued",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.analyze.videoAnalysis.executeJob, { jobId });
    return jobId;
  },
});

export const saveAsInspiration = mutation({
  args: { id: v.id("videoAnalysisJobs") },
  handler: async (ctx, args) => {
    const identity = await requireBetaAccess(ctx);
    const userId = currentUserId(identity);
    const job = await ctx.db.get(args.id);
    if (!job || !(await hasJobAccess(ctx, job, userId))) {
      throw new Error("Analysis not found");
    }

    await ctx.db.patch(args.id, {
      savedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const getForExecution = internalQuery({
  args: { jobId: v.id("videoAnalysisJobs") },
  handler: async (ctx, args) => await ctx.db.get(args.jobId),
});

export const getAccessibleForAction = internalQuery({
  args: {
    jobId: v.id("videoAnalysisJobs"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || !(await hasJobAccess(ctx, job, args.userId))) return null;
    return job;
  },
});

export const patchJob = internalMutation({
  args: {
    jobId: v.id("videoAnalysisJobs"),
    status: v.optional(videoAnalysisStatusValidator),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    transcript: v.optional(v.string()),
    result: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const patch: Partial<VideoAnalysisJob> = { updatedAt: Date.now() };
    if (args.status) patch.status = args.status;
    if (args.title !== undefined) patch.title = args.title;
    if (args.summary !== undefined) patch.summary = args.summary;
    if (args.transcript !== undefined) patch.transcript = args.transcript;
    if (args.result !== undefined) patch.result = args.result;
    if (args.errorMessage !== undefined) patch.errorMessage = args.errorMessage;
    if (args.startedAt !== undefined) patch.startedAt = args.startedAt;
    if (args.completedAt !== undefined) patch.completedAt = args.completedAt;
    await ctx.db.patch(args.jobId, patch);
  },
});

export const executeJob = internalAction({
  args: { jobId: v.id("videoAnalysisJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.runQuery(internal.analyze.videoAnalysis.getForExecution, {
      jobId: args.jobId,
    });
    if (!job) return;

    await ctx.runMutation(internal.analyze.videoAnalysis.patchJob, {
      jobId: args.jobId,
      status: "running",
      startedAt: Date.now(),
      errorMessage: undefined,
    });

    try {
      if (job.sourceType === "url" && job.sourcePlatform !== "youtube") {
        throw new Error(
          "Direct URL analysis currently supports YouTube. Upload the TikTok, Instagram, Facebook, YouTube, or source clip for full transcript and visual analysis."
        );
      }

      const analysis = job.sourceType === "upload"
        ? await analyzeUploadedSource(job, job.storageUrl ?? "")
        : await analyzeYoutubeUrl(job);
      const fallbackTitle = job.fileName ?? job.sourceUrl ?? "Video analysis";

      await ctx.runMutation(internal.analyze.videoAnalysis.patchJob, {
        jobId: args.jobId,
        status: "completed",
        title: analysisTitle(analysis.result, fallbackTitle),
        summary: analysisSummary(analysis.result),
        transcript: analysisTranscript(analysis.result),
        result: {
          ...analysis.result,
          rawProviderResponse: analysis.raw,
        },
        completedAt: Date.now(),
      });
    } catch (error) {
      await ctx.runMutation(internal.analyze.videoAnalysis.patchJob, {
        jobId: args.jobId,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Video analysis failed",
        completedAt: Date.now(),
      });
    }
  },
});

export const createQuestion = internalMutation({
  args: {
    jobId: v.id("videoAnalysisJobs"),
    userId: v.string(),
    workspaceId: v.optional(v.id("workspaces")),
    question: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("videoAnalysisQuestions", {
      userId: args.userId,
      workspaceId: args.workspaceId,
      jobId: args.jobId,
      question: args.question,
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const patchQuestion = internalMutation({
  args: {
    questionId: v.id("videoAnalysisQuestions"),
    status: videoAnalysisStatusValidator,
    answer: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.questionId, {
      status: args.status,
      answer: args.answer,
      errorMessage: args.errorMessage,
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const askQuestion = action({
  args: {
    jobId: v.id("videoAnalysisJobs"),
    question: v.string(),
  },
  handler: async (ctx, args): Promise<{ questionId: Id<"videoAnalysisQuestions">; answer: string }> => {
    const identity = await requireBetaAccessForAction(ctx);
    const userId = identity.subject;
    const question = args.question.trim();
    if (!question) throw new Error("Question is required");

    const job: VideoAnalysisJob | null = await ctx.runQuery(internal.analyze.videoAnalysis.getAccessibleForAction, {
      jobId: args.jobId,
      userId,
    });
    if (!job) {
      throw new Error("Analysis not found");
    }
    if (job.status !== "completed") {
      throw new Error("Wait for the analysis to finish before asking questions");
    }

    const questionId: Id<"videoAnalysisQuestions"> = await ctx.runMutation(
      internal.analyze.videoAnalysis.createQuestion,
      {
        jobId: args.jobId,
        userId,
        workspaceId: job.workspaceId,
        question,
      }
    );

    try {
      const context = JSON.stringify(job.result ?? {}, null, 2).slice(0, 120_000);
      const response = await geminiGenerateContent({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: [
                  "Answer the user's question using this saved video analysis context.",
                  "Be specific. If the context does not contain enough evidence, say what is missing.",
                  "",
                  `Question: ${question}`,
                  "",
                  "Analysis context:",
                  context,
                ].join("\n"),
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 1600,
        },
        model: job.model,
      });

      await ctx.runMutation(internal.analyze.videoAnalysis.patchQuestion, {
        questionId,
        status: "completed",
        answer: response.text,
      });

      return { questionId, answer: response.text };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Question failed";
      await ctx.runMutation(internal.analyze.videoAnalysis.patchQuestion, {
        questionId,
        status: "failed",
        errorMessage,
      });
      throw new Error(errorMessage);
    }
  },
});
