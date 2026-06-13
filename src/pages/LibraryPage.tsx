import { useAction, useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  ClipboardPaste,
  ExternalLink,
  Folder,
  Image as ImageIcon,
  Music,
  Plus,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent, type FormEvent } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { MediaLightbox, type MediaLightboxItem } from "../components/MediaLightbox";
import {
  GenerationLoadingState,
  LoadingSignal,
  LoadingState,
  Page,
  Panel,
  Select,
  TextArea,
} from "../components/ui";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { artifactSummary } from "../lib/artifactUtils";
import { fileToDataUrl } from "../lib/browser/dataUrl";
import {
  AI_PROVIDER_LABELS,
  generationDefaultForMode,
} from "../lib/providers/aiGenerationDefaults";
import type { ArtifactDoc, CreativeAssetDoc, WorkflowDoc, WorkflowRunDoc } from "../types";

type PackageMediaItem = {
  artifactId?: string;
  artifactType?: string;
  mimeType?: string;
  model?: string;
  provider?: string;
  role?: string;
  storageUrl: string;
  title?: string;
};

type LibraryOutput = {
  id: string;
  artifactId?: Id<"artifacts">;
  creativeAssetId?: Id<"creativeAssets">;
  title: string;
  type: string;
  source: "create" | "workflow" | "creative_asset";
  createdAt: number;
  brandId?: string;
  workflowId?: string;
  workflowRunId?: string;
  provider?: string;
  model?: string;
  prompt?: string;
  latestEditPrompt?: string;
  summary?: string;
  storageUrl: string;
  mimeType?: string;
  aspectRatio?: string;
};

type LibraryRunGroup = {
  id: string;
  workflowId: string;
  run?: WorkflowRunDoc;
  outputs: LibraryOutput[];
  createdAt: number;
};

