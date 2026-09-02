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
  isDark,
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
          className={`inline-flex items-center gap-1 rounded-full font-medium ${chipClass} ${
            isDark
              ? "bg-[#A8C3A4]/15 text-[#A8C3A4]"
              : "bg-[#A8C3A4]/20 text-[#5c7658]"
          }`}
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
          className={`w-16 rounded-full border border-dashed bg-transparent px-2 py-0.5 text-xs outline-none focus:w-24 focus:border-solid transition-all ${
            isDark
              ? "border-zinc-600 text-slate-300 placeholder:text-zinc-600 focus:border-[#A8C3A4]"
              : "border-slate-300 text-slate-600 placeholder:text-slate-400 focus:border-[#A8C3A4]"
          }`}
        />
      )}
    </div>
  );
}
