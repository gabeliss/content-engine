import { useAction, useMutation, useQuery } from "convex/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Film,
  FolderOpen,
  Music,
  Plus,
  Scissors,
  SlidersHorizontal,
  Trash2,
  Type,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { CustomSelect } from "../components/CustomSelect";
import { LoadingSignal } from "../components/ui";
import { useWorkspace } from "../contexts/WorkspaceContext";
import {
  createOutputsFromArtifacts,
  creativeAssetOutputsFromAssets,
  workflowOutputsFromArtifacts,
} from "../features/library/libraryOutputs";
import { isVideoOutput } from "../features/library/libraryMedia";
import type { LibraryOutput } from "../features/library/libraryTypes";
import { renderVideoCompositionToBlob } from "../features/video-composer/renderVideoComposition";
import { VideoComposerPreview } from "../features/video-composer/VideoComposerPreview";
import { VideoStudioProjectHub } from "../features/video-composer/VideoStudioProjectHub";
import { VideoComposerTimeline } from "../features/video-composer/VideoComposerTimeline";
import {
  clampTimelineTime,
  clipFromLibraryOutput,
  clipStartTime,
  compositionDuration,
  createEmptyVideoCompositionDraft,
  createTimedTextOverlay,
  formatTimelineTime,
  normalizedClipTrim,
  type TimedTextOverlay,
  type VideoComposerClip,
  type VideoCompositionDraft,
} from "../features/video-composer/videoComposerModel";
import {
  COMPOSITION_ASPECT_RATIO_OPTIONS,
  dimensionsForAspectRatio,
  type CompositionAspectRatio,
} from "../lib/composition/aspectRatios";
import {
  applyTextStylePreset,
  textStylePresetForBlock,
  withAutoTextOverlayBlockHeight,
  type TextStylePreset,
} from "../lib/composition/textOverlays";
import { blobToDataUrl } from "../lib/browser/dataUrl";

function videoDurationForUrl(url: string) {
  return new Promise<number>((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.crossOrigin = "anonymous";
    video.onloadedmetadata = () => resolve(video.duration || 0);
    video.onerror = () => resolve(0);
    video.src = url;
  });
}

function SliderControl({
  label,
  max,
  min,
  onChange,
  suffix = "",
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  suffix?: string;
  value: number;
}) {
  return (
    <label className="grid min-w-[8rem] flex-1 gap-1 text-[0.74rem] font-[760] text-[var(--color-ink-muted)]">
      <span className="flex items-center justify-between gap-2">
        {label}
        <strong className="font-[780] text-[var(--color-ink)]">
          {Math.round(value)}
          {suffix}
        </strong>
      </span>
      <input
        className="w-full accent-[var(--color-primary)]"
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        type="range"
        value={value}
      />
    </label>
  );
}

function isCompositionAspectRatioValue(value: string): value is CompositionAspectRatio {
  return COMPOSITION_ASPECT_RATIO_OPTIONS.some((option) => option.value === value);
}

function sourceParamMatches(output: LibraryOutput, key: string | null, value: string | null) {
  if (!key || !value) return false;
  if (key === "artifactId") return String(output.artifactId ?? "") === value;
  if (key === "creativeAssetId") return String(output.creativeAssetId ?? "") === value;
  return output.id === value;
}

