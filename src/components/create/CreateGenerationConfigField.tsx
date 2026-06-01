import { Upload, X } from "lucide-react";
import type { ChangeEvent } from "react";
import {
  coerceConfigFieldValue,
  configFieldValue,
  formatConfigFieldTextareaValue,
  formatConfigLabel,
  localReferenceFilesFromConfig,
  type ConfigField,
  type LocalReferenceFileKind,
} from "../../lib/workflow/workflowConfigFields";
import { WorkflowSelect } from "../workflow/WorkflowSelect";

export type CreateLocalFileFieldMeta = {
  accept: string;
  kind: LocalReferenceFileKind;
  multiple: boolean;
  maxCount?: number;
};

type CreateGenerationConfigFieldProps = {
  className?: string;
  config: Record<string, unknown>;
  field: ConfigField;
  isUploadingReference: boolean;
  localFileFieldMeta: (fieldKey: string) => CreateLocalFileFieldMeta | null;
  onConfigChange: (key: string, value: unknown) => void;
  onLocalReferenceFileUpload: (
    event: ChangeEvent<HTMLInputElement>,
    configKey: string,
    kind: LocalReferenceFileKind,
    options?: { multiple?: boolean; maxCount?: number }
  ) => void;
  onRemoveLocalReferenceFile: (
    configKey: string,
    fileId: string,
    kind: LocalReferenceFileKind
  ) => void;
};

const multilineTextKeys = new Set([
  "caption",
  "knowledgeBase",
  "prompt",
  "request",
  "systemPrompt",
  "text",
]);

const fieldShellClass = "grid min-w-0 gap-[var(--space-2)]";
const fieldLabelClass = "text-[0.74rem] font-[780] text-[var(--color-ink-soft)]";
const helperTextClass = "text-[0.72rem] leading-[1.35] text-[var(--color-ink-muted)]";
const inputClass = "min-h-[2.45rem] w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-page)] px-[var(--space-3)] text-[0.86rem] text-[var(--color-ink)]";
const textareaClass = `${inputClass} min-h-[6.5rem] resize-y overflow-auto py-[var(--space-3)] leading-[1.45]`;
const promptTextareaClass = `${textareaClass} min-h-[13rem]`;

export function CreateGenerationConfigField({
  className,
  config,
  field,
  isUploadingReference,
  localFileFieldMeta,
  onConfigChange,
  onLocalReferenceFileUpload,
  onRemoveLocalReferenceFile,
}: CreateGenerationConfigFieldProps) {
  const value = configFieldValue(field, config);
  const localFileMeta = localFileFieldMeta(field.key);

  if (localFileMeta) {
    const files = localReferenceFilesFromConfig(
      config,
      field.key,
      localFileMeta.kind
    );

    return (
      <div className={`${fieldShellClass}${className ? ` ${className}` : ""}`}>
        <span className={fieldLabelClass}>
          {field.label}
          {field.required ? " *" : ""}
        </span>
        <div>
          <label className="inline-flex min-h-[4.5rem] w-full cursor-pointer items-center justify-center gap-[var(--space-2)] rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] bg-[var(--color-page)] px-[var(--space-3)] text-[0.84rem] font-[760] text-[var(--color-ink)] transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-tinted)]">
            <Upload size={15} />
            <span>{isUploadingReference ? "Uploading..." : "Upload files"}</span>
            <input
              className="hidden"
              accept={localFileMeta.accept}
              disabled={isUploadingReference}
              multiple={localFileMeta.multiple}
              onChange={(event) =>
                onLocalReferenceFileUpload(event, field.key, localFileMeta.kind, {
                  multiple: localFileMeta.multiple,
                  maxCount: localFileMeta.maxCount,
                })
              }
              type="file"
            />
          </label>
        </div>
        {files.length ? (
          <div className="workflow-reference-list">
            {files.map((file) => (
              <div className="workflow-reference-item" key={file.id}>
                {file.kind === "image" ? (
                  <img alt="" src={file.storageUrl} />
                ) : (
                  <span className="workflow-reference-file-kind">
                    {String(file.kind).slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span>{file.title}</span>
                <button
                  aria-label={`Remove ${file.title}`}
                  onClick={() =>
                    onRemoveLocalReferenceFile(field.key, file.id, localFileMeta.kind)
                  }
                  type="button"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <small className={helperTextClass}>
            {field.required ? "At least one file is required." : "No files uploaded."}
            {localFileMeta.maxCount
              ? ` Up to ${localFileMeta.maxCount} allowed.`
              : !localFileMeta.multiple
                ? " One file allowed."
                : null}
          </small>
        )}
        {field.description ? <small className={helperTextClass}>{field.description}</small> : null}
      </div>
    );
  }

  if (field.type === "enum") {
    return (
      <div className={`${fieldShellClass}${className ? ` ${className}` : ""}`}>
        <span className={fieldLabelClass}>
          {field.label}
          {field.required ? " *" : ""}
        </span>
        <WorkflowSelect
          onChange={(nextValue) => onConfigChange(field.key, nextValue)}
          options={[
            ...(!field.required ? [{ value: "", label: "Unset" }] : []),
            ...(field.enumValues ?? []).map((option) => ({
              value: option,
              label: formatConfigLabel(option),
            })),
          ]}
          placeholder="Select option"
          value={String(value)}
        />
        {field.description ? <small className={helperTextClass}>{field.description}</small> : null}
      </div>
    );
  }

  if (multilineTextKeys.has(field.key)) {
    return (
      <label className={`${fieldShellClass}${className ? ` ${className}` : ""}`}>
        <span className={fieldLabelClass}>
          {field.label}
          {field.required ? " *" : ""}
        </span>
        <textarea
          className={field.key === "prompt" || field.key === "text" ? promptTextareaClass : textareaClass}
          onChange={(event) =>
            onConfigChange(
              field.key,
              coerceConfigFieldValue(field, event.target.value, value)
            )
          }
          value={String(value)}
        />
        {field.description ? <small className={helperTextClass}>{field.description}</small> : null}
      </label>
    );
  }

  if (field.type === "boolean") {
    return (
      <div className={`${fieldShellClass} self-start pt-[0.2rem]${className ? ` ${className}` : ""}`}>
        <label className="inline-flex items-center gap-[var(--space-2)] text-[0.86rem] font-[720] text-[var(--color-ink)]">
          <input
            className="h-4 w-4 accent-[var(--color-primary)]"
            checked={Boolean(value)}
            onChange={(event) => onConfigChange(field.key, event.target.checked)}
            type="checkbox"
          />
          <span>
            {field.label}
            {field.required ? " *" : ""}
          </span>
        </label>
        {field.description ? <small className={helperTextClass}>{field.description}</small> : null}
      </div>
    );
  }

  return (
    <label className={`${fieldShellClass}${className ? ` ${className}` : ""}`}>
      <span className={fieldLabelClass}>
        {field.label}
        {field.required ? " *" : ""}
      </span>
      {field.type === "json" ? (
        <textarea
          className={textareaClass}
          onChange={(event) =>
            onConfigChange(
              field.key,
              coerceConfigFieldValue(field, event.target.value, value)
            )
          }
          spellCheck={false}
          value={formatConfigFieldTextareaValue(value)}
        />
      ) : (
        <input
          className={inputClass}
          onChange={(event) =>
            onConfigChange(
              field.key,
              coerceConfigFieldValue(field, event.target.value, value)
            )
          }
          type={field.type === "number" ? "number" : "text"}
          value={String(value)}
        />
      )}
      {field.description ? <small className={helperTextClass}>{field.description}</small> : null}
    </label>
  );
}
