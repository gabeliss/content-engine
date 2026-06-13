import { AlertCircle, CheckCircle2 } from "lucide-react";
import { LoadingSignal } from "../../components/ui";
import {
  formatDateTime,
  sourceLabel,
  statusClass,
  statusLabel,
  type AnalysisJob,
} from "./analyzeModel";

export function JobStatusIcon({ status }: { status: AnalysisJob["status"] }) {
  if (status === "completed") return <CheckCircle2 size={15} />;
  if (status === "failed") return <AlertCircle size={15} />;
  return <LoadingSignal label={statusLabel(status)} size="sm" />;
}

export function JobRow({
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
