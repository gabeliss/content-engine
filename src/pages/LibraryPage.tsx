import { useQuery } from "convex/react";
import { ArrowLeft, ChevronRight, ExternalLink, Folder, Image as ImageIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "../../convex/_generated/api";
import { Page, Panel, Select } from "../components/ui";
import { artifactSummary } from "../lib/artifactUtils";
import type { ArtifactDoc, WorkflowDoc, WorkflowRunDoc } from "../types";

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
  title: string;
  type: string;
  createdAt: number;
  brandId?: string;
  workflowId: string;
  workflowRunId: string;
  provider?: string;
  model?: string;
  prompt?: string;
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
        title: item.title?.trim() || "Exported media",
        type: item.artifactType ?? item.role ?? "media",
        createdAt: exportTimestamp(artifact),
        brandId: artifact.brandId ? String(artifact.brandId) : undefined,
        workflowId: String(artifact.workflowId),
        workflowRunId: String(artifact.workflowRunId),
        provider: item.provider,
        model: item.model,
        prompt: sourceArtifact?.prompt,
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

function MediaPreview({ output }: { output: LibraryOutput }) {
  const [naturalAspectRatio, setNaturalAspectRatio] = useState<string | undefined>();
  const resolvedAspectRatio = output.aspectRatio ?? naturalAspectRatio;

  return (
    <div
      className="artifact-preview image-preview library-media-preview"
      style={resolvedAspectRatio ? { aspectRatio: resolvedAspectRatio } : undefined}
    >
      {output.mimeType?.startsWith("video/") || output.type === "video" ? (
        <video src={output.storageUrl} controls />
      ) : (
        <img
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
    </div>
  );
}

function OutputCard({ output }: { output: LibraryOutput }) {
  const metadata = [
    output.provider,
    output.model,
  ].filter(Boolean);

  return (
    <article className="artifact-card">
      <MediaPreview output={output} />
      <div className="artifact-copy">
        <div className="entity-eyebrow">{output.type.replaceAll("_", " ")}</div>
        <h3>{output.title}</h3>
        {metadata.length > 0 && <p>{metadata.join(" · ")}</p>}
        {output.prompt && <p>{output.prompt}</p>}
        {!output.prompt && output.summary && <p>{output.summary}</p>}
      </div>
      <div className="flex flex-wrap gap-[var(--space-2)]">
        <a
          className="secondary-button"
          href={output.storageUrl}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={16} />
          Open output
        </a>
      </div>
    </article>
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
  const artifacts = useQuery(api.artifacts.records.list, { includeDebug: true });
  const brands = useQuery(api.accounts.brands.list);
  const workflows = useQuery(api.workflows.definitions.list);
  const runs = useQuery(api.workflows.runs.list, {});
  const [brandFilter, setBrandFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const outputs = useMemo(
    () => outputsFromArtifacts(artifacts ?? []),
    [artifacts]
  );

  const filteredOutputs = useMemo(
    () => outputs.filter((output) => {
      if (brandFilter && output.brandId !== brandFilter) return false;
      if (typeFilter && output.type !== typeFilter) return false;
      return true;
    }),
    [brandFilter, outputs, typeFilter]
  );

  const folders = useMemo(
    () => groupLibraryOutputs({ outputs: filteredOutputs, runs, workflows }),
    [filteredOutputs, runs, workflows]
  );

  const selectedFolder = folders.find((folder) => folder.id === selectedWorkflowId);
  const selectedRun = selectedFolder?.runs.find((run) => run.id === selectedRunId);
  const outputTypes = useMemo(
    () => Array.from(new Set(outputs.map((output) => output.type))).sort(),
    [outputs]
  );
  const loading = !artifacts || !runs || !workflows;

  const clearSelection = () => {
    setSelectedWorkflowId(null);
    setSelectedRunId(null);
  };

  const title = selectedRun
    ? formatRunTime(selectedRun.run, selectedRun.createdAt)
    : selectedFolder?.workflow?.name ?? "Media Library";

  return (
    <Page title="Library" description="Exports organized by workflow and run.">
      <Panel title={title}>
        <div className="section-toolbar">
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
                  : `${folders.length} workflow folder${folders.length === 1 ? "" : "s"} · ${filteredOutputs.length} output${filteredOutputs.length === 1 ? "" : "s"}`}
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
          </div>
        </div>

        {loading && <div className="empty-state">Loading library...</div>}
        {!loading && folders.length === 0 && (
          <div className="empty-state">
            {outputs.length === 0
              ? "No media library exports yet."
              : "No exports match these filters."}
          </div>
        )}

        {!loading && !selectedFolder && folders.length > 0 && (
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

        {!loading && selectedFolder && !selectedRun && (
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

        {!loading && selectedRun && (
          <div className="artifact-grid">
            {selectedRun.outputs.map((output) => (
              <OutputCard key={output.id} output={output} />
            ))}
          </div>
        )}
      </Panel>
    </Page>
  );
}
