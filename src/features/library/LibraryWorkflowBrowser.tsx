import { ChevronRight, Folder, Image as ImageIcon } from "lucide-react";
import type { LibraryRunGroup, LibraryWorkflowGroup } from "./libraryTypes";
import { formatDateTime, formatRunTime } from "./libraryMedia";

export function LibraryFolderButton({
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

export function LibraryRunRow({
  group,
  onOpen,
}: {
  group: LibraryRunGroup;
  onOpen: () => void;
}) {
  const nonCompletedStatus = group.run?.status && group.run.status !== "completed"
    ? group.run.status.replace(/_/g, " ")
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
