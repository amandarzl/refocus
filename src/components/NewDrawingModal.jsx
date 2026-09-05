import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, DEFAULT_FOLDER_NAMES } from "../db.js";
import Modal from "./ui/Modal.jsx";
import Button from "./ui/Button.jsx";

// Replaces the old "pick a template framework" step. A template was really
// just a fixed, hardcoded folder set auto-attached to a new board — but the
// board already lets you attach/detach any folder at any time via its own
// "Add folder" control, so a template pre-did something you could
// immediately undo anyway. This goes straight to the real choice: which
// folders (if any) to start the board with. Selecting none reproduces the
// old "Blank Canvas" option with no special case.
export default function NewDrawingModal({ onClose, onStartDrawing }) {
  const foldersRaw = useLiveQuery(() => db.folders.orderBy("order").toArray(), []) || [];
  // Same rule as the Add References archive: a folder created on some
  // other, still-unsaved board session is a draft, not yet "confirmed
  // real" (see App.jsx's confirmBoardFolders) — this picker should only
  // ever offer what's actually in your archive, live, same as everywhere
  // else that lists folders.
  const folders = foldersRaw.filter((f) => !f.isDraft);
  const allRefs = useLiveQuery(() => db.references.toArray(), []) || [];

  const counts = useMemo(() => {
    const c = {};
    for (const ref of allRefs) c[ref.folderId] = (c[ref.folderId] || 0) + 1;
    return c;
  }, [allRefs]);

  const [title, setTitle] = useState("Untitled Canvas");
  // Starts empty on purpose, every time — no auto-seeding from last
  // time's picks. Pre-checking the same folders every session made it
  // too easy to click "Start Drawing" on autopilot, which cuts against
  // the whole point of this modal: picking folders deliberately each time.
  const [selectedIds, setSelectedIds] = useState([]);
  // Names picked (via a suggestion chip or the "+ New folder" field) that
  // don't exist as real folders yet. Purely local — nothing is written to
  // the database until "Start Drawing" actually goes through, so closing
  // this modal any other way leaves the archive untouched.
  const [pendingNames, setPendingNames] = useState([]);
  const [newFolderName, setNewFolderName] = useState("");

  const selected = new Set(selectedIds);

  const toggleFolder = (id) => {
    const base = new Set(selectedIds);
    if (base.has(id)) base.delete(id);
    else base.add(id);
    setSelectedIds([...base]);
  };


  // Adds `name` to this new drawing's picks without touching the database —
  // an existing folder just gets checked; a brand-new name is only staged
  // here and becomes a real folder if/when "Start Drawing" is clicked (see
  // handleStart). Reused by both the suggestion chips and the custom
  // "+ New folder" field so they behave identically.
  const pickByName = (name) => {
    const existing = folders.find((f) => (f.name || "").toLowerCase() === name.toLowerCase());
    if (existing) {
      if (!selected.has(existing.id)) toggleFolder(existing.id);
      return;
    }
    setPendingNames((prev) =>
      prev.some((n) => n.toLowerCase() === name.toLowerCase()) ? prev : [...prev, name],
    );
  };

  const removePending = (name) => {
    setPendingNames((prev) => prev.filter((n) => n !== name));
  };

  const submitNewFolder = () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    pickByName(trimmed);
    setNewFolderName("");
  };

  // Suggestion chips only offer names you don't already have a folder for —
  // once a real "Form" exists, it's just a checkbox in the list below (no
  // need for a quick-create chip too); a not-yet-real, pending name is
  // likewise dropped from suggestions the moment you've picked it. The row
  // shrinks one chip at a time as you go rather than vanishing outright
  // after your first pick, so you can keep picking without hunting for
  // another control.
  const suggestionNames = DEFAULT_FOLDER_NAMES.filter((name) => {
    const alreadyExists = folders.some((f) => (f.name || "").toLowerCase() === name.toLowerCase());
    if (alreadyExists) return false;
    return !pendingNames.some((n) => n.toLowerCase() === name.toLowerCase());
  });

  const hasAnyEntries = folders.length > 0 || pendingNames.length > 0;

  const handleStart = async () => {
    // Pending names only become real folders now, on actual confirmation —
    // never just from checking a box while browsing this modal. They start
    // as drafts (isDraft: true) — not yet "confirmed real" the way a folder
    // added in Add References already is — until this drawing is actually
    // saved (see App.jsx's confirmBoardFolders), so an unused one can be
    // cleaned up automatically if you detach it without ever saving.
    const newIds = [];
    for (const name of pendingNames) {
      const newId = await db.folders.add({
        name,
        order: folders.length + newIds.length,
        createdAt: Date.now(),
        isDraft: true,
      });
      newIds.push(newId);
    }
    onStartDrawing({
      title: title.trim() || "Untitled Canvas",
      folderIds: [...selected, ...newIds],
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

        {/* Your own folders come first — seeing what you already have
            before being offered suggestions makes it clear those are your
            real, available folders, not more options mixed in with them. */}
        {!hasAnyEntries ? (
          <div className="mt-2 rounded-panel border border-dashed border-border p-4 text-sm text-ink-secondary">
            <p>You don't have any folders yet — pick a suggestion below, or add your own.</p>
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
                  <span className="flex-1 truncate font-semibold text-ink-primary">{folder.name}</span>
                  <span className="flex-shrink-0 text-xs text-ink-muted">
                    {count} photo{count === 1 ? "" : "s"}
                  </span>
                </label>
              );
            })}
            {pendingNames.map((name, i) => (
              <label
                key={`pending-${name}`}
                className="flex cursor-pointer items-center gap-3 border-b border-border bg-surface-sunken/60 px-3 py-2.5 text-sm last:border-b-0 hover:bg-surface-sunken"
              >
                <input
                  type="checkbox"
                  checked
                  onChange={() => removePending(name)}
                  className="h-4 w-4 cursor-pointer accent-accent-primary"
                />
                <span className="flex-1 truncate font-semibold text-ink-primary">{name}</span>
                <span className="flex-shrink-0 text-xs text-ink-muted">new</span>
              </label>
            ))}
          </div>
        )}

        {suggestionNames.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestionNames.map((name) => (
              <button
                key={name}
                onClick={() => pickByName(name)}
                className="rounded-full border border-border bg-surface-raised px-3 py-1 text-xs font-semibold text-ink-secondary transition-colors hover:border-accent-primary hover:text-accent-primary"
              >
                + {name}
              </button>
            ))}
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