type LibraryWorkflowGroup = {
  id: string;
  workflow?: WorkflowDoc;
  runs: LibraryRunGroup[];
  outputCount: number;
  latestAt: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function artifactAspectRatio(artifact?: ArtifactDoc) {
  if (!artifact || !isRecord(artifact.data)) return undefined;

  if (typeof artifact.data.aspectRatio === "string") {
    return artifact.data.aspectRatio.replace(":", " / ");
  }

  const dimensions = isRecord(artifact.data.dimensions)
    ? artifact.data.dimensions
    : artifact.data;
  const width = typeof dimensions.width === "number" ? dimensions.width : undefined;
  const height = typeof dimensions.height === "number" ? dimensions.height : undefined;
  return width && height ? `${width} / ${height}` : undefined;
}

function artifactLatestEditPrompt(artifact?: ArtifactDoc) {
  if (!artifact || !isRecord(artifact.data)) return undefined;
  if (typeof artifact.data.latestEditPrompt !== "string") return undefined;
  return userFacingPrompt(artifact.data.latestEditPrompt);
}

function userFacingPrompt(prompt: string) {
  const suffix =
    "Use the provided reference image as the source image. Apply only the requested edit. Preserve the original subject, composition, framing, background, lighting, colors, camera angle, and style unless the requested edit directly requires a change.";
  const marker = "User prompt:";
  const markerIndex = prompt.lastIndexOf(marker);
  const userPrompt = markerIndex >= 0
    ? prompt.slice(markerIndex + marker.length).trim()
    : prompt.trim();
  const [instruction] = userPrompt.split(`\n\n${suffix}`);
  return instruction?.trim() || userPrompt || undefined;
}

function artifactUserPrompt(artifact?: ArtifactDoc) {
  if (!artifact) return undefined;
  if (isRecord(artifact.data) && typeof artifact.data.userPrompt === "string") {
    return artifact.data.userPrompt;
  }
  return artifact.prompt ? userFacingPrompt(artifact.prompt) : undefined;
}

function exportTimestamp(artifact: ArtifactDoc) {
  if (!isRecord(artifact.data) || !isRecord(artifact.data.exportStatus)) return artifact.createdAt;
  return typeof artifact.data.exportStatus.exportedAt === "number"
    ? artifact.data.exportStatus.exportedAt
    : artifact.createdAt;
}

function exportedToMediaLibrary(artifact: ArtifactDoc) {
  if (artifact.type !== "publish_payload" || !isRecord(artifact.data)) return false;

  if (
    isRecord(artifact.data.exportStatus) &&
    artifact.data.exportStatus.destination === "media_library"
  ) {
    return true;
  }

  return Array.isArray(artifact.data.exports) &&
    artifact.data.exports.some((item) =>
      isRecord(item) && item.destination === "media_library"
    );
}

function createPageArtifactOutput(artifact: ArtifactDoc): LibraryOutput | null {
  if (!isRecord(artifact.data)) return null;
  if (artifact.data.source !== "create_page") return null;
  if (!artifact.storageUrl) return null;
  if (artifact.lifecycle && artifact.lifecycle !== "saved") return null;

  const mimeType = typeof artifact.data.mimeType === "string"
    ? artifact.data.mimeType
    : undefined;

  return {
    id: `create:${artifact._id}`,
    artifactId: artifact._id,
    title: artifact.title?.trim() || "Generated asset",
    type: artifact.type,
    source: "create",
    createdAt: artifact.createdAt,
    brandId: artifact.brandId ? String(artifact.brandId) : undefined,
    provider: artifact.provider,
    model: artifact.model,
    prompt: artifactUserPrompt(artifact),
    latestEditPrompt: artifactLatestEditPrompt(artifact),
    summary: artifactSummary(artifact),
    storageUrl: artifact.storageUrl,
    mimeType,
    aspectRatio: artifactAspectRatio(artifact),
  };
}

function createOutputsFromArtifacts(artifacts: ArtifactDoc[]) {
  return artifacts
    .map(createPageArtifactOutput)
    .filter((output): output is LibraryOutput => Boolean(output))
    .sort((first, second) => second.createdAt - first.createdAt);
}

function creativeAssetMimeType(asset: CreativeAssetDoc) {
  const metadata = isRecord(asset.metadata) ? asset.metadata : {};
  return typeof metadata.mimeType === "string" ? metadata.mimeType : undefined;
}

function creativeAssetOutput(asset: CreativeAssetDoc): LibraryOutput {
  const mimeType = creativeAssetMimeType(asset);
  return {
    id: `creative_asset:${asset._id}`,
    creativeAssetId: asset._id,
    title: asset.name,
    type: asset.mediaType,
    source: "creative_asset",
    createdAt: asset.createdAt,
    brandId: asset.brandId ? String(asset.brandId) : undefined,
    prompt: asset.description ?? asset.usageNotes,
    summary: asset.usageNotes ?? asset.description,
    storageUrl: asset.storageUrl,
    mimeType,
  };
}

function creativeAssetOutputsFromAssets(assets: CreativeAssetDoc[]) {
  return assets
    .map(creativeAssetOutput)
    .sort((first, second) => second.createdAt - first.createdAt);
}

function mediaItemsForArtifact(artifact: ArtifactDoc): PackageMediaItem[] {
  if (!isRecord(artifact.data) || !Array.isArray(artifact.data.mediaItems)) return [];

  return artifact.data.mediaItems
    .filter(isRecord)
    .map((item) => ({
      artifactId: typeof item.artifactId === "string" ? item.artifactId : undefined,
      artifactType: typeof item.artifactType === "string" ? item.artifactType : undefined,
      mimeType: typeof item.mimeType === "string" ? item.mimeType : undefined,
      model: typeof item.model === "string" ? item.model : undefined,
      provider: typeof item.provider === "string" ? item.provider : undefined,
      role: typeof item.role === "string" ? item.role : undefined,
      storageUrl: typeof item.storageUrl === "string" ? item.storageUrl : "",
      title: typeof item.title === "string" ? item.title : undefined,
    }))
    .filter((item) => item.storageUrl);
}

function outputsFromArtifacts(artifacts: ArtifactDoc[]) {
  const artifactsById = new Map(artifacts.map((artifact) => [String(artifact._id), artifact]));
  const seenOutputKeys = new Set<string>();
  const outputs: LibraryOutput[] = [];

  for (const artifact of artifacts) {
    if (!artifact.workflowId || !artifact.workflowRunId || !exportedToMediaLibrary(artifact)) {
      continue;
    }

    for (const item of mediaItemsForArtifact(artifact)) {
      const key = item.artifactId ?? item.storageUrl;
      if (seenOutputKeys.has(key)) continue;
      seenOutputKeys.add(key);

      const sourceArtifact = item.artifactId ? artifactsById.get(item.artifactId) : undefined;
      outputs.push({
        id: `media:${artifact._id}:${key}`,
        artifactId: sourceArtifact?._id,
        title: sourceArtifact?.title?.trim() || item.title?.trim() || "Exported media",
        type: item.artifactType ?? item.role ?? "media",
        source: "workflow",
        createdAt: exportTimestamp(artifact),
        brandId: artifact.brandId ? String(artifact.brandId) : undefined,
        workflowId: String(artifact.workflowId),
        workflowRunId: String(artifact.workflowRunId),
        provider: item.provider,
        model: item.model,
        prompt: artifactUserPrompt(sourceArtifact),
        latestEditPrompt: artifactLatestEditPrompt(sourceArtifact),
        summary: sourceArtifact ? artifactSummary(sourceArtifact) : undefined,
        storageUrl: item.storageUrl,
        mimeType: item.mimeType,
        aspectRatio: artifactAspectRatio(sourceArtifact),
      });
    }
  }

  return outputs.sort((first, second) => second.createdAt - first.createdAt);
}

function formatDateTime(value: number) {
  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatRunTime(run: WorkflowRunDoc | undefined, fallback: number) {
  return formatDateTime(run?.completedAt ?? run?.startedAt ?? run?.createdAt ?? fallback);
}

function isImageOutput(output: LibraryOutput) {
  return output.mimeType?.startsWith("image/") || output.type === "image";
}

function isVideoOutput(output: LibraryOutput) {
  return output.mimeType?.startsWith("video/") || output.type === "video";
}

function lightboxMediaForOutput(output: LibraryOutput): MediaLightboxItem {
  return {
    kind: isVideoOutput(output) ? "video" : "image",
    src: output.storageUrl,
    title: output.title,
    meta: [
      output.source === "create"
        ? "Create"
        : output.source === "creative_asset"
          ? "Reusable asset"
          : "Workflow export",
      output.provider,
      output.model,
    ].filter(Boolean).join(" · "),
  };
}

function MediaPreview({
  onOpenMedia,
  output,
}: {
  onOpenMedia?: (output: LibraryOutput) => void;
  output: LibraryOutput;
}) {
  const [naturalAspectRatio, setNaturalAspectRatio] = useState<string | undefined>();
  const resolvedAspectRatio = output.aspectRatio ?? naturalAspectRatio;
  const canOpenMedia = Boolean(onOpenMedia && (isImageOutput(output) || isVideoOutput(output)));
  const preview = (
    <>
      {output.mimeType?.startsWith("audio/") || output.type === "audio" ? (
        <div className="grid place-items-center gap-[var(--space-3)] p-[var(--space-3)]">
          <Music size={28} className="text-[var(--color-ink-muted)]" />
          <audio src={output.storageUrl} controls className="w-full" />
        </div>
      ) : output.mimeType?.startsWith("video/") || output.type === "video" ? (
        <video
          className="h-full w-full object-cover"
          src={output.storageUrl}
          {...(canOpenMedia ? { muted: true, playsInline: true } : { controls: true })}
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            if (video.videoWidth && video.videoHeight) {
              setNaturalAspectRatio(`${video.videoWidth} / ${video.videoHeight}`);
            }
          }}
        />
      ) : (
        <img
          className="h-full w-full object-cover"
          src={output.storageUrl}
          alt={output.title}
          onLoad={(event) => {
            const image = event.currentTarget;
            if (image.naturalWidth && image.naturalHeight) {
              setNaturalAspectRatio(`${image.naturalWidth} / ${image.naturalHeight}`);
            }
          }}
        />
      )}
    </>
  );

  const className =
    "grid max-h-[18rem] min-h-[9rem] w-full overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-page-quiet)]";
  const style = resolvedAspectRatio ? { aspectRatio: resolvedAspectRatio } : undefined;

  if (canOpenMedia) {
    return (
      <button
        aria-label={`Open ${output.title}`}
        className={`${className} cursor-zoom-in p-0 text-left transition hover:border-[var(--color-border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 focus:ring-offset-[var(--color-surface)]`}
        style={style}
        type="button"
        onClick={() => onOpenMedia?.(output)}
      >
        {preview}
      </button>
    );
  }

  return (
    <div className={className} style={style}>
      {preview}
    </div>
  );
}