export function VideoComposerPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeWorkspace, activeWorkspaceId } = useWorkspace();
  const workspaceArgs = activeWorkspaceId ? { workspaceId: activeWorkspaceId } : {};
  const projectId = searchParams.get("projectId") as Id<"videoProjects"> | null;
  const artifacts = useQuery(api.artifacts.records.list, {
    ...workspaceArgs,
    includeDebug: true,
  });
  const creativeAssets = useQuery(api.accounts.creativeAssets.list, workspaceArgs);
  const videoProjects = useQuery(api.content.videoProjects.list, workspaceArgs);
  const currentProject = useQuery(
    api.content.videoProjects.get,
    projectId ? { id: projectId } : "skip"
  );
  const uploadMedia = useAction(api.storage.files.uploadBase64ImageWithMetadata);
  const createArtifact = useMutation(api.artifacts.records.create);
  const createVideoProject = useMutation(api.content.videoProjects.create);
  const updateVideoProject = useMutation(api.content.videoProjects.update);
  const touchVideoProject = useMutation(api.content.videoProjects.touch);
  const archiveVideoProject = useMutation(api.content.videoProjects.archive);
  const [aspectRatio, setAspectRatio] = useState<CompositionAspectRatio>("9:16");
  const [clips, setClips] = useState<VideoComposerClip[]>([]);
  const [selectedClipId, setSelectedClipId] = useState("");
  const [textOverlays, setTextOverlays] = useState<TimedTextOverlay[]>([]);
  const [selectedTextId, setSelectedTextId] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [title, setTitle] = useState("Composed video");
  const [status, setStatus] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [playheadSeconds, setPlayheadSeconds] = useState(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [draggedClipId, setDraggedClipId] = useState("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState("");
  const [loadedProjectId, setLoadedProjectId] = useState("");
  const [autosaveStatus, setAutosaveStatus] = useState("Saved");
  const creatingSourceKeyRef = useRef("");
  const lastSavedSnapshotRef = useRef("");

  const videoOutputs = useMemo(
    () =>
      [
        ...creativeAssetOutputsFromAssets(creativeAssets ?? []),
        ...createOutputsFromArtifacts(artifacts ?? []),
        ...workflowOutputsFromArtifacts(artifacts ?? []),
      ]
        .filter(isVideoOutput)
        .sort((first, second) => second.createdAt - first.createdAt),
    [artifacts, creativeAssets]
  );
  const selectedText = textOverlays.find((overlay) => overlay.id === selectedTextId);
  const selectedClip = clips.find((clip) => clip.id === selectedClipId);
  const selectedClipIndex = clips.findIndex((clip) => clip.id === selectedClipId);
  const selectedClipTrim = selectedClip ? normalizedClipTrim(selectedClip) : undefined;
  const durationSeconds = compositionDuration(clips);
  const dimensions = dimensionsForAspectRatio(aspectRatio);
  const loading = !artifacts || !creativeAssets;
  const projectsLoading = videoProjects === undefined;
  const incomingSource = useMemo(() => {
    const artifactId = searchParams.get("artifactId");
    const creativeAssetId = searchParams.get("creativeAssetId");
    const outputId = searchParams.get("outputId");
    const key = artifactId ? "artifactId" : creativeAssetId ? "creativeAssetId" : "outputId";
    const value = artifactId ?? creativeAssetId ?? outputId;
    return value ? { identity: `${key}:${value}`, key, value } : null;
  }, [searchParams]);

  const createProject = async (draft = createEmptyVideoCompositionDraft(), projectTitle = "Untitled video") => {
    setIsCreatingProject(true);
    try {
      const nextProjectId = await createVideoProject({
        workspaceId: activeWorkspaceId,
        title: projectTitle,
        draft,
      });
      navigate(`/studio?projectId=${encodeURIComponent(String(nextProjectId))}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to create video project");
    } finally {
      setIsCreatingProject(false);
    }
  };

  const deleteProject = async (projectToDeleteId: Id<"videoProjects">) => {
    setDeletingProjectId(projectToDeleteId);
    try {
      await archiveVideoProject({ id: projectToDeleteId });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to delete video project");
    } finally {
      setDeletingProjectId("");
    }
  };

  useEffect(() => {
    setPlayheadSeconds((current) => clampTimelineTime(clips, current));
    if (clips.length === 0) setIsPreviewPlaying(false);
  }, [clips]);

  useEffect(() => {
    if (projectId || loading || !incomingSource) return;
    if (creatingSourceKeyRef.current === incomingSource.identity) return;
    const output = videoOutputs.find((candidate) =>
      sourceParamMatches(candidate, incomingSource.key, incomingSource.value)
    );
    if (!output) return;
    creatingSourceKeyRef.current = incomingSource.identity;
    const clip = clipFromLibraryOutput(output);
    const draft: VideoCompositionDraft = {
      ...createEmptyVideoCompositionDraft(),
      clips: [clip],
    };
    void createProject(draft, `${output.title} edit`);
  }, [incomingSource, loading, projectId, videoOutputs]);

  useEffect(() => {
    if (!projectId) {
      setLoadedProjectId("");
      return;
    }
    if (currentProject === undefined) return;
    if (!currentProject) {
      navigate("/studio", { replace: true });
      return;
    }
    if (loadedProjectId === currentProject._id) return;

    const draft: VideoCompositionDraft = {
      ...createEmptyVideoCompositionDraft(),
      ...(currentProject.draft as Partial<VideoCompositionDraft> | undefined),
    };
    setAspectRatio(draft.aspectRatio);
    setClips(draft.clips);
    setTextOverlays(draft.textOverlays);
    setTitle(currentProject.title);
    setSelectedClipId(draft.clips[0]?.id ?? "");
    setSelectedTextId(draft.textOverlays[0]?.id ?? "");
    setSelectedAssetId("");
    setPlayheadSeconds(0);
    setIsPreviewPlaying(false);
    setLoadedProjectId(currentProject._id);
    setAutosaveStatus("Saved");
    setStatus("");
    lastSavedSnapshotRef.current = JSON.stringify({
      title: currentProject.title,
      draft,
    });
    void touchVideoProject({ id: currentProject._id });
  }, [currentProject, loadedProjectId, navigate, projectId, touchVideoProject]);

  useEffect(() => {
    if (!projectId || loadedProjectId !== projectId || currentProject === undefined || !currentProject) return;
    const draft: VideoCompositionDraft = {
      aspectRatio,
      clips,
      textOverlays,
    };
    const snapshot = JSON.stringify({
      title,
      draft,
    });
    if (lastSavedSnapshotRef.current === snapshot) return;
    setAutosaveStatus("Saving...");
    const timeoutId = window.setTimeout(() => {
      void updateVideoProject({
        id: projectId,
        title,
        draft,
      })
        .then(() => {
          lastSavedSnapshotRef.current = snapshot;
          setAutosaveStatus(`Saved ${new Date().toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}`);
        })
        .catch((error) => {
          setAutosaveStatus("Autosave failed");
          setStatus(error instanceof Error ? error.message : "Autosave failed");
        });
    }, 700);
    return () => window.clearTimeout(timeoutId);
  }, [
    aspectRatio,
    clips,
    currentProject,
    loadedProjectId,
    projectId,
    textOverlays,
    title,
    updateVideoProject,
  ]);

  useEffect(() => {
    const missingDurationClips = clips.filter((clip) => !clip.durationSeconds);
    if (!missingDurationClips.length) return;
    let canceled = false;
    for (const clip of missingDurationClips) {
      void videoDurationForUrl(clip.storageUrl).then((durationSeconds) => {
        if (canceled || !durationSeconds) return;
        setClips((current) =>
          current.map((currentClip) =>
            currentClip.id === clip.id
              ? {
                  ...currentClip,
                  durationSeconds,
                  trimEndSeconds: currentClip.trimEndSeconds ?? durationSeconds,
                }
              : currentClip
          )
        );
      });
    }
    return () => {
      canceled = true;
    };
  }, [clips]);

  const addSelectedClip = () => {
    const output = videoOutputs.find((candidate) => candidate.id === selectedAssetId);
    if (!output) return;
    const clip = clipFromLibraryOutput(output);
    setClips((current) => [...current, clip]);
    setSelectedClipId(clip.id);
    setPlayheadSeconds(compositionDuration(clips));
    setSelectedAssetId("");
  };

  const reorderClipRelativeToTarget = (
    currentClips: VideoComposerClip[],
    clipId: string,
    targetClipId: string,
    placement: "before" | "after"
  ) => {
    if (clipId === targetClipId) return currentClips;
    const withoutDragged = currentClips.filter((clip) => clip.id !== clipId);
    const targetIndex = withoutDragged.findIndex((clip) => clip.id === targetClipId);
    if (targetIndex < 0) return currentClips;
    const insertIndex = placement === "after" ? targetIndex + 1 : targetIndex;
    return [
      ...withoutDragged.slice(0, insertIndex),
      currentClips.find((clip) => clip.id === clipId)!,
      ...withoutDragged.slice(insertIndex),
    ];
  };

  const updateSelectedClip = (patch: Partial<VideoComposerClip>) => {
    if (!selectedClip) return;
    setClips((current) =>
      current.map((clip) =>
        clip.id === selectedClip.id
          ? {
              ...clip,
              ...patch,
            }
          : clip
      )
    );
  };

  const updateTextOverlay = (textId: string, patch: Partial<TimedTextOverlay>) => {
    const shouldFitHeight =
      !("height" in patch) &&
      ("fontSize" in patch ||
        "items" in patch ||
        "strokeWidth" in patch ||
        "text" in patch ||
        "width" in patch);
    setTextOverlays((current) =>
      current.map((overlay, index) => {
        if (overlay.id !== textId) return overlay;
        const next = { ...overlay, ...patch };
        return shouldFitHeight
          ? withAutoTextOverlayBlockHeight(next, dimensions, index) as TimedTextOverlay
          : next;
      })
    );
  };

  const updateSelectedText = (patch: Partial<TimedTextOverlay>) => {
    if (!selectedText?.id) return;
    updateTextOverlay(selectedText.id, patch);
  };

  const addTextOverlay = () => {
    const overlay = createTimedTextOverlay(textOverlays.length);
    setTextOverlays((current) => [...current, overlay]);
    setSelectedTextId(overlay.id ?? "");
  };

  const exportComposition = async () => {
    if (clips.length === 0) return;
    setIsExporting(true);
    setStatus("Rendering edit in this browser...");
    setExportProgress(0);
    try {
      const draft: VideoCompositionDraft = {
        aspectRatio,
        clips,
        textOverlays,
      };
      const blob = await renderVideoCompositionToBlob(draft, {
        onProgress: (progress) => setExportProgress(progress.progress),
      });
      setStatus("Uploading rendered video...");
      const stored = await uploadMedia({
        base64Data: await blobToDataUrl(blob),
        filename: `${title.trim() || "composed-video"}.webm`,
      });
      const artifactId = await createArtifact({
        workspaceId: activeWorkspaceId as Id<"workspaces"> | undefined,
        parentArtifactIds: clips
          .map((clip) => clip.artifactId)
          .filter((artifactId): artifactId is Id<"artifacts"> => Boolean(artifactId)),
        type: "video",
        title: title.trim() || "Composed video",
        storageUrl: stored.storageUrl,
        lifecycle: "saved",
        reviewStatus: "approved",
        data: {
          source: "video_composer",
          mimeType: stored.mimeType,
          fileSize: stored.byteLength,
          aspectRatio,
          dimensions,
          durationSeconds,
          composition: draft,
          sourceCreativeAssetIds: clips
            .map((clip) => clip.creativeAssetId)
            .filter(Boolean)
            .map(String),
        },
      });
      setStatus(`Saved composed video to Library (${String(artifactId).slice(-6)}).`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to export video");
    } finally {
      setIsExporting(false);
    }
  };

  if (!projectId) {
    if (incomingSource) {
      return (
        <section className="grid h-screen min-h-0 w-full place-items-center bg-[var(--color-page)] text-[var(--color-ink-muted)]">
          <LoadingSignal label="Creating video project" showLabel size="sm" />
        </section>
      );
    }
    return (
      <VideoStudioProjectHub
        activeWorkspaceName={activeWorkspace?.name}
        isCreating={isCreatingProject}
        isDeletingProjectId={deletingProjectId}
        loading={projectsLoading}
        notice={status}
        onCreateProject={() => void createProject()}
        onDeleteProject={(projectToDeleteId) => void deleteProject(projectToDeleteId)}
        onOpenProject={(projectToOpenId) =>
          navigate(`/studio?projectId=${encodeURIComponent(String(projectToOpenId))}`)
        }
        projects={videoProjects}
      />
    );
  }

  if (currentProject === undefined || loadedProjectId !== projectId) {
    return (
      <section className="grid h-screen min-h-0 w-full place-items-center bg-[var(--color-page)] text-[var(--color-ink-muted)]">
        <LoadingSignal label="Opening video project" showLabel size="sm" />
      </section>
    );
  }

  return (
    <section className="h-screen min-h-0 w-full overflow-hidden bg-[var(--color-page)] text-[var(--color-ink)]">
      <div className="grid h-full min-h-0 grid-rows-[2.75rem_minmax(0,1fr)_20rem]">
        <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3">
          <div className="flex items-center gap-3 text-[0.78rem] font-[760] text-[var(--color-ink-muted)]">
            <button
              className="inline-flex min-h-8 items-center justify-center gap-2 rounded-[0.35rem] border border-[var(--color-border)] bg-[var(--color-page)] px-2 text-[0.76rem] font-[820] text-[var(--color-ink)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary-strong)]"
              onClick={() => navigate("/studio")}
              type="button"
            >
              <FolderOpen size={15} />
              Projects
            </button>
            <span className="font-[820] text-[var(--color-ink)]">Video Studio</span>
            <span>{activeWorkspace?.name ?? "Workspace"}</span>
            <span>{clips.length} clip{clips.length === 1 ? "" : "s"} · {formatTimelineTime(durationSeconds)}</span>
          </div>
          <input
            className="mx-auto h-8 w-full max-w-[24rem] rounded-[0.35rem] border border-[var(--color-border)] bg-[var(--color-page)] px-3 text-center text-[0.82rem] font-[760] text-[var(--color-ink)] outline-none focus:border-[var(--color-primary)]"
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
          <div className="flex items-center gap-2">
            {status ? (
              <span className="max-w-[18rem] truncate text-[0.74rem] font-[700] text-[var(--color-ink-muted)]">
                {status}
              </span>
            ) : null}
            <span className="hidden text-[0.72rem] font-[760] text-[var(--color-ink-muted)] sm:inline">
              {autosaveStatus}
            </span>
            <button
              className="inline-flex min-h-8 items-center justify-center gap-2 rounded-[0.35rem] bg-[var(--color-primary)] px-3 text-[0.78rem] font-[820] text-[var(--color-surface)] shadow-sm transition hover:bg-[var(--color-primary-strong)] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={isExporting || clips.length === 0}
              onClick={() => void exportComposition()}
              type="button"
            >
              {isExporting ? <LoadingSignal label="Exporting" size="sm" /> : <Upload size={15} />}
              Export
            </button>
          </div>
        </header>

        {loading ? (
          <div className="grid place-items-center text-[0.86rem] font-[720] text-[var(--color-ink-muted)]">
            <LoadingSignal label="Loading videos" showLabel size="sm" />
          </div>
        ) : (
          <div className="grid min-h-0 grid-cols-[20rem_minmax(0,1fr)_22rem] gap-1 bg-[var(--color-border)] p-1">
            <aside className="grid min-h-0 grid-cols-[4.2rem_minmax(0,1fr)] overflow-hidden rounded-[0.4rem] bg-[var(--color-surface)]">
              <nav className="grid content-start gap-1 border-r border-[var(--color-border)] bg-[var(--color-page-quiet)] p-2">
                {[
                  { label: "Media", icon: Film, active: true },
                  { label: "Audio", icon: Music },
                  { label: "Text", icon: Type },
                  { label: "Adjust", icon: SlidersHorizontal },
                ].map((item) => (
                  <button
                    className={[
                      "grid min-h-14 place-items-center rounded-[0.35rem] px-1 text-[0.68rem] font-[760] transition",
                      item.active
                        ? "bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]"
                        : "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]",
                    ].join(" ")}
                    key={item.label}
                    onClick={() => {
                      if (item.label === "Text") addTextOverlay();
                    }}
                    type="button"
                  >
                    <item.icon size={18} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
              <div className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3 p-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="m-0 text-[0.9rem] font-[820] text-[var(--color-ink)]">Media</h2>
                  <span className="text-[0.72rem] font-[760] text-[var(--color-ink-muted)]">
                    {videoOutputs.length}
                  </span>
                </div>
                <div className="grid gap-2">
                  <CustomSelect
                    dropdownClassName="!bg-[var(--color-surface)] !text-[var(--color-ink)]"
                    onChange={setSelectedAssetId}
                    options={videoOutputs.map((output) => ({
                      value: output.id,
                      label: output.title,
                      description: output.source.replace(/_/g, " "),
                      meta: output.type,
                    }))}
                    placeholder="Choose video"
                    rich
                    triggerClassName="grid min-h-9 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[0.35rem] border border-[var(--color-border)] bg-[var(--color-page)] px-3 py-2 text-left text-[0.8rem] font-[720] text-[var(--color-ink)] outline-none hover:border-[var(--color-border-strong)]"
                    value={selectedAssetId}
                  />
                  <button
                    className="inline-flex min-h-9 items-center justify-center gap-2 rounded-[0.35rem] bg-[var(--color-primary-soft)] px-3 text-[0.78rem] font-[820] text-[var(--color-primary-strong)] transition hover:bg-[var(--color-surface-tinted)] disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={!selectedAssetId}
                    onClick={addSelectedClip}
                    type="button"
                  >
                    <Plus size={15} />
                    Add to timeline
                  </button>
                </div>
                <div className="min-h-0 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-2">
                    {videoOutputs.slice(0, 12).map((output) => (
                      <button
                        className={[
                          "grid overflow-hidden rounded-[0.45rem] border bg-[var(--color-page)] text-left transition hover:border-[var(--color-primary)]",
                          selectedAssetId === output.id
                            ? "border-[var(--color-primary)] shadow-[0_0_0_2px_oklch(45%_0.105_174_/_0.12)]"
                            : "border-[var(--color-border)]",
                        ].join(" ")}
                        key={output.id}
                        onClick={() => setSelectedAssetId(output.id)}
                        type="button"
                      >
                        <span className="relative aspect-video overflow-hidden bg-[var(--color-page-quiet)]">
                          <video
                            className="h-full w-full object-cover"
                            muted
                            playsInline
                            preload="metadata"
                            src={output.storageUrl}
                          />
                        </span>
                        <span className="px-2 py-2 text-[0.72rem] font-[760] leading-tight text-[var(--color-ink)] [overflow-wrap:anywhere]">
                          {output.title}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </aside>

            <main className="grid min-h-0 grid-rows-[2.5rem_minmax(0,1fr)] overflow-hidden rounded-[0.4rem] bg-[var(--color-surface)]">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4">
                <h2 className="m-0 text-[0.9rem] font-[820] text-[var(--color-ink)]">Player</h2>
                <span className="text-[0.72rem] font-[760] text-[var(--color-ink-muted)]">
                  {formatTimelineTime(playheadSeconds, 2)} / {formatTimelineTime(durationSeconds, 2)}
                </span>
              </div>
              <div className="grid min-h-0 place-items-center p-3">
              <VideoComposerPreview
                aspectRatio={aspectRatio}
                clips={clips}
                isPlaying={isPreviewPlaying}
                onChangeText={(textId, patch) => updateTextOverlay(textId, patch as Partial<TimedTextOverlay>)}
                onPlayheadChange={setPlayheadSeconds}
                onPlayingChange={setIsPreviewPlaying}
                onSelectText={(textId) => {
                  setSelectedTextId(textId);
                  setSelectedClipId("");
                }}
                playheadSeconds={playheadSeconds}
                selectedTextId={selectedTextId}
                textOverlays={textOverlays}
              />
              </div>
            </main>

            <aside className="grid min-h-0 content-start gap-4 overflow-y-auto rounded-[0.4rem] bg-[var(--color-surface)] p-4">
              <div className="grid gap-2 border-b border-[var(--color-border)] pb-4">
                <h3 className="m-0 text-[0.9rem] font-[820] text-[var(--color-ink)]">Format</h3>
                <div className="grid grid-cols-2 gap-2">
                  {COMPOSITION_ASPECT_RATIO_OPTIONS.map((option) => {
                    const selected = option.value === aspectRatio;
                    return (
                      <button
                        className={[
                          "grid min-h-12 gap-1 rounded-[0.35rem] border px-3 py-2 text-left transition",
                          selected
                            ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]"
                            : "border-[var(--color-border)] bg-[var(--color-page)] text-[var(--color-ink)] hover:border-[var(--color-border-strong)]",
                        ].join(" ")}
                        key={option.value}
                        onClick={() => {
                          if (isCompositionAspectRatioValue(option.value)) setAspectRatio(option.value);
                        }}
                        type="button"
                      >
                        <span className="text-[0.86rem] font-[820]">{option.label}</span>
                        <span className="text-[0.66rem] font-[650] text-[var(--color-ink-muted)]">
                          {option.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-2">
                <h3 className="m-0 text-[0.9rem] font-[820] text-[var(--color-ink)]">Video</h3>
                {selectedClip && selectedClipTrim ? (
                  <div className="grid gap-3 rounded-[0.35rem] border border-[var(--color-border)] bg-[var(--color-page)] p-3">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="m-0 text-[0.88rem] font-[820] leading-tight text-[var(--color-ink)] [overflow-wrap:anywhere]">
                          {selectedClipIndex + 1}. {selectedClip.title}
                        </p>
                        <p className="m-0 text-[0.74rem] font-[700] text-[var(--color-ink-muted)]">
                          {formatTimelineTime(selectedClipTrim.endSeconds - selectedClipTrim.startSeconds)} in edit
                        </p>
                      </div>
                      <button
                        aria-label="Remove selected clip"
                        className="grid size-8 place-items-center rounded-[0.35rem] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-danger)] transition hover:border-[var(--color-danger)]"
                        onClick={() => {
                          setClips((current) => current.filter((clip) => clip.id !== selectedClip.id));
                          setSelectedClipId(clips.find((clip) => clip.id !== selectedClip.id)?.id ?? "");
                        }}
                        type="button"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 rounded-[0.35rem] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[0.78rem] font-[760] text-[var(--color-ink-muted)]">
                      <Scissors size={15} />
                      Trim source range
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <SliderControl
                        label="Start"
                        max={Math.max(0.1, (selectedClip.durationSeconds ?? 0) - 0.1)}
                        min={0}
                        onChange={(trimStartSeconds) => {
                          updateSelectedClip({
                            trimStartSeconds: Math.min(
                              trimStartSeconds,
                              (selectedClip.trimEndSeconds ?? selectedClip.durationSeconds ?? 0) - 0.1
                            ),
                          });
                          setPlayheadSeconds(clipStartTime(clips, selectedClip.id));
                        }}
                        suffix="s"
                        value={selectedClipTrim.startSeconds}
                      />
                      <SliderControl
                        label="End"
                        max={selectedClip.durationSeconds ?? 0.1}
                        min={Math.min(selectedClip.durationSeconds ?? 0, selectedClipTrim.startSeconds + 0.1)}
                        onChange={(trimEndSeconds) => {
                          updateSelectedClip({
                            trimEndSeconds: Math.max(trimEndSeconds, selectedClipTrim.startSeconds + 0.1),
                          });
                        }}
                        suffix="s"
                        value={selectedClipTrim.endSeconds}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[0.35rem] border border-[var(--color-border)] bg-[var(--color-page)] p-3 text-[0.78rem] font-[700] text-[var(--color-ink-muted)]">
                    Select a timeline clip to trim it.
                  </div>
                )}
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="m-0 text-[0.9rem] font-[820] text-[var(--color-ink)]">Text</h3>
                  <button
                    aria-label="Add text overlay"
                    className="grid size-8 place-items-center rounded-[0.35rem] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-primary)] transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
                    onClick={addTextOverlay}
                    type="button"
                  >
                    <Plus size={15} />
                  </button>
                </div>
                {textOverlays.length > 0 ? (
                  <CustomSelect
                    onChange={setSelectedTextId}
                    options={textOverlays.map((overlay, index) => ({
                      value: overlay.id ?? String(index),
                      label: overlay.text?.trim() || `Text ${index + 1}`,
                      meta: `${formatTimelineTime(overlay.startSeconds)} start`,
                    }))}
                    placeholder="Choose text"
                    value={selectedTextId}
                  />
                ) : null}
                {selectedText ? (
                  <div className="grid gap-3 rounded-[0.35rem] border border-[var(--color-border)] bg-[var(--color-page)] p-3">
                    <label className="grid gap-1 text-[0.76rem] font-[760] text-[var(--color-ink-muted)]">
                      <span>Copy</span>
                      <input
                        className="min-h-9 rounded-[0.35rem] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[0.82rem] text-[var(--color-ink)] outline-none focus:border-[var(--color-primary)]"
                        onChange={(event) => updateSelectedText({ text: event.target.value, items: [] })}
                        value={selectedText.text ?? ""}
                      />
                    </label>
                    <CustomSelect
                      onChange={(value) =>
                        updateSelectedText(
                          applyTextStylePreset(selectedText, value as TextStylePreset) as TimedTextOverlay
                        )
                      }
                      options={[
                        { value: "outline", label: "Outline" },
                        { value: "white", label: "White text" },
                        { value: "black", label: "Black text" },
                        { value: "yellow", label: "Yellow text" },
                        { value: "white_background", label: "White background" },
                        { value: "white_50_background", label: "White 50% background" },
                      ]}
                      placeholder="Style"
                      value={textStylePresetForBlock(selectedText)}
                    />
                    <div className="flex min-h-10 items-center gap-1 rounded-[0.35rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
                      <button
                        aria-label="Align left"
                        className="grid size-8 place-items-center rounded-[0.35rem] text-[var(--color-ink-muted)] hover:bg-[var(--color-page-quiet)] hover:text-[var(--color-ink)]"
                        onClick={() => updateSelectedText({ align: "left" })}
                        type="button"
                      >
                        <AlignLeft size={15} />
                      </button>
                      <button
                        aria-label="Align center"
                        className="grid size-8 place-items-center rounded-[0.35rem] text-[var(--color-ink-muted)] hover:bg-[var(--color-page-quiet)] hover:text-[var(--color-ink)]"
                        onClick={() => updateSelectedText({ align: "center" })}
                        type="button"
                      >
                        <AlignCenter size={15} />
                      </button>
                      <button
                        aria-label="Align right"
                        className="grid size-8 place-items-center rounded-[0.35rem] text-[var(--color-ink-muted)] hover:bg-[var(--color-page-quiet)] hover:text-[var(--color-ink)]"
                        onClick={() => updateSelectedText({ align: "right" })}
                        type="button"
                      >
                        <AlignRight size={15} />
                      </button>
                      <button
                        aria-label="Delete text overlay"
                        className="ml-auto grid size-8 place-items-center rounded-[0.35rem] text-[var(--color-danger)] hover:bg-[var(--color-page-quiet)]"
                        onClick={() => {
                          setTextOverlays((current) => current.filter((overlay) => overlay.id !== selectedText.id));
                          setSelectedTextId(textOverlays.find((overlay) => overlay.id !== selectedText.id)?.id ?? "");
                        }}
                        type="button"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <SliderControl
                        label="Start"
                        max={Math.max(durationSeconds, 0.1)}
                        min={0}
                        onChange={(startSeconds) =>
                          updateSelectedText({
                            startSeconds: Math.min(
                              startSeconds,
                              (selectedText.endSeconds ?? durationSeconds) - 0.1
                            ),
                          })
                        }
                        suffix="s"
                        value={selectedText.startSeconds ?? 0}
                      />
                      <SliderControl
                        label="End"
                        max={Math.max(durationSeconds, 0.1)}
                        min={Math.min(durationSeconds, (selectedText.startSeconds ?? 0) + 0.1)}
                        onChange={(endSeconds) =>
                          updateSelectedText({
                            endSeconds: Math.max(endSeconds, (selectedText.startSeconds ?? 0) + 0.1),
                          })
                        }
                        suffix="s"
                        value={selectedText.endSeconds ?? durationSeconds}
                      />
                      <SliderControl label="X" max={88} min={0} onChange={(x) => updateSelectedText({ x })} suffix="%" value={selectedText.x ?? 10} />
                      <SliderControl label="Y" max={92} min={0} onChange={(y) => updateSelectedText({ y })} suffix="%" value={selectedText.y ?? 42} />
                      <SliderControl label="Width" max={100} min={12} onChange={(width) => updateSelectedText({ width })} suffix="%" value={selectedText.width ?? 80} />
                      <SliderControl label="Size" max={150} min={20} onChange={(fontSize) => updateSelectedText({ fontSize })} suffix="px" value={selectedText.fontSize ?? 72} />
                    </div>
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        )}
        <footer className="grid min-h-0 grid-rows-[2.2rem_minmax(0,1fr)] border-t border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3">
            <div className="flex items-center gap-2 text-[0.78rem] font-[760] text-[var(--color-ink-muted)]">
              <Film size={15} />
              <span>{formatTimelineTime(playheadSeconds, 2)}</span>
              <span>/</span>
              <span>{formatTimelineTime(durationSeconds, 2)}</span>
            </div>
            {isExporting ? (
              <div className="h-1.5 w-52 overflow-hidden rounded-full bg-[var(--color-page-quiet)]">
                <div
                  className="h-full rounded-full bg-[var(--color-primary)] transition-all"
                  style={{ width: `${Math.round(exportProgress * 100)}%` }}
                />
              </div>
            ) : null}
          </div>
          <div className="min-h-0 overflow-hidden p-3">
            <VideoComposerTimeline
              clips={clips}
              draggedClipId={draggedClipId}
              onDragEnd={() => setDraggedClipId("")}
              onDragOverClip={(targetClipId, placement) => {
                setClips((current) =>
                  reorderClipRelativeToTarget(current, draggedClipId, targetClipId, placement)
                );
              }}
              onDragStart={setDraggedClipId}
              onRemoveClip={(clipId) => {
                setClips((current) => current.filter((clip) => clip.id !== clipId));
                if (selectedClipId === clipId) {
                  const nextClip = clips.find((clip) => clip.id !== clipId);
                  setSelectedClipId(nextClip?.id ?? "");
                }
              }}
              onSeek={(timeSeconds) => {
                setIsPreviewPlaying(false);
                setPlayheadSeconds(timeSeconds);
              }}
              onSelectClip={(clipId) => {
                setSelectedClipId(clipId);
                setSelectedTextId("");
              }}
              onSelectText={(textId) => {
                setSelectedTextId(textId);
                setSelectedClipId("");
              }}
              onTrimClip={(clipId, patch) => {
                setClips((current) =>
                  current.map((clip) => (clip.id === clipId ? { ...clip, ...patch } : clip))
                );
              }}
              onTrimText={(textId, patch) => updateTextOverlay(textId, patch)}
              playheadSeconds={playheadSeconds}
              selectedClipId={selectedClipId}
              selectedTextId={selectedTextId}
              textOverlays={textOverlays}
              totalDurationSeconds={durationSeconds}
            />
          </div>
        </footer>
      </div>
    </section>
  );
}
