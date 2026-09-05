import { useState } from "react";
import Popover from "../ui/Popover.jsx";
import Button from "../ui/Button.jsx";

// Toolbar counterpart to AddFolderControl's grid tile — same two actions
// ("New folder" / "Add existing"), just anchored to a small "+" button
// instead of taking up a full card's worth of grid space.
const MIN_FOLDERS = 1;
const MAX_FOLDERS = 20;

export default function AddFolderMenu({
  isOpen,
  existingFolders = [],
  onCreateFolders,
  onAttachFolders,
  onClose,
}) {
  const [mode, setMode] = useState(null); // null | "create" | "pick"
  const [count, setCount] = useState("1");
  const [selectedIds, setSelectedIds] = useState([]);

  const close = () => {
    setMode(null);
    setCount("1");
    setSelectedIds([]);
    onClose();
  };

  const submitCreate = () => {
    const clamped = Math.min(MAX_FOLDERS, Math.max(MIN_FOLDERS, parseInt(count, 10) || MIN_FOLDERS));
    onCreateFolders(clamped);
    close();
  };

  const toggleSelected = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submitAttach = () => {
    if (selectedIds.length === 0) return;
    onAttachFolders(selectedIds);
    close();
  };

  return (
    <Popover isOpen={isOpen} onClose={close} width="w-52">
      {mode === "create" ? (
        <div className="p-2">
          <label className="mb-1.5 block text-xs font-semibold text-ink-secondary">How many folders?</label>
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              type="number"
              min={MIN_FOLDERS}
              max={MAX_FOLDERS}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitCreate();
                if (e.key === "Escape") {
                  setCount("1");
                  onClose();
                }
              }}
              className="w-full rounded-control border border-border bg-surface-canvas px-2 py-1.5 text-sm text-ink-primary outline-none"
            />
            <Button variant="primary" onClick={submitCreate} className="shrink-0 px-3 py-1.5 text-xs">
              Create
            </Button>
          </div>
        </div>
      ) : mode === "pick" ? (
        <div className="p-2">
          <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
            {existingFolders.length === 0 ? (
              <span className="px-2 py-1 text-xs text-ink-muted">No other folders yet — add one from Add References.</span>
            ) : (
              existingFolders.map((f) => (
                <label
                  key={f.id}
                  className="flex shrink-0 cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 text-sm font-semibold text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(f.id)}
                    onChange={() => toggleSelected(f.id)}
                    className="h-4 w-4 shrink-0 cursor-pointer accent-accent-primary"
                  />
                  <span className="truncate">{f.name}</span>
                </label>
              ))
            )}
          </div>
          {existingFolders.length > 0 && (
            <Button
              variant="primary"
              onClick={submitAttach}
              disabled={selectedIds.length === 0}
              className="mt-2 w-full justify-center py-1.5 text-xs"
            >
              Add{selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
            </Button>
          )}
        </div>
      ) : (
        <div className="p-1">
          <button
            onClick={() => setMode("create")}
            className="flex w-full items-center gap-2 rounded-control px-3 py-2 text-left text-sm font-semibold text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary"
          >
            + New folder
          </button>
          {onAttachFolders && (
            <button
              onClick={() => setMode("pick")}
              className="flex w-full items-center gap-2 rounded-control px-3 py-2 text-left text-sm text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary"
            >
              Add existing
            </button>
          )}
        </div>
      )}
    </Popover>
  );
}
