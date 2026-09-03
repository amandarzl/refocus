import { useEffect, useState } from "react";

// Click-to-edit-in-place state, extracted from the near-identical rename
// logic Header.jsx (canvas title), FolderSlot.jsx (folder name on the
// board), and FolderList.jsx (folder name in the library) each
// reimplemented on their own: an editing toggle, a draft value that only
// commits on blur/Enter, and Escape reverting to the last saved value.
export default function useInlineRename(value, onSave, { fallback = "" } = {}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  // Stay in sync with the outside value while not actively editing (e.g.
  // another session/tab renamed it) — same as Header.jsx's original effect.
  useEffect(() => {
    if (!isEditing) setDraft(value);
  }, [value, isEditing]);

  const startEditing = () => {
    setDraft(value);
    setIsEditing(true);
  };

  const commit = () => {
    const finalValue = draft.trim() || fallback || value;
    setIsEditing(false);
    if (finalValue !== value) onSave(finalValue);
  };

  const cancel = () => {
    setDraft(value);
    setIsEditing(false);
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") cancel();
  };

  return { isEditing, draft, setDraft, startEditing, commit, cancel, onKeyDown };
}
