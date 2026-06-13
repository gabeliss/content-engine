import {
  Check,
  ClipboardPaste,
  Image as ImageIcon,
  Music,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
} from "react";
import { GenerationLoadingState, LoadingSignal, TextArea } from "../../components/ui";
import { clipboardMediaFilesFromRead, mediaTypeFromFile } from "./libraryMedia";
import type { CandidateImage, LibraryOutput } from "./libraryTypes";
import { LibraryMediaPreview } from "./LibraryOutputCard";

export function TitleRenameModal({
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
            <p className="entity-eyebrow m-0">{output.type.replace(/_/g, " ")}</p>
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

export function ImageRevisionModal({
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
            <LibraryMediaPreview output={output} />
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

export function AddMediaModal({
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
