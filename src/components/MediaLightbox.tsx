import { ExternalLink, X } from "lucide-react";
import { useEffect } from "react";

export type MediaLightboxItem = {
  kind?: "image" | "video";
  src: string;
  title: string;
  meta?: string;
};

export function MediaLightbox({
  media,
  onClose,
}: {
  media: MediaLightboxItem | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!media) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [media, onClose]);

  if (!media) return null;

  const mediaKind = media.kind ?? "image";
  const mediaLabel = mediaKind === "video" ? "video" : "image";

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[70] grid place-items-center bg-[oklch(7%_0.018_220_/_0.72)] p-[var(--space-4)] backdrop-blur-sm"
      role="dialog"
      aria-label={media.title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="grid w-fit min-w-[min(18rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-[var(--radius-md)] border border-[oklch(100%_0_0_/_0.12)] bg-[oklch(10%_0.018_220_/_0.92)] shadow-[0_26px_70px_oklch(0%_0_0_/_0.42)]">
        <header className="flex min-w-0 items-center justify-between gap-[var(--space-3)] border-b border-[oklch(100%_0_0_/_0.1)] px-[var(--space-3)] py-[var(--space-2)] text-[oklch(96%_0.006_210)]">
          <div className="min-w-0">
            <h2 className="m-0 truncate text-[0.92rem] font-[780] leading-[1.2]">
              {media.title}
            </h2>
            {media.meta ? (
              <p className="m-0 mt-[0.15rem] truncate text-[0.75rem] text-[oklch(78%_0.018_215)]">
                {media.meta}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-[var(--space-2)]">
            <a
              aria-label={`Open ${mediaLabel} in a new tab`}
              className="grid size-8 place-items-center rounded-[var(--radius-sm)] border border-[oklch(100%_0_0_/_0.12)] text-[oklch(88%_0.012_210)] transition hover:border-[oklch(100%_0_0_/_0.28)] hover:text-[oklch(98%_0.004_210)]"
              href={media.src}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink size={16} />
            </a>
            <button
              aria-label={`Close ${mediaLabel}`}
              className="grid size-8 place-items-center rounded-[var(--radius-sm)] border border-[oklch(100%_0_0_/_0.12)] text-[oklch(88%_0.012_210)] transition hover:border-[oklch(100%_0_0_/_0.28)] hover:text-[oklch(98%_0.004_210)]"
              type="button"
              onClick={onClose}
            >
              <X size={17} />
            </button>
          </div>
        </header>
        <div className="grid min-h-0 place-items-center overflow-hidden p-[var(--space-2)]">
          {mediaKind === "video" ? (
            <video
              aria-label={media.title}
              className="block h-auto w-auto max-h-[calc(100vh-8rem)] max-w-[calc(100vw-3rem)] rounded-[var(--radius-sm)] object-contain"
              controls
              playsInline
              src={media.src}
            />
          ) : (
            <img
              alt={media.title}
              className="block h-auto w-auto max-h-[calc(100vh-8rem)] max-w-[calc(100vw-3rem)] rounded-[var(--radius-sm)] object-contain"
              src={media.src}
            />
          )}
        </div>
      </div>
    </div>
  );
}
