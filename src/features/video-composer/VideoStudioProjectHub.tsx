import { Clock3, Film, Plus, Trash2, Video } from "lucide-react";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { LoadingSignal } from "../../components/ui";
import {
  compositionDuration,
  createEmptyVideoCompositionDraft,
  formatTimelineTime,
  type VideoCompositionDraft,
} from "./videoComposerModel";

function videoProjectDraft(project: Doc<"videoProjects">): VideoCompositionDraft {
  return {
    ...createEmptyVideoCompositionDraft(),
    ...(project.draft as Partial<VideoCompositionDraft> | undefined),
  };
}

function formatProjectUpdatedAt(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(new Date(timestamp));
}

export function VideoStudioProjectHub({
  activeWorkspaceName,
  isCreating,
  isDeletingProjectId,
  loading,
  notice,
  onCreateProject,
  onDeleteProject,
  onOpenProject,
  projects,
}: {
  activeWorkspaceName?: string;
  isCreating: boolean;
  isDeletingProjectId: string;
  loading: boolean;
  notice?: string;
  onCreateProject: () => void;
  onDeleteProject: (projectId: Id<"videoProjects">) => void;
  onOpenProject: (projectId: Id<"videoProjects">) => void;
  projects?: Doc<"videoProjects">[];
}) {
  return (
    <section className="h-screen min-h-0 w-full overflow-hidden bg-[var(--color-page)] text-[var(--color-ink)]">
      <div className="grid h-full min-h-0 grid-rows-[3.25rem_minmax(0,1fr)]">
        <header className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5">
          <div className="min-w-0">
            <h1 className="m-0 text-[1rem] font-[840] text-[var(--color-ink)]">Video Studio</h1>
            <p className="m-0 text-[0.74rem] font-[700] text-[var(--color-ink-muted)]">
              {activeWorkspaceName ?? "Workspace"} projects autosave as you edit
            </p>
          </div>
          <div className="flex items-center gap-3">
            {notice ? (
              <span className="max-w-[18rem] truncate text-[0.74rem] font-[700] text-[var(--color-ink-muted)]">
                {notice}
              </span>
            ) : null}
            <button
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-[0.4rem] bg-[var(--color-primary)] px-3 text-[0.8rem] font-[840] text-[var(--color-surface)] shadow-sm transition hover:bg-[var(--color-primary-strong)] disabled:cursor-not-allowed disabled:opacity-55"
              disabled={isCreating}
              onClick={onCreateProject}
              type="button"
            >
              {isCreating ? <LoadingSignal label="Creating" size="sm" /> : <Plus size={16} />}
              New project
            </button>
          </div>
        </header>

        <main className="min-h-0 overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="grid min-h-[20rem] place-items-center text-[0.86rem] font-[720] text-[var(--color-ink-muted)]">
              <LoadingSignal label="Loading video projects" showLabel size="sm" />
            </div>
          ) : null}

          {!loading && projects?.length === 0 ? (
            <div className="mx-auto grid min-h-[26rem] max-w-[34rem] place-items-center rounded-[0.5rem] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] p-8 text-center">
              <div className="grid gap-4">
                <span className="mx-auto grid size-12 place-items-center rounded-[0.5rem] bg-[var(--color-primary-soft)] text-[var(--color-primary-strong)]">
                  <Video size={22} />
                </span>
                <div>
                  <h2 className="m-0 text-[1rem] font-[840] text-[var(--color-ink)]">
                    No video projects yet
                  </h2>
                  <p className="mx-auto mt-1 max-w-[25rem] text-[0.82rem] font-[650] leading-relaxed text-[var(--color-ink-muted)]">
                    Start a project here or compose from any saved video in your Library. Your edits will autosave.
                  </p>
                </div>
                <button
                  className="mx-auto inline-flex min-h-9 items-center justify-center gap-2 rounded-[0.4rem] bg-[var(--color-primary)] px-3 text-[0.8rem] font-[840] text-[var(--color-surface)] shadow-sm transition hover:bg-[var(--color-primary-strong)]"
                  onClick={onCreateProject}
                  type="button"
                >
                  <Plus size={16} />
                  New project
                </button>
              </div>
            </div>
          ) : null}

          {!loading && projects && projects.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-3">
              {projects.map((project) => {
                const draft = videoProjectDraft(project);
                const firstClip = draft.clips[0];
                const durationSeconds = compositionDuration(draft.clips);
                return (
                  <article
                    className="group grid overflow-hidden rounded-[0.55rem] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm transition hover:border-[var(--color-primary)] hover:shadow-md"
                    key={project._id}
                  >
                    <button
                      className="grid min-w-0 gap-3 p-3 text-left"
                      onClick={() => onOpenProject(project._id)}
                      type="button"
                    >
                      <span className="relative aspect-video overflow-hidden rounded-[0.4rem] bg-[var(--color-page-quiet)]">
                        {firstClip ? (
                          <video
                            className="h-full w-full object-cover"
                            muted
                            playsInline
                            preload="metadata"
                            src={firstClip.storageUrl}
                          />
                        ) : (
                          <span className="grid h-full place-items-center text-[var(--color-ink-faint)]">
                            <Film size={28} />
                          </span>
                        )}
                      </span>
                      <span className="grid min-w-0 gap-1">
                        <strong className="text-[0.9rem] font-[840] leading-tight text-[var(--color-ink)] [overflow-wrap:anywhere]">
                          {project.title}
                        </strong>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.73rem] font-[720] text-[var(--color-ink-muted)]">
                          <span>{draft.clips.length} clip{draft.clips.length === 1 ? "" : "s"}</span>
                          <span>{formatTimelineTime(durationSeconds, 2)}</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock3 size={13} />
                            {formatProjectUpdatedAt(project.updatedAt)}
                          </span>
                        </span>
                      </span>
                    </button>
                    <div className="flex items-center justify-between border-t border-[var(--color-border)] px-3 py-2">
                      <span className="text-[0.7rem] font-[760] text-[var(--color-ink-faint)]">
                        Autosaved draft
                      </span>
                      <button
                        aria-label={`Delete ${project.title}`}
                        className="grid size-8 place-items-center rounded-[0.35rem] text-[var(--color-danger)] opacity-80 transition hover:bg-[var(--color-page-quiet)] hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={isDeletingProjectId === project._id}
                        onClick={() => onDeleteProject(project._id)}
                        type="button"
                      >
                        {isDeletingProjectId === project._id ? (
                          <LoadingSignal label="Deleting" size="sm" />
                        ) : (
                          <Trash2 size={15} />
                        )}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </main>
      </div>
    </section>
  );
}
