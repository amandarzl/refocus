import { useState } from "react";
import EmptyTile from "../ui/EmptyTile.jsx";

// Trailing tile in the slot row. Two ways to add a card:
// - "New folder" creates a brand-new folder and attaches it immediately.
// - "Add existing" attaches a folder that already exists in the Add
//   References library (created there, or previously detached) — folders
//   never sync onto the board on their own, this is always an explicit pick.
export default function AddFolderControl({
  existingFolders = [],
  onCreateFolder,
  onAttachFolder,
  tileSize = "tile",
}) {
  const [mode, setMode] = useState(null); // null | "create" | "pick"
  const [name, setName] = useState("");

  const submitCreate = () => {
    const trimmed = name.trim();
    if (trimmed) onCreateFolder(trimmed);
    setName("");
    setMode(null);
  };

  return (
    <div>
      <EmptyTile size={tileSize}>
        {mode === "create" ? (
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={submitCreate}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitCreate();
              if (e.key === "Escape") {
                setName("");
                setMode(null);
              }
            }}
            placeholder="Folder name"
            className="w-4/5 rounded-control border border-border bg-surface-canvas px-2 py-1 text-center text-sm text-ink-primary placeholder:text-ink-muted outline-none"
          />
        ) : mode === "pick" ? (
          <div className="flex h-full w-full flex-col gap-1 overflow-y-auto p-2 text-left">
            {existingFolders.length === 0 ? (
              <span className="px-1 text-xs">No other folders yet — add one from Add References.</span>
            ) : (
              existingFolders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    onAttachFolder(f.id);
                    setMode(null);
                  }}
                  className="shrink-0 truncate rounded-control px-2 py-1.5 text-left text-xs font-semibold transition-colors hover:bg-surface-canvas hover:text-accent-primary"
                >
                  {f.name}
                </button>
              ))
            )}
            <button onClick={() => setMode(null)} className="mt-auto shrink-0 text-center text-[11px] text-ink-muted underline">
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="text-2xl font-light leading-none">+</span>
            <button onClick={() => setMode("create")} className="text-xs font-semibold hover:underline">
              New folder
            </button>
            {onAttachFolder && (
              <button onClick={() => setMode("pick")} className="text-[11px] hover:underline">
                Add existing
              </button>
            )}
          </div>
        )}
      </EmptyTile>
    </div>
  );
}