function OutputTitle({
  onRename,
  title,
}: {
  onRename?: () => void;
  title: string;
}) {
  if (!onRename) {
    return (
      <h3 className="m-0 overflow-hidden text-[0.95rem] font-[760] leading-[1.2] text-[var(--color-ink)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
        {title}
      </h3>
    );
  }

  return (
    <button
      aria-label={`Rename ${title}`}
      className="block w-full min-w-0 rounded-[var(--radius-sm)] border border-transparent bg-transparent p-0 text-left text-[var(--color-ink)] transition hover:text-[var(--color-primary-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 focus:ring-offset-[var(--color-surface)]"
      onClick={onRename}
      title="Rename title"
      type="button"
    >
      <span className="block overflow-hidden text-[0.95rem] font-[760] leading-[1.2] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
        {title}
      </span>
    </button>
  );
}

function OutputCard({
  onOpenMedia,
  onEdit,
  isDeleting,
  onDelete,
  onRename,
  output,
}: {
  onOpenMedia?: (output: LibraryOutput) => void;
  onEdit?: () => void;
  isDeleting?: boolean;
  onDelete?: () => void;
  onRename?: () => void;
  output: LibraryOutput;
}) {
  const metadata = [
    output.source === "create"
      ? "Create"
      : output.source === "creative_asset"
        ? "Reusable asset"
        : "Workflow export",
    output.provider,
    output.model,
  ].filter(Boolean);

  return (
    <article className="group grid min-w-0 content-start gap-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-3)] shadow-[var(--shadow-sm)] transition hover:-translate-y-px hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-md)]">
      <MediaPreview onOpenMedia={onOpenMedia} output={output} />
      <div className="grid min-w-0 gap-[var(--space-2)]">
        <div className="entity-eyebrow">{output.type.replaceAll("_", " ")}</div>
        <OutputTitle onRename={onRename} title={output.title} />
        {metadata.length > 0 ? (
          <p className="m-0 truncate text-[0.78rem] leading-snug text-[var(--color-ink-muted)]">
            {metadata.join(" · ")}
          </p>
        ) : null}
        {output.prompt ? (
          <details className="group/prompt text-[0.78rem] text-[var(--color-ink-muted)]">
            <summary className="cursor-pointer list-none font-[720] text-[var(--color-ink-soft)] marker:hidden">
              Prompt used
            </summary>
            <p className="m-0 mt-[var(--space-2)] max-h-[7rem] overflow-auto rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-page)] p-[var(--space-2)] leading-[1.45]">
              {output.prompt}
            </p>
          </details>
        ) : !output.prompt && output.summary ? (
          <p className="m-0 overflow-hidden text-[0.78rem] leading-snug text-[var(--color-ink-muted)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
            {output.summary}
          </p>
        ) : null}
        {output.latestEditPrompt ? (
          <details className="group/edit-prompt text-[0.78rem] text-[var(--color-ink-muted)]">
            <summary className="cursor-pointer list-none font-[720] text-[var(--color-ink-soft)] marker:hidden">
              Latest edit
            </summary>
            <p className="m-0 mt-[var(--space-2)] max-h-[7rem] overflow-auto rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-page)] p-[var(--space-2)] leading-[1.45]">
              {output.latestEditPrompt}
            </p>
          </details>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-[var(--space-2)]">
        {onEdit ? (
          <button
            className="secondary-button min-h-[2rem] px-[var(--space-2)] py-[0.35rem] text-[0.78rem]"
            onClick={onEdit}
            type="button"
          >
            <Wand2 size={15} />
            Edit image
          </button>
        ) : null}
        {!isImageOutput(output) ? (
          <a
            className="secondary-button min-h-[2rem] px-[var(--space-2)] py-[0.35rem] text-[0.78rem]"
            href={output.storageUrl}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={16} />
            Open output
          </a>
        ) : null}
        {onDelete ? (
          <button
            className="secondary-button min-h-[2rem] px-[var(--space-2)] py-[0.35rem] text-[0.78rem] text-[var(--color-danger)]"
            disabled={isDeleting}
            onClick={onDelete}
            type="button"
          >
            <Trash2 size={15} />
            {isDeleting ? "Deleting" : "Delete"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function TitleRenameModal({
  onCancel,
  onSave,
  output,
}: {
  onCancel: () => void;
  onSave: (title: string) => Promise<void>;
  output: LibraryOutput;
}) {
  const [draftTitle, setDraftTitle] = useState(output.title);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraftTitle(output.title);
    setError("");
  }, [output]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [draftTitle]);

  const saveTitle = async () => {
    const nextTitle = draftTitle.trim();
    if (!nextTitle) {
      setError("Add a title before saving.");
      return;
    }

    if (nextTitle === output.title) {
      onCancel();
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      await onSave(nextTitle);
      onCancel();
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : "Unable to rename asset");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-[var(--space-4)]"
      role="dialog"
    >
      <form
        className="grid w-[min(100%,42rem)] gap-[var(--space-4)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)] shadow-[var(--shadow-lg)]"
        onSubmit={(event) => {
          event.preventDefault();
          void saveTitle();
        }}
      >
        <div className="flex items-start justify-between gap-[var(--space-4)]">
          <div className="grid min-w-0 gap-1">
            <p className="entity-eyebrow m-0">{output.type.replaceAll("_", " ")}</p>
            <h2 className="m-0 text-[1.1rem] font-[780] leading-tight text-[var(--color-ink)]">
              Rename asset
            </h2>
          </div>
          <button className="icon-button" onClick={onCancel} type="button" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <label className="grid gap-[var(--space-2)]">
          <span className="text-[0.78rem] font-[760] text-[var(--color-ink-soft)]">Title</span>
          <textarea
            aria-label="Asset title"
            autoFocus
            className="max-h-[60vh] min-h-[3rem] w-full resize-none overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-page)] px-[var(--space-3)] py-[var(--space-2)] text-[1rem] font-[720] leading-[1.35] text-[var(--color-ink)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            maxLength={180}
            onChange={(event) => setDraftTitle(event.target.value.replace(/\s*\n\s*/g, " "))}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                onCancel();
              }
              if (event.key === "Enter") {
                event.preventDefault();
                void saveTitle();
              }
            }}
            ref={textareaRef}
            rows={1}
            value={draftTitle}
          />
        </label>

        {error ? (
          <p className="m-0 text-[0.8rem] leading-snug text-[var(--color-danger)]">{error}</p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-[var(--space-2)]">
          <button className="secondary-button" disabled={isSaving} onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="primary-button" disabled={isSaving || !draftTitle.trim()} type="submit">
            {isSaving ? <LoadingSignal label="Saving" size="sm" /> : <Check size={16} />}
            Save title
          </button>
        </div>
      </form>
    </div>
  );
}

function editableImageOutput(output: LibraryOutput) {
  return Boolean(
    output.artifactId &&
      output.source === "create" &&
      (output.type === "image" || output.mimeType?.startsWith("image/"))
  );
}

function generationAspectRatio(output: LibraryOutput) {
  const aspectRatio = output.aspectRatio?.replace(/\s*\/\s*/g, ":");
  return aspectRatio && /^\d+(\.\d+)?:\d+(\.\d+)?$/.test(aspectRatio)
    ? aspectRatio
    : undefined;
}

function libraryImageEditPrompt(instruction: string) {
  return [
    instruction.trim(),
    "Use the provided reference image as the source image. Apply only the requested edit. Preserve the original subject, composition, framing, background, lighting, colors, camera angle, and style unless the requested edit directly requires a change.",
  ].join("\n\n");
}

function libraryImageReference(output: LibraryOutput) {
  return {
    url: output.storageUrl,
    mimeType: output.mimeType?.startsWith("image/") ? output.mimeType : "image/png",
    description: "Current saved image to edit",
  };
}

type CandidateImage = {
  artifactId: Id<"artifacts">;
  storageUrl: string;
  title: string;
};

function ImageRevisionModal({
  candidate,
  isApproving,
  isGenerating,
  onApprove,
  onCancel,
  onGenerate,
  output,
  prompt,
  status,
  setPrompt,
}: {
  candidate?: CandidateImage;
  isApproving: boolean;
  isGenerating: boolean;
  onApprove: () => void;
  onCancel: () => void;
  onGenerate: (event: FormEvent) => void;
  output: LibraryOutput;
  prompt: string;
  status: string;
  setPrompt: (value: string) => void;
}) {
  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-[var(--space-4)]"
      role="dialog"
    >
      <form
        className="grid max-h-[min(92vh,54rem)] w-[min(100%,58rem)] gap-[var(--space-4)] overflow-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)] shadow-[var(--shadow-lg)]"
        onSubmit={onGenerate}
      >
        <div className="flex items-start justify-between gap-[var(--space-4)]">
          <div className="grid gap-1">
            <p className="entity-eyebrow m-0">Image revision</p>
            <h2 className="m-0 text-[1.35rem] font-[780] leading-tight text-[var(--color-ink)]">
              Edit saved image
            </h2>
          </div>
          <button className="icon-button" onClick={onCancel} type="button" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-[var(--space-4)] lg:grid-cols-2">
          <div className="grid gap-[var(--space-2)]">
            <div className="entity-eyebrow">Current</div>
            <MediaPreview output={output} />
          </div>
          <div className="grid gap-[var(--space-2)]">
            <div className="entity-eyebrow">Candidate</div>
            {isGenerating ? (
              <GenerationLoadingState
                className="min-h-[18rem]"
                detail="Using the saved image as the reference and applying only the requested edit."
                steps={["Reading reference image", "Applying edit", "Preparing candidate"]}
                title="Editing image"
              />
            ) : candidate ? (
              <div className="grid max-h-[18rem] min-h-[9rem] w-full overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-page-quiet)]">
                <img
                  className="h-full w-full object-cover"
                  src={candidate.storageUrl}
                  alt={candidate.title}
                />
              </div>
            ) : (
              <div className="grid min-h-[9rem] place-items-center rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] bg-[var(--color-page-quiet)] p-[var(--space-4)] text-center text-[0.9rem] text-[var(--color-ink-muted)]">
                Adjust the prompt and generate a candidate.
              </div>
            )}
          </div>
        </div>

        <TextArea
          label="Prompt"
          value={prompt}
          onChange={setPrompt}
          placeholder="Describe the revised image..."
          rows={5}
        />

        {status ? (
          <p className="m-0 text-[0.86rem] text-[var(--color-ink-muted)]">{status}</p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-[var(--space-2)]">
          <button className="secondary-button" onClick={onCancel} type="button">
            Cancel
          </button>
          <button
            className="secondary-button"
            disabled={isGenerating || !prompt.trim()}
            type="submit"
          >
            {isGenerating ? <LoadingSignal label="Generating" size="sm" /> : <Wand2 size={16} />}
            {candidate ? "Regenerate" : "Generate candidate"}
          </button>
          {candidate ? (
            <button
              className="primary-button"
              disabled={isApproving || isGenerating}
              onClick={onApprove}
              type="button"
            >
              {isApproving ? <LoadingSignal label="Approving" size="sm" /> : <Check size={16} />}
              Approve replacement
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function extensionFromMimeType(mimeType: string) {
  const subtype = mimeType.split("/")[1]?.split("+")[0];
  if (!subtype) return "bin";
  return subtype === "jpeg" ? "jpg" : subtype;
}

function mediaTypeFromFile(file?: File): "image" | "video" | "audio" | "file" {
  if (file?.type.startsWith("image/")) return "image";
  if (file?.type.startsWith("video/")) return "video";
  if (file?.type.startsWith("audio/")) return "audio";
  return "file";
}

function assetKindFromFile(file: File) {
  if (file.type.startsWith("audio/")) return "voice" as const;
  if (file.type.startsWith("image/")) return "style_reference" as const;
  return "other" as const;
}

async function clipboardMediaFilesFromRead() {
  const read = (navigator.clipboard as Clipboard & {
    read?: () => Promise<ClipboardItem[]>;
  } | undefined)?.read;
  if (!read) return [];

  const items = await read.call(navigator.clipboard);
  const files: File[] = [];

  for (const item of items) {
    const type = item.types.find((itemType) =>
      itemType.startsWith("image/") ||
        itemType.startsWith("video/") ||
        itemType.startsWith("audio/")
    );
    if (!type) continue;
    const blob = await item.getType(type);
    files.push(
      new File([blob], `pasted-${Date.now()}.${extensionFromMimeType(type)}`, {
        type,
      })
    );
  }

  return files;
}

function AddMediaModal({
  isSaving,
  onCancel,
  onSave,
  status,
}: {
  isSaving: boolean;
  onCancel: () => void;
  onSave: (args: {
    file: File;
    name: string;
  }) => Promise<void>;
  status: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [pasteStatus, setPasteStatus] = useState("");
  const previewUrl = useMemo(() => file ? URL.createObjectURL(file) : "", [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const setSelectedFile = (nextFile: File) => {
    setFile(nextFile);
    setName((current) => current || nextFile.name.replace(/\.[^.]+$/, ""));
    setPasteStatus("");
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    event.target.value = "";
    if (nextFile) setSelectedFile(nextFile);
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const nextFile = Array.from(event.clipboardData.files).find((item) =>
      item.type.startsWith("image/") ||
        item.type.startsWith("video/") ||
        item.type.startsWith("audio/")
    );
    if (!nextFile) return;
    event.preventDefault();
    setSelectedFile(nextFile);
  };

  const pasteFromClipboard = async () => {
    setPasteStatus("");
    try {
      const [nextFile] = await clipboardMediaFilesFromRead();
      if (!nextFile) {
        setPasteStatus("No image, video, or audio found on the clipboard.");
        return;
      }
      setSelectedFile(nextFile);
    } catch (error) {
      setPasteStatus(error instanceof Error ? error.message : "Clipboard paste failed.");
    }
  };

  const canSave = Boolean(file && name.trim());

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-[var(--space-4)]"
      role="dialog"
    >
      <form
        className="grid max-h-[min(92vh,46rem)] w-[min(100%,44rem)] gap-[var(--space-4)] overflow-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)] shadow-[var(--shadow-lg)]"
        onSubmit={(event) => {
          event.preventDefault();
          if (!file) return;
          void onSave({
            file,
            name: name.trim(),
          });
        }}
      >
        <div className="flex items-start justify-between gap-[var(--space-4)]">
          <div className="grid gap-1">
            <p className="entity-eyebrow m-0">Reusable media</p>
            <h2 className="m-0 text-[1.25rem] font-[780] leading-tight text-[var(--color-ink)]">
              Add media to library
            </h2>
          </div>
          <button className="icon-button" onClick={onCancel} type="button" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div
          className="grid min-h-[12rem] place-items-center rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-page-quiet)] p-[var(--space-4)] text-center"
          onPaste={handlePaste}
          tabIndex={0}
        >
          {file && previewUrl ? (
            <div className="grid w-full gap-[var(--space-3)]">
              <div className="mx-auto grid max-h-[18rem] w-full max-w-[20rem] overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-page)]">
                {mediaTypeFromFile(file) === "image" ? (
                  <img alt="" className="max-h-[18rem] w-full object-contain" src={previewUrl} />
                ) : mediaTypeFromFile(file) === "video" ? (
                  <video className="max-h-[18rem] w-full" controls src={previewUrl} />
                ) : mediaTypeFromFile(file) === "audio" ? (
                  <div className="grid gap-[var(--space-3)] p-[var(--space-4)]">
                    <Music className="mx-auto text-[var(--color-ink-muted)]" size={28} />
                    <audio controls src={previewUrl} />
                  </div>
                ) : (
                  <div className="p-[var(--space-4)] text-[0.9rem] text-[var(--color-ink-muted)]">
                    {file.name}
                  </div>
                )}
              </div>
              <button
                className="secondary-button mx-auto"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={16} />
                Replace media
              </button>
            </div>
          ) : (
            <div className="grid justify-items-center gap-[var(--space-3)]">
              <ImageIcon size={30} className="text-[var(--color-ink-muted)]" />
              <div className="grid gap-1">
                <strong className="text-[0.96rem] text-[var(--color-ink)]">
                  Upload or paste reusable media
                </strong>
                <span className="text-[0.82rem] text-[var(--color-ink-muted)]">
                  Images, videos, and audio saved here can be picked as references later.
                </span>
              </div>
              <div className="flex flex-wrap justify-center gap-[var(--space-2)]">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={16} />
                  Upload
                </button>
                <button className="secondary-button" type="button" onClick={() => void pasteFromClipboard()}>
                  <ClipboardPaste size={16} />
                  Paste
                </button>
              </div>
            </div>
          )}
          <input
            accept="image/*,video/*,audio/*"
            className="hidden"
            onChange={handleFileChange}
            ref={fileInputRef}
            type="file"
          />
        </div>

        <div className="grid gap-[var(--space-3)]">
          <label className="grid gap-[var(--space-2)]">
            <span className="text-[0.78rem] font-[760] text-[var(--color-ink-soft)]">Name</span>
            <input
              className="min-h-[2.65rem] rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-page)] px-[var(--space-3)] text-[0.94rem] text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20"
              onChange={(event) => setName(event.target.value)}
              placeholder="Before selfie reference"
              value={name}
            />
          </label>
        </div>

        {pasteStatus || status ? (
          <p className="m-0 text-[0.82rem] text-[var(--color-ink-muted)]">
            {status || pasteStatus}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-[var(--space-2)]">
          <button className="secondary-button" disabled={isSaving} onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="primary-button" disabled={!canSave || isSaving} type="submit">
            {isSaving ? <LoadingSignal label="Saving" size="sm" /> : <Check size={16} />}
            Save media
          </button>
        </div>
      </form>
    </div>
  );
}

function FolderButton({
  folder,
  onOpen,
}: {
  folder: LibraryWorkflowGroup;
  onOpen: () => void;
}) {
  return (
    <button
      className="grid min-w-0 cursor-pointer gap-[var(--space-4)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)] text-left shadow-[var(--shadow-sm)] transition hover:-translate-y-px hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-md)]"
      type="button"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-[var(--space-3)]">
        <div className="grid size-11 place-items-center rounded-[var(--radius-md)] bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]">
          <Folder size={22} />
        </div>
        <ChevronRight size={18} className="mt-2 text-[var(--color-ink-muted)]" />
      </div>
      <div className="artifact-copy">
        <h3>{folder.workflow?.name ?? "Untitled workflow"}</h3>
        <p>
          {folder.runs.length} run{folder.runs.length === 1 ? "" : "s"} ·{" "}
          {folder.outputCount} output{folder.outputCount === 1 ? "" : "s"}
        </p>
        <p>Latest {formatDateTime(folder.latestAt)}</p>
      </div>
    </button>
  );
}

function RunRow({
  group,
  onOpen,
}: {
  group: LibraryRunGroup;
  onOpen: () => void;
}) {
  const nonCompletedStatus = group.run?.status && group.run.status !== "completed"
    ? group.run.status.replaceAll("_", " ")
    : undefined;

  return (
    <button
      className="flex w-full cursor-pointer items-center justify-between gap-[var(--space-4)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)] text-left transition hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-raised)]"
      type="button"
      onClick={onOpen}
    >
      <div className="flex min-w-0 items-center gap-[var(--space-3)]">
        <div className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--color-page-quiet)] text-[var(--color-ink-muted)]">
          <ImageIcon size={18} />
        </div>
        <div className="min-w-0">
          <h3 className="m-0 text-[1rem] font-[680] leading-tight text-[var(--color-ink)]">
            {formatRunTime(group.run, group.createdAt)}
          </h3>
          <p className="m-0 mt-1 text-[0.9rem] leading-snug text-[var(--color-ink-muted)]">
            {group.outputs.length} output{group.outputs.length === 1 ? "" : "s"}
            {nonCompletedStatus ? ` · ${nonCompletedStatus}` : ""}
          </p>
        </div>
      </div>
      <ChevronRight size={18} className="shrink-0 text-[var(--color-ink-muted)]" />
    </button>
  );
}

function groupLibraryOutputs(args: {
  outputs: LibraryOutput[];
  workflows?: WorkflowDoc[];
  runs?: WorkflowRunDoc[];
}) {
  const workflowsById = new Map((args.workflows ?? []).map((workflow) => [String(workflow._id), workflow]));
  const runsById = new Map((args.runs ?? []).map((run) => [String(run._id), run]));
  const runGroupsById = new Map<string, LibraryRunGroup>();

  for (const output of args.outputs) {
    if (!output.workflowId || !output.workflowRunId) continue;
    const run = runsById.get(output.workflowRunId);
    const existing = runGroupsById.get(output.workflowRunId);
    if (existing) {
      existing.outputs.push(output);
      existing.createdAt = Math.max(existing.createdAt, output.createdAt);
      continue;
    }

    runGroupsById.set(output.workflowRunId, {
      id: output.workflowRunId,
      workflowId: output.workflowId,
      run,
      outputs: [output],
      createdAt: output.createdAt,
    });
  }

  const workflowGroupsById = new Map<string, LibraryWorkflowGroup>();

  for (const runGroup of runGroupsById.values()) {
    runGroup.outputs.sort((first, second) => second.createdAt - first.createdAt);
    const existing = workflowGroupsById.get(runGroup.workflowId);
    if (existing) {
      existing.runs.push(runGroup);
      existing.outputCount += runGroup.outputs.length;
      existing.latestAt = Math.max(existing.latestAt, runGroup.createdAt);
      continue;
    }

    workflowGroupsById.set(runGroup.workflowId, {
      id: runGroup.workflowId,
      workflow: workflowsById.get(runGroup.workflowId),
      runs: [runGroup],
      outputCount: runGroup.outputs.length,
      latestAt: runGroup.createdAt,
    });
  }

  return [...workflowGroupsById.values()]
    .map((folder) => ({
      ...folder,
      runs: folder.runs.sort((first, second) => second.createdAt - first.createdAt),
    }))
    .sort((first, second) => second.latestAt - first.latestAt);
}

export function LibraryPage() {
  const { activeWorkspace, activeWorkspaceId } = useWorkspace();
  const workspaceArgs = activeWorkspaceId ? { workspaceId: activeWorkspaceId } : {};
  const artifacts = useQuery(api.artifacts.records.list, {
    ...workspaceArgs,
    includeDebug: true,
  });
  const brands = useQuery(api.accounts.brands.list, workspaceArgs);
  const workflows = useQuery(api.workflows.definitions.list, workspaceArgs);
  const runs = useQuery(api.workflows.runs.list, workspaceArgs);
  const creativeAssets = useQuery(api.accounts.creativeAssets.list, workspaceArgs);
  const generateImage = useAction(api.content.createAssets.generateImage);
  const uploadMedia = useAction(api.storage.files.uploadBase64ImageWithMetadata);
  const createCreativeAsset = useMutation(api.accounts.creativeAssets.create);
  const updateCreativeAsset = useMutation(api.accounts.creativeAssets.update);
  const deleteCreativeAsset = useMutation(api.accounts.creativeAssets.remove);
  const deleteArtifact = useMutation(api.artifacts.records.remove);
  const updateArtifactTitle = useMutation(api.artifacts.records.updateTitle);
  const approveImageReplacement = useMutation(api.artifacts.records.approveImageReplacement);
  const [libraryView, setLibraryView] = useState<"assets" | "workflows">("assets");
  const [brandFilter, setBrandFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [deletingArtifactId, setDeletingArtifactId] = useState<string | null>(null);
  const [libraryStatus, setLibraryStatus] = useState("");
  const [renamingOutput, setRenamingOutput] = useState<LibraryOutput | null>(null);
  const [isAddMediaOpen, setIsAddMediaOpen] = useState(false);
  const [isAddingMedia, setIsAddingMedia] = useState(false);
  const [addMediaStatus, setAddMediaStatus] = useState("");
  const [editingOutput, setEditingOutput] = useState<LibraryOutput | null>(null);
  const [revisionPrompt, setRevisionPrompt] = useState("");
  const [candidateImage, setCandidateImage] = useState<CandidateImage | undefined>();
  const [revisionStatus, setRevisionStatus] = useState("");
  const [isGeneratingRevision, setIsGeneratingRevision] = useState(false);
  const [isApprovingRevision, setIsApprovingRevision] = useState(false);
  const [lightboxMedia, setLightboxMedia] = useState<MediaLightboxItem | null>(null);
  const imageGenerationDefault = useMemo(
    () => generationDefaultForMode(activeWorkspace?.aiGenerationSettings, "image"),
    [activeWorkspace?.aiGenerationSettings]
  );

  useEffect(() => {
    if (!editingOutput) return;
    setRevisionPrompt(editingOutput.prompt ?? "");
    setCandidateImage(undefined);
    setRevisionStatus("");
  }, [editingOutput]);

  const workflowOutputs = useMemo(
    () => outputsFromArtifacts(artifacts ?? []),
    [artifacts]
  );
  const createOutputs = useMemo(
    () =>
      [
        ...creativeAssetOutputsFromAssets(creativeAssets ?? []),
        ...createOutputsFromArtifacts(artifacts ?? []),
      ].sort((first, second) => second.createdAt - first.createdAt),
    [artifacts, creativeAssets]
  );

  const filteredCreateOutputs = useMemo(
    () => createOutputs.filter((output) => {
      if (brandFilter && output.brandId !== brandFilter) return false;
      if (typeFilter && output.type !== typeFilter) return false;
      return true;
    }),
    [brandFilter, createOutputs, typeFilter]
  );

  const filteredWorkflowOutputs = useMemo(
    () => workflowOutputs.filter((output) => {
      if (brandFilter && output.brandId !== brandFilter) return false;
      if (typeFilter && output.type !== typeFilter) return false;
      return true;
    }),
    [brandFilter, typeFilter, workflowOutputs]
  );

  const folders = useMemo(
    () => groupLibraryOutputs({ outputs: filteredWorkflowOutputs, runs, workflows }),
    [filteredWorkflowOutputs, runs, workflows]
  );

  const selectedFolder = folders.find((folder) => folder.id === selectedWorkflowId);
  const selectedRun = selectedFolder?.runs.find((run) => run.id === selectedRunId);
  const outputTypes = useMemo(
    () =>
      Array.from(
        new Set([...createOutputs, ...workflowOutputs].map((output) => output.type))
      ).sort(),
    [createOutputs, workflowOutputs]
  );
  const loading = !artifacts || !runs || !workflows || !creativeAssets;

  const clearSelection = () => {
    setSelectedWorkflowId(null);
    setSelectedRunId(null);
  };

  const removeSavedAsset = async (output: LibraryOutput) => {
    if (!output.artifactId && !output.creativeAssetId) return;
    const confirmed = window.confirm(`Delete "${output.title}" from the library?`);
    if (!confirmed) return;

    setDeletingArtifactId(String(output.artifactId ?? output.creativeAssetId));
    setLibraryStatus("");
    try {
      if (output.artifactId) {
        await deleteArtifact({ id: output.artifactId });
      } else if (output.creativeAssetId) {
        await deleteCreativeAsset({ id: output.creativeAssetId });
      }
      setLibraryStatus("Asset deleted");
    } catch (error) {
      setLibraryStatus(error instanceof Error ? error.message : "Unable to delete asset");
    } finally {
      setDeletingArtifactId(null);
    }
  };

  const renameSavedAsset = async (output: LibraryOutput, title: string) => {
    if (!output.artifactId && !output.creativeAssetId) return;
    setLibraryStatus("");
    try {
      if (output.artifactId) {
        await updateArtifactTitle({ id: output.artifactId, title });
      } else if (output.creativeAssetId) {
        await updateCreativeAsset({ id: output.creativeAssetId, name: title });
      }
      setLibraryStatus("Title updated");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update title";
      setLibraryStatus(message);
      throw new Error(message);
    }
  };

  const addReusableMedia = async (args: {
    file: File;
    name: string;
  }) => {
    setIsAddingMedia(true);
    setAddMediaStatus("Uploading media...");
    setLibraryStatus("");
    try {
      const stored = await uploadMedia({
        base64Data: await fileToDataUrl(args.file),
        filename: args.file.name,
      });
      setAddMediaStatus("Saving media to library...");
      await createCreativeAsset({
        workspaceId: activeWorkspaceId as Id<"workspaces"> | undefined,
        name: args.name,
        assetKind: assetKindFromFile(args.file),
        mediaType: mediaTypeFromFile(args.file),
        storageUrl: stored.storageUrl,
        mimeType: stored.mimeType,
      });
      setAddMediaStatus("");
      setLibraryStatus("Media added to library");
      setLibraryView("assets");
      clearSelection();
      setIsAddMediaOpen(false);
    } catch (error) {
      setAddMediaStatus(error instanceof Error ? error.message : "Unable to add media");
    } finally {
      setIsAddingMedia(false);
    }
  };

  const discardCandidate = async () => {
    if (!candidateImage) return;
    const artifactId = candidateImage.artifactId;
    setCandidateImage(undefined);
    try {
      await deleteArtifact({ id: artifactId });
    } catch {
      // Best-effort cleanup. Preview candidates are hidden from the saved library either way.
    }
  };

  const closeRevisionModal = async () => {
    await discardCandidate();
    setEditingOutput(null);
    setRevisionStatus("");
  };

  const generateRevisionCandidate = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingOutput?.artifactId || !revisionPrompt.trim()) return;

    await discardCandidate();
    setIsGeneratingRevision(true);
    setRevisionStatus("Generating a revised image...");
    try {
      const generated = await generateImage({
        workspaceId: activeWorkspaceId as Id<"workspaces"> | undefined,
        brandId: editingOutput.brandId as Id<"brands"> | undefined,
        prompt: libraryImageEditPrompt(revisionPrompt),
        provider: imageGenerationDefault.provider,
        aspectRatio: generationAspectRatio(editingOutput),
        count: 1,
        referenceImages: [libraryImageReference(editingOutput)],
      });
      const asset = generated.assets[0];
      if (!asset) throw new Error("Image generation returned no candidate.");
      setCandidateImage({
        artifactId: asset.artifactId,
        storageUrl: asset.storageUrl,
        title: asset.title,
      });
      setRevisionStatus(
        `Candidate ready via ${AI_PROVIDER_LABELS[imageGenerationDefault.provider]}. Approve it to replace the saved image.`
      );
    } catch (error) {
      setRevisionStatus(
        error instanceof Error ? error.message : "Unable to generate revised image"
      );
    } finally {
      setIsGeneratingRevision(false);
    }
  };

  const approveRevisionCandidate = async () => {
    if (!editingOutput?.artifactId || !candidateImage) return;

    setIsApprovingRevision(true);
    setRevisionStatus("Replacing saved image...");
    try {
      await approveImageReplacement({
        originalArtifactId: editingOutput.artifactId,
        candidateArtifactId: candidateImage.artifactId,
      });
      setLibraryStatus("Saved image replaced");
      setEditingOutput(null);
      setCandidateImage(undefined);
      setRevisionStatus("");
    } catch (error) {
      setRevisionStatus(error instanceof Error ? error.message : "Unable to replace image");
    } finally {
      setIsApprovingRevision(false);
    }
  };

  const title = selectedRun
    ? formatRunTime(selectedRun.run, selectedRun.createdAt)
    : selectedFolder?.workflow?.name ??
      (libraryView === "assets" ? "Saved Assets" : "Workflow Exports");

  return (
    <Page
      title="Library"
      description={`Saved assets and workflow exports for ${activeWorkspace?.name ?? "this workspace"}.`}
    >
      <Panel title={title}>
        <div className="section-toolbar">
          <div className="grid min-w-0 gap-[var(--space-3)]">
            <div className="flex flex-wrap gap-[var(--space-2)]">
              <button
                className={libraryView === "assets" ? "primary-button" : "secondary-button"}
                type="button"
                onClick={() => {
                  setLibraryView("assets");
                  clearSelection();
                }}
              >
                Saved assets
              </button>
              <button
                className={libraryView === "workflows" ? "primary-button" : "secondary-button"}
                type="button"
                onClick={() => {
                  setLibraryView("workflows");
                  clearSelection();
                }}
              >
                Workflow exports
              </button>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-[var(--space-2)]">
            {(selectedFolder || selectedRun) && (
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  if (selectedRun) {
                    setSelectedRunId(null);
                  } else {
                    clearSelection();
                  }
                }}
              >
                <ArrowLeft size={16} />
                Back
              </button>
            )}
            <div className="min-w-0 text-[0.9rem] text-[var(--color-ink-muted)]">
              {selectedRun
                ? `${selectedRun.outputs.length} output${selectedRun.outputs.length === 1 ? "" : "s"}`
                : selectedFolder
                  ? `${selectedFolder.runs.length} run${selectedFolder.runs.length === 1 ? "" : "s"} · ${selectedFolder.outputCount} output${selectedFolder.outputCount === 1 ? "" : "s"}`
                  : libraryView === "assets"
                    ? `${filteredCreateOutputs.length} saved asset${filteredCreateOutputs.length === 1 ? "" : "s"}`
                    : `${folders.length} workflow folder${folders.length === 1 ? "" : "s"} · ${filteredWorkflowOutputs.length} output${filteredWorkflowOutputs.length === 1 ? "" : "s"}`}
            </div>
            </div>
          </div>
          <div className="filter-grid">
            <Select label="Brand" value={brandFilter} onChange={setBrandFilter}>
              <option value="">All brands</option>
              {brands?.map((brand) => (
                <option key={brand._id} value={brand._id}>
                  {brand.name}
                </option>
              ))}
            </Select>
            <Select label="Type" value={typeFilter} onChange={setTypeFilter}>
              <option value="">All output types</option>
              {outputTypes.map((type) => (
                <option key={type} value={type}>
                  {type.replaceAll("_", " ")}
                </option>
              ))}
            </Select>
            <button
              className="secondary-button self-end"
              type="button"
              onClick={() => {
                setBrandFilter("");
                setTypeFilter("");
                clearSelection();
              }}
            >
              Clear filters
            </button>
            {libraryView === "assets" && !selectedFolder && !selectedRun ? (
              <button
                className="primary-button self-end"
                type="button"
                onClick={() => {
                  setAddMediaStatus("");
                  setIsAddMediaOpen(true);
                }}
              >
                <Plus size={16} />
                Add media
              </button>
            ) : null}
          </div>
        </div>
        {libraryStatus ? (
          <p className="m-0 text-[0.86rem] text-[var(--color-ink-muted)]">{libraryStatus}</p>
        ) : null}

        {loading && (
          <LoadingState
            detail="Fetching saved assets, workflow exports, and run history."
            title="Loading library"
          />
        )}
        {!loading && libraryView === "assets" && filteredCreateOutputs.length === 0 && (
          <div className="empty-state">
            {createOutputs.length === 0
              ? "No saved assets yet. Add reusable media or save a generated result here."
              : "No saved assets match these filters."}
          </div>
        )}
        {!loading && libraryView === "workflows" && folders.length === 0 && (
          <div className="empty-state">
            {workflowOutputs.length === 0
              ? "No media library exports yet."
              : "No exports match these filters."}
          </div>
        )}

        {!loading && libraryView === "assets" && filteredCreateOutputs.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,11rem),16rem))] items-start justify-start gap-[var(--space-3)]">
            {filteredCreateOutputs.map((output) => (
              <OutputCard
                isDeleting={
                  deletingArtifactId === String(output.artifactId ?? output.creativeAssetId)
                }
                key={output.id}
                onOpenMedia={(mediaOutput) => setLightboxMedia(lightboxMediaForOutput(mediaOutput))}
                onEdit={editableImageOutput(output) ? () => setEditingOutput(output) : undefined}
                onDelete={() => void removeSavedAsset(output)}
                onRename={
                  output.artifactId || output.creativeAssetId
                    ? () => setRenamingOutput(output)
                    : undefined
                }
                output={output}
              />
            ))}
          </div>
        )}

        {!loading && libraryView === "workflows" && !selectedFolder && folders.length > 0 && (
          <div className="artifact-grid">
            {folders.map((folder) => (
              <FolderButton
                key={folder.id}
                folder={folder}
                onOpen={() => {
                  setSelectedWorkflowId(folder.id);
                  setSelectedRunId(null);
                }}
              />
            ))}
          </div>
        )}

        {!loading && libraryView === "workflows" && selectedFolder && !selectedRun && (
          <div className="grid gap-[var(--space-3)]">
            {selectedFolder.runs.map((runGroup) => (
              <RunRow
                key={runGroup.id}
                group={runGroup}
                onOpen={() => setSelectedRunId(runGroup.id)}
              />
            ))}
          </div>
        )}

        {!loading && libraryView === "workflows" && selectedRun && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,11rem),16rem))] items-start justify-start gap-[var(--space-3)]">
            {selectedRun.outputs.map((output) => (
              <OutputCard
                key={output.id}
                onOpenMedia={(mediaOutput) => setLightboxMedia(lightboxMediaForOutput(mediaOutput))}
                onRename={
                  output.artifactId
                    ? () => setRenamingOutput(output)
                    : undefined
                }
                output={output}
              />
            ))}
          </div>
        )}
        <MediaLightbox media={lightboxMedia} onClose={() => setLightboxMedia(null)} />
        {renamingOutput ? (
          <TitleRenameModal
            onCancel={() => setRenamingOutput(null)}
            onSave={(nextTitle) => renameSavedAsset(renamingOutput, nextTitle)}
            output={renamingOutput}
          />
        ) : null}
        {editingOutput ? (
          <ImageRevisionModal
            candidate={candidateImage}
            isApproving={isApprovingRevision}
            isGenerating={isGeneratingRevision}
            onApprove={() => void approveRevisionCandidate()}
            onCancel={() => void closeRevisionModal()}
            onGenerate={(event) => void generateRevisionCandidate(event)}
            output={editingOutput}
            prompt={revisionPrompt}
            status={revisionStatus}
            setPrompt={setRevisionPrompt}
          />
        ) : null}
        {isAddMediaOpen ? (
          <AddMediaModal
            isSaving={isAddingMedia}
            onCancel={() => {
              if (isAddingMedia) return;
              setIsAddMediaOpen(false);
              setAddMediaStatus("");
            }}
            onSave={addReusableMedia}
            status={addMediaStatus}
          />
        ) : null}
      </Panel>
    </Page>
  );
}
