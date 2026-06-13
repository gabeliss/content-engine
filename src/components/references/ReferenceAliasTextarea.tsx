import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

export type ReferenceMentionOption = {
  alias: string;
  title?: string;
  kind?: string;
};

type ActiveMention = {
  start: number;
  end: number;
  query: string;
};

type ReferenceAliasTextareaProps = {
  className?: string;
  helperText?: string;
  label: string;
  onChange: (value: string) => void;
  options?: ReferenceMentionOption[];
  required?: boolean;
  textareaClassName?: string;
  value: string;
};

const fieldShellClass = "grid min-w-0 gap-[var(--space-2)]";
const fieldLabelClass = "text-[0.74rem] font-[780] text-[var(--color-ink-soft)]";
const helperTextClass = "text-[0.72rem] leading-[1.35] text-[var(--color-ink-muted)]";

function mentionAtCursor(value: string, selectionStart: number): ActiveMention | null {
  const beforeCursor = value.slice(0, selectionStart);
  const match = beforeCursor.match(/(^|[\s([{])@([a-zA-Z0-9_-]*)$/);
  if (!match) return null;

  return {
    start: selectionStart - match[2].length - 1,
    end: selectionStart,
    query: match[2].toLowerCase(),
  };
}

function uniqueOptions(options: ReferenceMentionOption[]) {
  const seen = new Set<string>();
  return options.filter((option) => {
    const alias = option.alias.trim();
    if (!alias || seen.has(alias.toLowerCase())) return false;
    seen.add(alias.toLowerCase());
    return true;
  });
}

function optionMatchesQuery(option: ReferenceMentionOption, query: string) {
  if (!query) return true;
  return [option.alias, option.title, option.kind]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(query));
}

export function ReferenceAliasTextarea({
  className,
  helperText,
  label,
  onChange,
  options = [],
  required = false,
  textareaClassName,
  value,
}: ReferenceAliasTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [activeMention, setActiveMention] = useState<ActiveMention | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const mentionOptions = useMemo(() => uniqueOptions(options), [options]);
  const filteredOptions = useMemo(
    () =>
      activeMention
        ? mentionOptions.filter((option) =>
            optionMatchesQuery(option, activeMention.query)
          )
        : [],
    [activeMention, mentionOptions]
  );
  const showOptions = Boolean(activeMention && filteredOptions.length);

  useEffect(() => {
    setActiveIndex(0);
  }, [activeMention?.query, filteredOptions.length]);

  const refreshMention = (textarea: HTMLTextAreaElement) => {
    setActiveMention(mentionAtCursor(textarea.value, textarea.selectionStart));
  };

  const insertAlias = (option: ReferenceMentionOption) => {
    if (!activeMention) return;

    const nextCharacter = value.slice(activeMention.end, activeMention.end + 1);
    const needsSpace = nextCharacter && !/\s/.test(nextCharacter);
    const nextValue =
      value.slice(0, activeMention.start) +
      option.alias +
      (needsSpace ? " " : "") +
      value.slice(activeMention.end);
    const nextCursor =
      activeMention.start + option.alias.length + (needsSpace ? 1 : 0);

    onChange(nextValue);
    setActiveMention(null);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showOptions) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % filteredOptions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        index === 0 ? filteredOptions.length - 1 : index - 1
      );
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      insertAlias(filteredOptions[activeIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setActiveMention(null);
    }
  };

  const handleKeyUp = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(event.key)) {
      return;
    }
    refreshMention(event.currentTarget);
  };

  return (
    <div className={`${fieldShellClass}${className ? ` ${className}` : ""}`}>
      <span className={fieldLabelClass}>
        {label}
        {required ? " *" : ""}
      </span>
      <div className="relative min-w-0">
        <textarea
          className={textareaClassName}
          onBlur={() => window.setTimeout(() => setActiveMention(null), 120)}
          onChange={(event) => {
            onChange(event.target.value);
            refreshMention(event.target);
          }}
          onClick={(event) => refreshMention(event.currentTarget)}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          ref={textareaRef}
          value={value}
        />
        {showOptions ? (
          <div className="absolute left-3 top-[calc(100%-0.5rem)] z-30 grid max-h-56 w-[min(24rem,calc(100%-1.5rem))] overflow-auto rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-lg)]">
            {filteredOptions.map((option, index) => (
              <button
                className={`grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-[var(--space-2)] rounded-[var(--radius-xs)] px-2.5 py-2 text-left transition ${
                  index === activeIndex
                    ? "bg-[var(--color-primary-soft)]"
                    : "hover:bg-[var(--color-page-quiet)]"
                }`}
                key={option.alias}
                onMouseDown={(event) => {
                  event.preventDefault();
                  insertAlias(option);
                }}
                type="button"
              >
                <span className="rounded-full bg-white px-2 py-1 text-[0.72rem] font-[820] text-[var(--color-primary-strong)] shadow-[0_1px_4px_rgb(15_23_42_/_0.08)]">
                  {option.alias}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[0.8rem] font-[760] text-[var(--color-ink)]">
                    {option.title || option.kind || "Reference"}
                  </span>
                  {option.kind ? (
                    <span className="block truncate text-[0.68rem] text-[var(--color-ink-muted)]">
                      {option.kind}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {helperText ? <small className={helperTextClass}>{helperText}</small> : null}
    </div>
  );
}
