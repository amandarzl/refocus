import { useMemo, useState } from "react";
import TagEditor, { normalizeTag } from "../board/TagEditor.jsx";
import ConfirmDialog from "../ConfirmDialog.jsx";
import Button from "../ui/Button.jsx";
import EmptyTile from "../ui/EmptyTile.jsx";
import { filesToReferences } from "../../utils/imageProcessor.js";

// The folder's full archive — every photo, no cap. Unlike the Reference
// Board's single active-slot-per-folder view, this is a plain library
// manager: tag, delete, add more. No Focus Mode / "set as active" here —
// that stays a Reference Board concept.
export default function PhotoGrid({
  folder,
  photos,
  allFolders = [],
  onBack,
  onUpload,
  onAddReferences,
  onAddTag,
  onRemoveTag,
  onDeletePhoto,
  onBulkAddTag,
  onBulkMove,
  onBulkDelete,
}) {
  // Local to this folder's view — resets automatically when you switch
  // folders, since this component unmounts/remounts with them.
  const [activeTags, setActiveTags] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  // Bulk select — a one-off "fix several at once" tool, not a persistent
  // mode: exiting (Cancel, or leaving the folder) always clears it.
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkTagDraft, setBulkTagDraft] = useState("");
  const [bulkMoveTarget, setBulkMoveTarget] = useState("");
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);

  const exitSelecting = () => {
    setIsSelecting(false);
    setSelectedIds(new Set());
    setBulkTagDraft("");
    setBulkMoveTarget("");
  };

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submitBulkTag = () => {
    const clean = normalizeTag(bulkTagDraft);
    if (clean && selectedIds.size > 0) onBulkAddTag?.([...selectedIds], clean);
    setBulkTagDraft("");
  };

  const submitBulkMove = (toFolderId) => {
    if (toFolderId && selectedIds.size > 0) onBulkMove?.([...selectedIds], Number(toFolderId));
    setBulkMoveTarget("");
    exitSelecting();
  };

  const confirmBulkDelete = () => {
    onBulkDelete?.([...selectedIds]);
    setConfirmingBulkDelete(false);
    exitSelecting();
  };

  // Drag-and-drop straight onto the page — same upload pipeline the "+ Add
  // Photos" modal uses, just without the tags/URL extras (untagged; add
  // tags after the fact from the grid below).
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0 || !onAddReferences) return;
    setIsBusy(true);
    try {
      const refs = await filesToReferences(files, folder.id);
      if (refs.length > 0) await onAddReferences(refs);
    } finally {
      setIsBusy(false);
    }
  };

  const allTags = useMemo(() => {
    const set = new Set();
    photos.forEach((p) => (p.tags || []).forEach((t) => set.add(t)));
    return [...set].sort();
  }, [photos]);

  const toggleTag = (tag) =>
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  const visiblePhotos =
    activeTags.length === 0
      ? photos
      : photos.filter((p) => (p.tags || []).some((t) => activeTags.includes(t)));

  return (
    <div
      className="mx-auto max-w-5xl px-6 py-8"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-control text-ink-secondary transition-colors hover:bg-surface-sunken"
          title="Back to folders"
          aria-label="Back to folders"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="font-display text-xl font-semibold text-ink-primary">{folder.name}</h2>
        <span className="text-xs text-ink-muted">
          {activeTags.length > 0
            ? `${visiblePhotos.length} of ${photos.length} photo${photos.length === 1 ? "" : "s"}`
            : `${photos.length} photo${photos.length === 1 ? "" : "s"}`}
        </span>
        {photos.length > 0 && (
          <button
            onClick={() => (isSelecting ? exitSelecting() : setIsSelecting(true))}
            className="ml-auto rounded-control px-4 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:bg-surface-sunken"
          >
            {isSelecting ? "Cancel" : "Select"}
          </button>
        )}
        <Button variant="primary" onClick={onUpload} className={photos.length > 0 ? "" : "ml-auto"}>
          + Add Photos
        </Button>
      </div>

      {allTags.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {allTags.map((tag) => {
            const active = activeTags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "bg-accent-primary text-accent-primary-ink"
                    : "bg-accent-primary-soft text-accent-primary hover:bg-accent-primary/25"
                }`}
              >
                #{tag}
              </button>
            );
          })}
          {activeTags.length > 0 && (
            <button
              onClick={() => setActiveTags([])}
              className="rounded-full px-2.5 py-1 text-xs font-medium text-ink-muted underline transition-colors hover:text-ink-primary"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {photos.length === 0 ? (
        <EmptyTile size="wide" className={`mt-6 ${isDragging ? "border-accent-primary bg-accent-primary-soft" : ""}`}>
          <p className="text-sm font-medium">
            {isBusy ? "Adding…" : isDragging ? "Drop to add" : "No photos in this folder yet — drag and drop to add some."}
          </p>
        </EmptyTile>
      ) : visiblePhotos.length === 0 ? (
        <EmptyTile size="wide" className="mt-6">
          <p className="text-sm font-medium">No photos match the selected tags.</p>
        </EmptyTile>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visiblePhotos.map((photo) => {
            const isSelected = selectedIds.has(photo.id);
            return (
            <div
              key={photo.id}
              onClick={isSelecting ? () => toggleSelected(photo.id) : undefined}
              className={`group overflow-hidden rounded-panel border bg-surface-raised shadow-card transition-colors ${
                isSelecting ? "cursor-pointer" : ""
              } ${isSelected ? "border-accent-primary ring-2 ring-accent-primary" : "border-border"}`}
            >
              <div className="relative">
                <img
                  src={photo.src}
                  alt={folder.name}
                  draggable={false}
                  className={`h-40 w-full select-none object-contain ${isSelecting && !isSelected ? "opacity-70" : ""}`}
                />
                {isSelecting ? (
                  <div
                    className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shadow-md ${
                      isSelected ? "bg-accent-primary text-accent-primary-ink" : "bg-black/40 text-white backdrop-blur-sm"
                    }`}
                  >
                    {isSelected ? "✓" : ""}
                  </div>
                ) : (
                  <button
                    onClick={() => onDeletePhoto(photo)}
                    title="Delete this photo"
                    aria-label="Delete this photo"
                    className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-sm text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="p-2.5">
                <TagEditor
                  tags={photo.tags || []}
                  editable={!isSelecting}
                  onAddTag={(tag) => onAddTag(photo.id, tag)}
                  onRemoveTag={(tag) => onRemoveTag(photo.id, tag)}
                />
              </div>
            </div>
            );
          })}
        </div>
      )}

      {isSelecting && selectedIds.size > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[65] flex justify-center px-4">
          <div className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-panel border border-border bg-surface-overlay px-4 py-3 text-ink-primary shadow-2xl">
            <span className="text-sm font-semibold">{selectedIds.size} selected</span>

            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={bulkTagDraft}
                onChange={(e) => setBulkTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitBulkTag();
                }}
                placeholder="+ tag"
                className="w-20 rounded-full border border-dashed border-border bg-transparent px-2.5 py-1 text-xs text-ink-secondary outline-none placeholder:text-ink-muted focus:border-solid focus:border-accent-primary"
              />
              <button
                onClick={submitBulkTag}
                className="rounded-control bg-surface-sunken px-3 py-1.5 text-xs font-semibold text-ink-secondary transition-colors hover:bg-surface-raised"
              >
                Add tag
              </button>
            </div>

            <select
              value={bulkMoveTarget}
              onChange={(e) => submitBulkMove(e.target.value)}
              className="rounded-control border border-border bg-surface-raised px-2 py-1.5 text-xs text-ink-secondary"
            >
              <option value="" disabled>
                Move to…
              </option>
              {allFolders
                .filter((f) => f.id !== folder.id)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
            </select>

            <Button variant="danger" onClick={() => setConfirmingBulkDelete(true)} className="px-3 py-1.5 text-xs">
              Delete
            </Button>

            <button
              onClick={exitSelecting}
              className="rounded-control px-3 py-1.5 text-xs font-semibold text-ink-muted underline transition-colors hover:text-ink-primary"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {confirmingBulkDelete && (
        <ConfirmDialog
          title={`Delete ${selectedIds.size} photo${selectedIds.size === 1 ? "" : "s"}?`}
          message="This can't be undone."
          confirmLabel="Delete"
          onConfirm={confirmBulkDelete}
          onCancel={() => setConfirmingBulkDelete(false)}
        />
      )}
    </div>
  );
}
