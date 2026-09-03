import { useState } from "react";

// Normalizes raw user input into a clean tag key: lowercase, no leading '#',
// no whitespace. Display adds the '#' back on — storage stays bare.
export function normalizeTag(raw) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/\s+/g, "-");
}

// Shared tag chip list + inline add input. Used in both the practice
// gallery cards and Focus Mode so tags look/behave identically everywhere.
export default function TagEditor({
  tags = [],
  editable = true,
  onAddTag,
  onRemoveTag,
  size = "sm",
}) {
  const [draft, setDraft] = useState("");

  const submitDraft = () => {
    const clean = normalizeTag(draft);
    if (clean && !tags.includes(clean)) {
      onAddTag?.(clean);
    }
    setDraft("");
  };

  const chipClass =
    size === "sm"
      ? "px-2 py-0.5 text-xs"
      : "px-2.5 py-1 text-sm";

  return (
    <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {tags.map((tag) => (
        <span
          key={tag}
          className={`inline-flex items-center gap-1 rounded-full bg-accent-primary-soft font-medium text-accent-primary ${chipClass}`}
        >
          #{tag}
          {editable && (
            <button
              onClick={() => onRemoveTag?.(tag)}
              className="opacity-60 transition-opacity hover:opacity-100"
              title={`Remove #${tag}`}
              aria-label={`Remove tag ${tag}`}
            >
              ✕
            </button>
          )}
        </span>
      ))}

      {editable && (
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitDraft();
            }
          }}
          onBlur={() => draft.trim() && submitDraft()}
          placeholder="+ tag"
          className="w-16 rounded-full border border-dashed border-border bg-transparent px-2 py-0.5 text-xs text-ink-secondary outline-none transition-all placeholder:text-ink-muted focus:w-24 focus:border-solid focus:border-accent-primary"
        />
      )}
    </div>
  );
}
