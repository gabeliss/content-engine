import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import {
  Archive,
  Download,
  ExternalLink,
  FileText,
  Image,
  Music,
  Pencil,
  Video,
} from "lucide-react";
import type { AgentCreateArtifact, AgentCreateArtifactKind } from "./agentCreateTypes";
import { agentCreateClassNames } from "./agentCreateUi";

const artifactIcons: Record<AgentCreateArtifactKind, typeof Image> = {
  audio: Music,
  document: FileText,
  file: FileText,
  image: Image,
  slideshow: FileText,
  video: Video,
};

export function AgentCreateArtifactCard({
  artifact,
  compact = false,
  onDownload,
  onOpen,
  onOpenStudio,
  onSave,
}: {
  artifact: AgentCreateArtifact;
  compact?: boolean;
  onDownload?: (artifact: AgentCreateArtifact) => void;
  onOpen?: (artifact: AgentCreateArtifact) => void;
  onOpenStudio?: (artifact: AgentCreateArtifact) => void;
  onSave?: (artifact: AgentCreateArtifact) => void;
}) {
  const Icon = artifactIcons[artifact.kind];
  const isReady = artifact.status === "ready";
  const isWorking = artifact.status === "generating" || artifact.status === "placeholder";
  const mediaUrl = artifact.url ?? artifact.thumbnailUrl;
  const isDirectGeneratedArtifact = isReady && !artifact.id.includes(":");
  const canOpenInStudio = artifact.id.startsWith("studio:") ||
    (isDirectGeneratedArtifact && (artifact.kind === "image" || artifact.kind === "video"));
  const [menuPoint, setMenuPoint] = useState<{ x: number; y: number } | null>(null);
  const hasMenuActions = Boolean(
    (onSave && isDirectGeneratedArtifact) ||
      (onOpenStudio && canOpenInStudio) ||
      (onDownload && artifact.url) ||
      (onOpen && artifact.url)
  );

  useEffect(() => {
    if (!menuPoint) return;

    const closeMenu = () => setMenuPoint(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuPoint]);

  const openContextMenu = (event: ReactMouseEvent) => {
    if (!hasMenuActions || !isReady) return;
    event.preventDefault();
    const menuWidth = 176;
    const menuHeight = 176;
    setMenuPoint({
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)),
    });
  };

  const runMenuAction = (action?: (selectedArtifact: AgentCreateArtifact) => void) => {
    setMenuPoint(null);
    action?.(artifact);
  };

  const contextMenu = menuPoint ? (
    <div
      className="fixed z-[90] grid min-w-40 overflow-hidden rounded-[0.7rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-1 text-[0.78rem] font-[720] text-[var(--color-ink)] shadow-[var(--shadow-lg)]"
      onClick={(event) => event.stopPropagation()}
      style={{ left: menuPoint.x, top: menuPoint.y }}
    >
      {onSave && isDirectGeneratedArtifact ? (
        <button
          className="inline-flex min-h-8 items-center gap-2 rounded-[0.5rem] px-2 text-left transition hover:bg-[var(--color-page-quiet)]"
          onClick={() => runMenuAction(onSave)}
          type="button"
        >
          <Archive size={14} />
          Save to Library
        </button>
      ) : null}
      {onOpenStudio && canOpenInStudio ? (
        <button
          className="inline-flex min-h-8 items-center gap-2 rounded-[0.5rem] px-2 text-left transition hover:bg-[var(--color-page-quiet)]"
          onClick={() => runMenuAction(onOpenStudio)}
          type="button"
        >
          <Pencil size={14} />
          Open in Studio
        </button>
      ) : null}
      {onDownload && artifact.url ? (
        <button
          className="inline-flex min-h-8 items-center gap-2 rounded-[0.5rem] px-2 text-left transition hover:bg-[var(--color-page-quiet)]"
          onClick={() => runMenuAction(onDownload)}
          type="button"
        >
          <Download size={14} />
          Export
        </button>
      ) : null}
      {onOpen && artifact.url ? (
        <button
          className="inline-flex min-h-8 items-center gap-2 rounded-[0.5rem] px-2 text-left transition hover:bg-[var(--color-page-quiet)]"
          onClick={() => runMenuAction(onOpen)}
          type="button"
        >
          <ExternalLink size={14} />
          Open
        </button>
      ) : null}
    </div>
  ) : null;

  if (!compact && isReady && mediaUrl && (artifact.kind === "image" || artifact.kind === "video")) {
    return (
      <figure className="m-0 grid min-w-0 max-w-[26rem] gap-[var(--space-2)]">
        {artifact.kind === "image" ? (
          <>
            <img
              alt={artifact.title}
              className="max-h-[26rem] max-w-full rounded-[0.9rem] object-contain shadow-[var(--shadow-sm)]"
              onContextMenu={openContextMenu}
              src={mediaUrl}
            />
            {contextMenu}
          </>
        ) : (
          <>
            <video
              className="max-h-[26rem] max-w-full rounded-[0.9rem] bg-black shadow-[var(--shadow-sm)]"
              controls
              onContextMenu={openContextMenu}
              playsInline
              preload="metadata"
              src={mediaUrl}
            />
            {contextMenu}
          </>
        )}
      </figure>
    );
  }

  return (
    <article
      className={agentCreateClassNames(
        "grid min-w-0 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)]",
        compact ? "grid-cols-[5.5rem_minmax(0,1fr)]" : "content-start"
      )}
    >
      <div
        className={agentCreateClassNames(
          "relative grid place-items-center bg-[var(--color-page-quiet)] text-[var(--color-ink-muted)]",
          compact ? "min-h-[5.5rem]" : "aspect-[16/10]"
        )}
      >
        {artifact.kind === "image" && mediaUrl ? (
          <img alt="" className="size-full object-cover" src={mediaUrl} />
        ) : artifact.kind === "video" && mediaUrl ? (
          <video
            className="size-full object-cover"
            controls={isReady && !compact}
            muted
            playsInline
            preload="metadata"
            src={mediaUrl}
          />
        ) : artifact.kind === "audio" && mediaUrl ? (
          <div className="grid size-full place-items-center p-[var(--space-3)]">
            <span className="grid size-14 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-primary)]">
              <Music size={22} />
            </span>
            {isReady && !compact ? (
              <audio className="absolute bottom-2 left-2 right-2 w-[calc(100%-1rem)]" controls src={mediaUrl} />
            ) : null}
          </div>
        ) : (
          <span
            className={agentCreateClassNames(
              "grid place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]",
              compact ? "size-11" : "size-14"
            )}
          >
            <Icon size={compact ? 18 : 22} />
          </span>
        )}
        {isWorking ? (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[0.66rem] font-[820] text-[var(--color-ink-soft)]">
            <span className="size-1.5 animate-pulse rounded-full bg-[var(--color-primary)]" />
            {artifact.status === "placeholder" ? "Planned" : "Working"}
          </span>
        ) : null}
        {artifact.status === "failed" ? (
          <span className="absolute right-2 top-2 rounded-full bg-[var(--color-danger-soft)] px-2 py-1 text-[0.66rem] font-[820] text-[var(--color-danger)]">
            Failed
          </span>
        ) : null}
      </div>

      <div className="grid min-w-0 gap-[var(--space-2)] p-[var(--space-3)]">
        <div className="grid min-w-0 gap-[0.15rem]">
          <h3 className="m-0 truncate text-[0.9rem] font-[790] text-[var(--color-ink)]">
            {artifact.title}
          </h3>
          {artifact.description ? (
            <p className="m-0 line-clamp-2 break-words text-[0.76rem] leading-[1.4] text-[var(--color-ink-muted)]">
              {artifact.description}
            </p>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-[var(--space-2)]">
          {artifact.modelLabel ? (
            <span className="truncate text-[0.7rem] font-[700] text-[var(--color-ink-muted)]">
              {artifact.modelLabel}
            </span>
          ) : null}
          <span className="rounded-full bg-[var(--color-page-quiet)] px-2 py-1 text-[0.66rem] font-[780] text-[var(--color-ink-soft)]">
            {artifact.kind}
          </span>
        </div>

        {(onOpen || onDownload) && (isReady || artifact.url) ? (
          <div className="flex flex-wrap gap-[var(--space-2)]">
            {onOpen && artifact.url ? (
              <button
                className="secondary-button min-h-8 px-2 py-1 text-[0.76rem]"
                onClick={() => onOpen(artifact)}
                type="button"
              >
                <ExternalLink size={14} />
                Open
              </button>
            ) : null}
            {onDownload && isReady ? (
              <button
                className="secondary-button min-h-8 px-2 py-1 text-[0.76rem]"
                onClick={() => onDownload(artifact)}
                type="button"
              >
                <Download size={14} />
                Export
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function AgentCreateArtifactGrid({
  artifacts,
  emptyLabel = "Artifacts will appear here as the agent creates them.",
  onDownload,
  onOpen,
  onOpenStudio,
  onSave,
}: {
  artifacts: AgentCreateArtifact[];
  emptyLabel?: string;
  onDownload?: (artifact: AgentCreateArtifact) => void;
  onOpen?: (artifact: AgentCreateArtifact) => void;
  onOpenStudio?: (artifact: AgentCreateArtifact) => void;
  onSave?: (artifact: AgentCreateArtifact) => void;
}) {
  if (!artifacts.length) {
    return (
      <div className="grid min-h-[8rem] place-items-center rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] bg-[var(--color-page-quiet)] p-[var(--space-4)] text-center text-[0.82rem] text-[var(--color-ink-muted)]">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-[var(--space-3)]">
      {artifacts.map((artifact) => (
        <AgentCreateArtifactCard
          artifact={artifact}
          key={artifact.id}
          onDownload={onDownload}
          onOpen={onOpen}
          onOpenStudio={onOpenStudio}
          onSave={onSave}
        />
      ))}
    </div>
  );
}
