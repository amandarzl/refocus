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
  onAttachFolder,
  onClose,
}) {
  const [mode, setMode] = useState(null); // null | "create" | "pick"
  const [count, setCount] = useState("1");

  const close = () => {
    setMode(null);
    setCount("1");
    onClose();
  };

  const submitCreate = () => {
    const clamped = Math.min(MAX_FOLDERS, Math.max(MIN_FOLDERS, parseInt(count, 10) || MIN_FOLDERS));
    onCreateFolders(clamped);
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
        <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto p-2">
          {existingFolders.length === 0 ? (
            <span className="px-2 py-1 text-xs text-ink-muted">No other folders yet — add one from Add References.</span>
          ) : (
            existingFolders.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  onAttachFolder(f.id);
                  close();
                }}
                className="truncate rounded-control px-2 py-1.5 text-left text-sm font-semibold text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-accent-primary"
              >
                {f.name}
              </button>
            ))
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
          {onAttachFolder && (
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
