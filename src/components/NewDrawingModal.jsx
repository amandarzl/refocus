import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, DEFAULT_FOLDER_NAMES } from "../db.js";
import { defaultFolderColor } from "./library/FolderList.jsx";
import Modal from "./ui/Modal.jsx";
import Button from "./ui/Button.jsx";

const LAST_SELECTION_KEY = "lastNewDrawingFolderIds";

// Replaces the old "pick a template framework" step. A template was really
// just a fixed, hardcoded folder set auto-attached to a new board — but the
// board already lets you attach/detach any folder at any time via its own
// "Add folder" control, so a template pre-did something you could
// immediately undo anyway. This goes straight to the real choice: which
// folders (if any) to start the board with. Selecting none reproduces the
// old "Blank Canvas" option with no special case.
export default function NewDrawingModal({ onClose, onStartDrawing }) {
  const folders = useLiveQuery(() => db.folders.orderBy("order").toArray(), []) || [];
  const allRefs = useLiveQuery(() => db.references.toArray(), []) || [];
  const lastSelection = useLiveQuery(() => db.settings.get(LAST_SELECTION_KEY), []);

  const counts = useMemo(() => {
    const c = {};
    for (const ref of allRefs) c[ref.folderId] = (c[ref.folderId] || 0) + 1;
    return c;
  }, [allRefs]);

  const [title, setTitle] = useState("Untitled Canvas");
  const [selectedIds, setSelectedIds] = useState(null); // null until the remembered selection resolves
  const [newFolderName, setNewFolderName] = useState("");

  // Seed the checklist from whatever was picked last time, once both the
  // setting and the current folder list have loaded — and only once, so
  // toggling checkboxes afterward doesn't get stomped by a stale re-run.
  const idsToUse =
    selectedIds ??
    (lastSelection !== undefined && folders.length >= 0
      ? (lastSelection?.value || []).filter((id) => folders.some((f) => f.id === id))
      : null);

  const selected = new Set(idsToUse || []);

  const toggleFolder = (id) => {
    const base = new Set(idsToUse || []);
    if (base.has(id)) base.delete(id);
    else base.add(id);
    setSelectedIds([...base]);
  };

  const addFolder = async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newId = await db.folders.add({ name: trimmed, order: folders.length, createdAt: Date.now() });
    setSelectedIds([...(idsToUse || []), newId]);
  };

  const submitNewFolder = async () => {
    await addFolder(newFolderName);
    setNewFolderName("");
  };

  const handleStart = () => {
    onStartDrawing({
      title: title.trim() || "Untitled Canvas",
      folderIds: [...selected],
    });
  };

  return (
    <Modal onClose={onClose} maxWidth="lg" labelledBy="new-drawing-title">
      <div className="p-6 sm:p-8">
        <div className="flex items-start justify-between">
          <div>
            <h2 id="new-drawing-title" className="font-display text-xl font-semibold tracking-tight text-ink-primary sm:text-2xl">
              Start a new drawing
            </h2>
            <p className="mt-1 text-sm text-ink-secondary">
              Pick which folders to bring onto the board — or none, for a blank one.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-control p-2 text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary"
            title="Close"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <label className="mt-6 block text-xs font-bold uppercase tracking-wider text-ink-muted">Canvas title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={(e) => e.target.select()}
          className="mt-2 w-full rounded-control border border-border bg-surface-canvas px-3 py-2 text-sm text-ink-primary outline-none transition-colors focus:border-accent-primary"
        />

        <label className="mt-5 block text-xs font-bold uppercase tracking-wider text-ink-muted">Folders</label>

        {folders.length === 0 ? (
          <div className="mt-2 rounded-panel border border-dashed border-border p-4 text-sm text-ink-secondary">
            <p>You don't have any folders yet — start with a few common ones, or add your own below.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {DEFAULT_FOLDER_NAMES.map((name) => (
                <button
                  key={name}
                  onClick={() => addFolder(name)}
                  className="rounded-full border border-border bg-surface-raised px-3 py-1 text-xs font-semibold text-ink-secondary transition-colors hover:border-accent-primary hover:text-accent-primary"
                >
                  + {name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-2 max-h-56 overflow-y-auto rounded-panel border border-border">
            {folders.map((folder) => {
              const count = counts[folder.id] || 0;
              const isChecked = selected.has(folder.id);
              return (
                <label
                  key={folder.id}
                  className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2.5 text-sm last:border-b-0 hover:bg-surface-sunken"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleFolder(folder.id)}
                    className="h-4 w-4 cursor-pointer accent-accent-primary"
                  />
                  <span
                    className="h-3 w-3 flex-shrink-0 rounded-sm"
                    style={{ backgroundColor: folder.color || defaultFolderColor(folder.id) }}
                    aria-hidden="true"
                  />
                  <span className="flex-1 truncate font-semibold text-ink-primary">{folder.name}</span>
                  <span className="flex-shrink-0 text-xs text-ink-muted">
                    {count} photo{count === 1 ? "" : "s"}
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {/* Always available, not just in the empty state — a folder you
            don't have yet shouldn't require leaving this modal. */}
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNewFolder();
            }}
            placeholder="+ New folder"
            className="w-full rounded-control border border-border bg-surface-canvas px-3 py-1.5 text-sm text-ink-primary placeholder:text-ink-muted outline-none transition-colors focus:border-accent-primary"
          />
          <Button variant="secondary" onClick={submitNewFolder} disabled={!newFolderName.trim()} className="px-3 py-1.5 text-xs">
            Add
          </Button>
        </div>

        <Button variant="primary" onClick={handleStart} className="mt-6 w-full justify-center py-3 shadow-card">
          Start Drawing
        </Button>
      </div>
    </Modal>
  );
}
