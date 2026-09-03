import useInlineRename from "../../hooks/useInlineRename.js";

// Click-to-edit text — a value that reads as plain text until clicked, then
// becomes an autofocused input sized to its own content (the `ch`-width
// trick), committing on blur/Enter and reverting on Escape. Built on
// useInlineRename; this component owns the visual side, including the
// focus-ring token in place of the three hardcoded blue-500 rings the
// duplicated versions of this each carried.
export default function InlineRenameField({
  value,
  onSave,
  fallback = "",
  className = "",
  inputClassName = "",
  placeholder,
}) {
  const { isEditing, draft, setDraft, startEditing, commit, onKeyDown } =
    useInlineRename(value, onSave, { fallback });

  if (isEditing) {
    return (
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        autoFocus
        onFocus={(e) => e.target.select()}
        placeholder={placeholder}
        style={{ width: `${Math.max(draft.length, 1) + 1}ch` }}
        className={`rounded outline-none focus:ring-1 focus:ring-focus-ring ${inputClassName || className}`}
      />
    );
  }

  return (
    <span
      onClick={startEditing}
      className={`cursor-pointer truncate ${className}`}
      title="Click to rename"
    >
      {value}
    </span>
  );
}
