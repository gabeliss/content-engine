import { useAction, useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  AudioLines,
  CheckCircle2,
  Clipboard,
  Eye,
  FileText,
  HelpCircle,
  Layers3,
  Link as LinkIcon,
  MessageSquare,
  RefreshCw,
  Save,
  Sparkles,
  Upload,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { LoadingSignal, LoadingState, Page } from "../components/ui";
import { useWorkspace } from "../contexts/WorkspaceContext";

type AnalysisJob = Doc<"videoAnalysisJobs">;
type AnalysisQuestion = Doc<"videoAnalysisQuestions">;
type SourceMode = "url" | "upload";

type Scene = {
  timestamp?: string;
  description?: string;
  visualNotes?: string;
  audioNotes?: string;
  creatorPurpose?: string;
};

type AnalysisResult = {
  title?: string;
  summary?: string;
  platformRead?: string;
  durationEstimate?: string;
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
    sceneBreakdown?: Scene[];
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

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function resultFromJob(job?: AnalysisJob | null): AnalysisResult {
  return isRecord(job?.result) ? (job.result as AnalysisResult) : {};
}

function formatDateTime(value?: number) {
  if (!value) return "Not started";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(status: AnalysisJob["status"]) {
  if (status === "queued") return "Queued";
  if (status === "running") return "Analyzing";
  if (status === "completed") return "Ready";
  return "Failed";
}

function statusClass(status: AnalysisJob["status"]) {
  if (status === "completed") return "text-[var(--color-accent-strong)]";
  if (status === "failed") return "text-[oklch(52%_0.18_25)]";
  return "text-[var(--color-primary)]";
}

function sourceLabel(job: AnalysisJob) {
  if (job.sourceType === "upload") return job.fileName ?? "Uploaded media";
  if (job.sourcePlatform === "youtube") return "YouTube URL";
  if (job.sourcePlatform === "tiktok") return "TikTok URL";
  if (job.sourcePlatform === "instagram") return "Instagram URL";
  if (job.sourcePlatform === "facebook") return "Facebook URL";
  return "Source URL";
}

function sourcePlatformForUrl(value: string): AnalysisJob["sourcePlatform"] {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) return "youtube";
    if (hostname.includes("tiktok.com")) return "tiktok";
    if (hostname.includes("instagram.com")) return "instagram";
    if (hostname.includes("facebook.com") || hostname.includes("fb.watch")) return "facebook";
    return "unknown";
  } catch {
    return "unknown";
  }
}

function textOrFallback(value: string | undefined, fallback = "Not detected") {
  return value?.trim() || fallback;
}

function ListSection({
  empty = "Nothing detected.",
  items,
}: {
  empty?: string;
  items?: string[];
}) {
  const rows = items?.filter((item) => item.trim()) ?? [];
  if (!rows.length) {
    return <p className="m-0 text-[0.86rem] leading-[1.55] text-[var(--color-muted)]">{empty}</p>;
  }

  return (
    <ul className="m-0 grid list-none gap-[var(--space-2)] p-0">
      {rows.map((item, index) => (
        <li
          className="grid grid-cols-[1.35rem_minmax(0,1fr)] gap-[var(--space-2)] text-[0.88rem] leading-[1.5] text-[var(--color-ink)]"
          key={`${item}-${index}`}
        >
          <span className="mt-[0.34rem] size-1.5 rounded-full bg-[var(--color-primary)]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function AnalysisSection({
  children,
  icon: Icon,
  title,
}: {
  children: React.ReactNode;
  icon: typeof FileText;
  title: string;
}) {
  return (
    <section className="border-t border-[var(--color-border)] py-[var(--space-5)]">
      <div className="mb-[var(--space-3)] flex items-center gap-[var(--space-2)]">
        <Icon size={17} className="text-[var(--color-primary)]" strokeWidth={1.9} />
        <h2 className="m-0 text-[1rem] font-[820] leading-[1.2] text-[var(--color-ink)]">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function TextPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="whitespace-pre-wrap rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-3)] text-[0.88rem] leading-[1.58] text-[var(--color-ink)]">
      {children}
    </div>
  );
}

function SceneBreakdown({ scenes }: { scenes?: Scene[] }) {
  const rows = scenes?.filter((scene) =>
    [scene.description, scene.visualNotes, scene.audioNotes, scene.creatorPurpose].some(Boolean)
  ) ?? [];

  if (!rows.length) {
    return <p className="m-0 text-[0.86rem] text-[var(--color-muted)]">No scene breakdown returned.</p>;
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)]">
      {rows.map((scene, index) => (
        <div
          className="grid gap-[var(--space-3)] border-t border-[var(--color-border)] px-[var(--space-3)] py-[var(--space-3)] first:border-t-0 md:grid-cols-[5rem_minmax(0,1fr)]"
          key={`${scene.timestamp}-${index}`}
        >
          <div className="text-[0.78rem] font-[820] text-[var(--color-primary)]">
            {scene.timestamp || `Beat ${index + 1}`}
          </div>
          <div className="grid gap-[var(--space-2)]">
            <p className="m-0 text-[0.92rem] font-[720] leading-[1.45] text-[var(--color-ink)]">
              {textOrFallback(scene.description)}
            </p>
            <div className="grid gap-[var(--space-1)] text-[0.82rem] leading-[1.45] text-[var(--color-muted)]">
              {scene.visualNotes ? <span>Visual: {scene.visualNotes}</span> : null}
              {scene.audioNotes ? <span>Audio: {scene.audioNotes}</span> : null}
              {scene.creatorPurpose ? <span>Purpose: {scene.creatorPurpose}</span> : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function JobStatusIcon({ status }: { status: AnalysisJob["status"] }) {
  if (status === "completed") return <CheckCircle2 size={15} />;
  if (status === "failed") return <AlertCircle size={15} />;
  return <LoadingSignal label={statusLabel(status)} size="sm" />;
}

function JobRow({
  active,
  job,
  onClick,
}: {
  active: boolean;
  job: AnalysisJob;
  onClick: () => void;
}) {
  return (
    <button
      className={[
        "grid w-full gap-[var(--space-2)] border-t border-[var(--color-border)] px-[var(--space-3)] py-[var(--space-3)] text-left first:border-t-0 transition",
        active ? "bg-[var(--color-primary-soft)]" : "hover:bg-[var(--color-page-quiet)]",
      ].join(" ")}
      type="button"
      onClick={onClick}
    >
      <span className="flex min-w-0 items-center justify-between gap-[var(--space-2)]">
        <span className="min-w-0 truncate text-[0.9rem] font-[760] text-[var(--color-ink)]">
          {job.title ?? sourceLabel(job)}
        </span>
        <span className={`inline-flex shrink-0 items-center gap-[0.35rem] text-[0.74rem] font-[780] ${statusClass(job.status)}`}>
          <JobStatusIcon status={job.status} />
          {statusLabel(job.status)}
        </span>
      </span>
      <span className="line-clamp-2 text-[0.78rem] leading-[1.4] text-[var(--color-muted)]">
        {job.summary ?? sourceLabel(job)}
      </span>
      <span className="text-[0.72rem] font-[700] uppercase tracking-[0.06em] text-[var(--color-ink-soft)]">
        {formatDateTime(job.createdAt)}
      </span>
    </button>
  );
}

export function AnalyzePage() {
  const { activeWorkspaceId } = useWorkspace();
  const jobs = useQuery(
    api.analyze.videoAnalysis.list,
    activeWorkspaceId ? { workspaceId: activeWorkspaceId } : "skip"
  );
  const generateUploadUrl = useMutation(api.analyze.videoAnalysis.generateUploadUrl);
  const createFromUrl = useMutation(api.analyze.videoAnalysis.createFromUrl);
  const createFromUpload = useMutation(api.analyze.videoAnalysis.createFromUpload);
  const saveAsInspiration = useMutation(api.analyze.videoAnalysis.saveAsInspiration);
  const askQuestion = useAction(api.analyze.videoAnalysis.askQuestion);

  const [selectedJobId, setSelectedJobId] = useState<Id<"videoAnalysisJobs"> | null>(null);
  const selectedJob = useQuery(
    api.analyze.videoAnalysis.get,
    selectedJobId ? { id: selectedJobId } : "skip"
  );
  const questions = useQuery(
    api.analyze.videoAnalysis.listQuestions,
    selectedJobId ? { jobId: selectedJobId } : "skip"
  );

  const [sourceMode, setSourceMode] = useState<SourceMode>("url");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [question, setQuestion] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAsking, setIsAsking] = useState(false);

  const result = useMemo(() => resultFromJob(selectedJob), [selectedJob]);
  const sortedQuestions = useMemo(
    () => [...((questions ?? []) as AnalysisQuestion[])].sort((a, b) => a.createdAt - b.createdAt),
    [questions]
  );

  useEffect(() => {
    if (selectedJobId || !jobs?.length) return;
    setSelectedJobId(jobs[0]._id);
  }, [jobs, selectedJobId]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setStatusMessage("");
  };

  const submitAnalysis = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeWorkspaceId || isSubmitting) return;
    setIsSubmitting(true);
    setStatusMessage(sourceMode === "upload" ? "Uploading source..." : "Creating analysis...");

    try {
      if (sourceMode === "url") {
        const trimmedUrl = url.trim();
        if (!trimmedUrl) throw new Error("Paste a video URL first.");
        const jobId = await createFromUrl({
          workspaceId: activeWorkspaceId,
          url: trimmedUrl,
          customPrompt: customPrompt.trim() || undefined,
        });
        setSelectedJobId(jobId);
        setStatusMessage("Analysis queued.");
      } else {
        if (!file) throw new Error("Choose a video or audio file first.");
        if (file.size > MAX_UPLOAD_BYTES) {
          throw new Error("Choose a clip under 100 MB.");
        }
        const uploadUrl = await generateUploadUrl();
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!uploadResponse.ok) {
          throw new Error("Upload failed.");
        }
        const { storageId } = await uploadResponse.json() as { storageId: Id<"_storage"> };
        const jobId = await createFromUpload({
          workspaceId: activeWorkspaceId,
          storageId,
          fileName: file.name,
          mimeType: file.type || undefined,
          byteLength: file.size,
          customPrompt: customPrompt.trim() || undefined,
          sourceUrl: url.trim() || undefined,
          sourcePlatform: url.trim() ? sourcePlatformForUrl(url.trim()) : "unknown",
        });
        setSelectedJobId(jobId);
        setStatusMessage("Analysis queued.");
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Analysis failed to start.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyText = async (value: string, label = "Copied.") => {
    await navigator.clipboard.writeText(value);
    setStatusMessage(label);
  };

  const saveSelectedJob = async () => {
    if (!selectedJob || isSaving) return;
    setIsSaving(true);
    try {
      await saveAsInspiration({ id: selectedJob._id });
      setStatusMessage("Saved as inspiration.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setIsSaving(false);
    }
  };

  const submitQuestion = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!selectedJob || !trimmedQuestion || isAsking) return;
    setIsAsking(true);
    setQuestion("");
    try {
      await askQuestion({
        jobId: selectedJob._id,
        question: trimmedQuestion,
      });
      setStatusMessage("Answered.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Question failed.");
    } finally {
      setIsAsking(false);
    }
  };

  const reusePrompt = result.reuseBrief?.generationPrompt
    || result.reuseBrief?.originalVersionPrompt
    || "";
  const nonYoutubeUrl =
    sourceMode === "url" &&
    url.trim() &&
    !["youtube"].includes(sourcePlatformForUrl(url.trim()));

  return (
    <Page
      title="Analyze"
      description="Paste a video link or upload clips from TikTok, Instagram, Facebook, YouTube, and other sources."
    >
      <div className="grid gap-[var(--space-6)] xl:grid-cols-[minmax(20rem,25rem)_minmax(0,1fr)]">
        <div className="grid content-start gap-[var(--space-5)]">
          <form
            className="grid gap-[var(--space-4)] border-t border-[var(--color-border)] pt-[var(--space-4)]"
            onSubmit={submitAnalysis}
          >
            <div className="inline-grid grid-cols-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[0.2rem]">
              {(["url", "upload"] as SourceMode[]).map((item) => (
                <button
                  className={[
                    "inline-flex min-h-[2.35rem] items-center justify-center gap-[var(--space-2)] rounded-[calc(var(--radius-sm)-0.15rem)] px-[var(--space-3)] text-[0.84rem] font-[760] transition",
                    sourceMode === item
                      ? "bg-[var(--color-ink)] text-[var(--color-page)]"
                      : "text-[var(--color-muted)] hover:text-[var(--color-ink)]",
                  ].join(" ")}
                  key={item}
                  type="button"
                  onClick={() => setSourceMode(item)}
                >
                  {item === "url" ? <LinkIcon size={15} /> : <Upload size={15} />}
                  {item === "url" ? "Paste URL" : "Upload"}
                </button>
              ))}
            </div>

            {sourceMode === "url" ? (
              <label className="grid gap-[var(--space-2)]">
                <span className="text-[0.78rem] font-[780] uppercase tracking-[0.06em] text-[var(--color-muted)]">
                  Video URL
                </span>
                <input
                  className="min-h-[2.85rem] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] text-[0.92rem] text-[var(--color-ink)] outline-none transition placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)] focus:shadow-[0_0_0_3px_oklch(57%_0.14_166_/_0.13)]"
                  placeholder="Paste a video link"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                />
                {nonYoutubeUrl ? (
                  <span className="text-[0.78rem] leading-[1.45] text-[var(--color-muted)]">
                    YouTube links analyze directly. For TikTok, Instagram, Facebook, or other platforms, upload the clip for full analysis.
                  </span>
                ) : null}
              </label>
            ) : (
              <div className="grid gap-[var(--space-3)]">
                <label className="grid gap-[var(--space-2)]">
                  <span className="text-[0.78rem] font-[780] uppercase tracking-[0.06em] text-[var(--color-muted)]">
                    Source file
                  </span>
                  <span className="grid min-h-[7rem] cursor-pointer place-items-center rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] bg-[var(--color-page-quiet)] px-[var(--space-4)] py-[var(--space-5)] text-center transition hover:border-[var(--color-accent)]">
                    <input
                      accept="video/*,audio/*"
                      className="sr-only"
                      type="file"
                      onChange={handleFileChange}
                    />
                    <span className="grid justify-items-center gap-[var(--space-2)]">
                      <Upload size={20} className="text-[var(--color-primary)]" />
                      <span className="text-[0.9rem] font-[760] text-[var(--color-ink)]">
                        {file ? file.name : "Choose a video or audio file"}
                      </span>
                      <span className="text-[0.78rem] text-[var(--color-muted)]">
                        MP4, MOV, WebM, MP3, WAV, M4A under 100 MB
                      </span>
                    </span>
                  </span>
                </label>
                <label className="grid gap-[var(--space-2)]">
                  <span className="text-[0.78rem] font-[780] uppercase tracking-[0.06em] text-[var(--color-muted)]">
                    Original URL
                  </span>
                  <input
                    className="min-h-[2.7rem] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] text-[0.9rem] text-[var(--color-ink)] outline-none transition placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)]"
                    placeholder="Optional source link from TikTok, Instagram, Facebook, YouTube..."
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                  />
                </label>
              </div>
            )}

            <label className="grid gap-[var(--space-2)]">
              <span className="text-[0.78rem] font-[780] uppercase tracking-[0.06em] text-[var(--color-muted)]">
                Focus
              </span>
              <textarea
                className="min-h-[6rem] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-[0.9rem] leading-[1.5] text-[var(--color-ink)] outline-none transition placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)]"
                placeholder="Optional: tell Analyze what to pay extra attention to..."
                value={customPrompt}
                onChange={(event) => setCustomPrompt(event.target.value)}
              />
            </label>

            <button
              className="primary-button min-h-[2.85rem]"
              disabled={isSubmitting || !activeWorkspaceId}
              type="submit"
            >
              {isSubmitting ? <LoadingSignal label="Starting analysis" size="sm" /> : <Sparkles size={16} />}
              Analyze source
            </button>

            {statusMessage ? (
              <p className="m-0 text-[0.82rem] font-[650] leading-[1.45] text-[var(--color-accent-strong)]">
                {statusMessage}
              </p>
            ) : null}
          </form>

          <section className="overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)]">
            <div className="flex items-center justify-between gap-[var(--space-3)] bg-[var(--color-surface-muted)] px-[var(--space-3)] py-[var(--space-2)]">
              <h2 className="m-0 text-[0.78rem] font-[820] uppercase tracking-[0.06em] text-[var(--color-muted)]">
                Recent analyses
              </h2>
              <RefreshCw size={14} className="text-[var(--color-muted)]" />
            </div>
            {jobs === undefined ? (
              <LoadingState compact className="rounded-none border-0" title="Loading analyses" />
            ) : jobs.length === 0 ? (
              <div className="px-[var(--space-3)] py-[var(--space-4)] text-[0.88rem] leading-[1.5] text-[var(--color-muted)]">
                No analyses yet.
              </div>
            ) : (
              jobs.map((job) => (
                <JobRow
                  active={job._id === selectedJobId}
                  job={job}
                  key={job._id}
                  onClick={() => setSelectedJobId(job._id)}
                />
              ))
            )}
          </section>
        </div>

        <section className="min-w-0">
          {!selectedJobId ? (
            <div className="grid min-h-[32rem] place-items-center border-t border-[var(--color-border)] pt-[var(--space-6)] text-center">
              <div className="grid max-w-[28rem] justify-items-center gap-[var(--space-3)]">
                <Eye size={28} className="text-[var(--color-primary)]" />
                <h2 className="m-0 text-[1.15rem] font-[820] text-[var(--color-ink)]">
                  Add a reference source
                </h2>
                <p className="m-0 text-[0.9rem] leading-[1.55] text-[var(--color-muted)]">
                  Paste a video link, or upload a clip from TikTok, Instagram, Facebook, YouTube, or another source.
                </p>
              </div>
            </div>
          ) : selectedJob === undefined ? (
            <LoadingState detail="Fetching the selected analysis." title="Loading analysis" />
          ) : !selectedJob ? (
            <LoadingState detail="The selected analysis could not be found." title="Analysis unavailable" />
          ) : (
            <div className="min-w-0">
              <header className="border-t border-[var(--color-border)] pt-[var(--space-4)]">
                <div className="flex flex-wrap items-start justify-between gap-[var(--space-3)]">
                  <div className="min-w-0">
                    <div className={`mb-[var(--space-2)] inline-flex items-center gap-[var(--space-2)] text-[0.78rem] font-[820] uppercase tracking-[0.06em] ${statusClass(selectedJob.status)}`}>
                      <JobStatusIcon status={selectedJob.status} />
                      {statusLabel(selectedJob.status)}
                    </div>
                    <h2 className="m-0 break-words text-[1.65rem] font-[860] leading-[1.12] text-[var(--color-ink)]">
                      {selectedJob.title ?? sourceLabel(selectedJob)}
                    </h2>
                    <p className="mt-[var(--space-2)] max-w-[52rem] text-[0.94rem] leading-[1.58] text-[var(--color-muted)]">
                      {selectedJob.summary ?? "Analysis is being prepared."}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-[var(--space-2)]">
                    <button
                      className="secondary-button"
                      disabled={!reusePrompt}
                      type="button"
                      onClick={() => copyText(reusePrompt, "Brief copied.")}
                    >
                      <Clipboard size={16} />
                      Copy brief
                    </button>
                    <button
                      className="primary-button"
                      disabled={selectedJob.status !== "completed" || isSaving}
                      type="button"
                      onClick={saveSelectedJob}
                    >
                      {isSaving ? <LoadingSignal label="Saving" size="sm" /> : <Save size={16} />}
                      {selectedJob.savedAt ? "Saved" : "Save source"}
                    </button>
                  </div>
                </div>

                <div className="mt-[var(--space-4)] grid gap-[var(--space-2)] text-[0.78rem] font-[700] text-[var(--color-muted)] sm:grid-cols-3">
                  <span>{sourceLabel(selectedJob)}</span>
                  <span>{selectedJob.model}</span>
                  <span>{formatDateTime(selectedJob.completedAt ?? selectedJob.startedAt ?? selectedJob.createdAt)}</span>
                </div>
              </header>

              {selectedJob.status === "queued" || selectedJob.status === "running" ? (
                <LoadingState
                  className="mt-[var(--space-5)]"
                  detail="Gemini is reading the transcript, frames, scenes, and audio cues."
                  title={selectedJob.status === "queued" ? "Queued" : "Analyzing source"}
                />
              ) : null}

              {selectedJob.status === "failed" ? (
                <div className="mt-[var(--space-5)] rounded-[var(--radius-sm)] border border-[oklch(70%_0.16_25_/_0.35)] bg-[oklch(98%_0.025_25)] p-[var(--space-4)]">
                  <div className="flex items-start gap-[var(--space-3)]">
                    <AlertCircle size={19} className="mt-[0.1rem] text-[oklch(50%_0.18_25)]" />
                    <div className="min-w-0">
                      <h3 className="m-0 text-[0.98rem] font-[820] text-[var(--color-ink)]">
                        Analysis failed
                      </h3>
                      <p className="m-0 mt-[0.35rem] text-[0.88rem] leading-[1.55] text-[var(--color-muted)]">
                        {selectedJob.errorMessage ?? "The source could not be analyzed."}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {selectedJob.status === "completed" ? (
                <>
                  <AnalysisSection icon={FileText} title="Transcript">
                    <TextPanel>
                      {textOrFallback(result.transcript?.text, "No transcript detected.")}
                    </TextPanel>
                    {result.transcript?.confidenceNotes ? (
                      <p className="m-0 mt-[var(--space-2)] text-[0.82rem] leading-[1.5] text-[var(--color-muted)]">
                        {result.transcript.confidenceNotes}
                      </p>
                    ) : null}
                  </AnalysisSection>

                  <AnalysisSection icon={Eye} title="Visual read">
                    <div className="grid gap-[var(--space-3)] lg:grid-cols-2">
                      <TextPanel>{textOrFallback(result.visuals?.style)}</TextPanel>
                      <TextPanel>{textOrFallback(result.visuals?.cameraAndEditing)}</TextPanel>
                    </div>
                    <div className="mt-[var(--space-4)] grid gap-[var(--space-4)] lg:grid-cols-2">
                      <div>
                        <h3 className="m-0 mb-[var(--space-2)] text-[0.82rem] font-[820] uppercase tracking-[0.06em] text-[var(--color-muted)]">
                          Subjects
                        </h3>
                        <ListSection items={result.visuals?.subjects} />
                      </div>
                      <div>
                        <h3 className="m-0 mb-[var(--space-2)] text-[0.82rem] font-[820] uppercase tracking-[0.06em] text-[var(--color-muted)]">
                          On-screen text
                        </h3>
                        <ListSection items={result.visuals?.onScreenText} />
                      </div>
                    </div>
                  </AnalysisSection>

                  <AnalysisSection icon={Layers3} title="Scenes">
                    <SceneBreakdown scenes={result.visuals?.sceneBreakdown} />
                  </AnalysisSection>

                  <AnalysisSection icon={AudioLines} title="Audio">
                    <div className="grid gap-[var(--space-3)] lg:grid-cols-2">
                      <TextPanel>{textOrFallback(result.audio?.speechDelivery)}</TextPanel>
                      <TextPanel>{textOrFallback(result.audio?.musicAndSound)}</TextPanel>
                    </div>
                    <div className="mt-[var(--space-4)]">
                      <ListSection items={result.audio?.extractableNotes} />
                    </div>
                  </AnalysisSection>

                  <AnalysisSection icon={Sparkles} title="Creative pattern">
                    <div className="grid gap-[var(--space-4)]">
                      <TextPanel>{textOrFallback(result.creativeAnalysis?.hook)}</TextPanel>
                      <div className="grid gap-[var(--space-4)] lg:grid-cols-2">
                        <div>
                          <h3 className="m-0 mb-[var(--space-2)] text-[0.82rem] font-[820] uppercase tracking-[0.06em] text-[var(--color-muted)]">
                            Structure
                          </h3>
                          <ListSection items={result.creativeAnalysis?.structure} />
                        </div>
                        <div>
                          <h3 className="m-0 mb-[var(--space-2)] text-[0.82rem] font-[820] uppercase tracking-[0.06em] text-[var(--color-muted)]">
                            Why it works
                          </h3>
                          <ListSection items={result.creativeAnalysis?.whyItWorks} />
                        </div>
                      </div>
                    </div>
                  </AnalysisSection>

                  <AnalysisSection icon={Clipboard} title="Reusable brief">
                    <div className="grid gap-[var(--space-3)]">
                      <TextPanel>{textOrFallback(result.reuseBrief?.copyablePattern)}</TextPanel>
                      <TextPanel>{textOrFallback(result.reuseBrief?.scriptTemplate)}</TextPanel>
                      <div>
                        <h3 className="m-0 mb-[var(--space-2)] text-[0.82rem] font-[820] uppercase tracking-[0.06em] text-[var(--color-muted)]">
                          Shot list
                        </h3>
                        <ListSection items={result.reuseBrief?.shotList} />
                      </div>
                    </div>
                  </AnalysisSection>

                  <AnalysisSection icon={MessageSquare} title="Ask about this source">
                    <form
                      className="grid gap-[var(--space-3)] sm:grid-cols-[minmax(0,1fr)_10rem]"
                      onSubmit={submitQuestion}
                    >
                      <input
                        className="min-h-[2.85rem] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] text-[0.92rem] text-[var(--color-ink)] outline-none transition placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)]"
                        placeholder="Ask about a scene, hook, frame, or edit..."
                        value={question}
                        onChange={(event) => setQuestion(event.target.value)}
                      />
                      <button
                        className="primary-button"
                        disabled={isAsking || !question.trim()}
                        type="submit"
                      >
                        {isAsking ? <LoadingSignal label="Asking" size="sm" /> : <HelpCircle size={16} />}
                        Ask
                      </button>
                    </form>

                    <div className="mt-[var(--space-4)] grid gap-[var(--space-3)]">
                      {sortedQuestions.length === 0 ? (
                        <p className="m-0 text-[0.86rem] text-[var(--color-muted)]">
                          No questions yet.
                        </p>
                      ) : (
                        sortedQuestions.map((item) => (
                          <div
                            className="grid gap-[var(--space-2)] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-3)]"
                            key={item._id}
                          >
                            <p className="m-0 text-[0.88rem] font-[760] text-[var(--color-ink)]">
                              {item.question}
                            </p>
                            {item.status === "running" ? (
                              <LoadingSignal label="Answering" showLabel size="sm" />
                            ) : item.status === "failed" ? (
                              <p className="m-0 text-[0.84rem] text-[oklch(52%_0.18_25)]">
                                {item.errorMessage ?? "Question failed."}
                              </p>
                            ) : (
                              <p className="m-0 whitespace-pre-wrap text-[0.86rem] leading-[1.55] text-[var(--color-muted)]">
                                {item.answer}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </AnalysisSection>
                </>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </Page>
  );
}
