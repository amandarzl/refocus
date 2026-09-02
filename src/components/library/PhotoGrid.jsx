import { useMemo, useState } from "react";
import TagEditor, { normalizeTag } from "../board/TagEditor.jsx";
import ConfirmDialog from "../ConfirmDialog.jsx";
import { filesToReferences } from "../../utils/imageProcessor.js";

// The folder's full archive — every photo, no cap. Unlike the Reference
// Board's single active-slot-per-folder view, this is a plain library
// manager: tag, delete, add more. No Focus Mode / "set as active" here —
// that stays a Reference Board concept.
export default function PhotoGrid({
  isDark,
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
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
            isDark ? "text-slate-300 hover:bg-zinc-800" : "text-slate-600 hover:bg-slate-200"
          }`}
          title="Back to folders"
          aria-label="Back to folders"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className={`text-xl font-bold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
          {folder.name}
        </h2>
        <span className={`text-xs ${isDark ? "text-zinc-500" : "text-slate-400"}`}>
          {activeTags.length > 0
            ? `${visiblePhotos.length} of ${photos.length} photo${photos.length === 1 ? "" : "s"}`
            : `${photos.length} photo${photos.length === 1 ? "" : "s"}`}
        </span>
        {photos.length > 0 && (
          <button
            onClick={() => (isSelecting ? exitSelecting() : setIsSelecting(true))}
            className={`ml-auto rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              isDark ? "text-slate-300 hover:bg-zinc-800" : "text-slate-600 hover:bg-slate-200"
            }`}
          >
            {isSelecting ? "Cancel" : "Select"}
          </button>
        )}
        <button
          onClick={onUpload}
          className={`rounded-lg bg-[#A8C3A4] px-4 py-2 text-sm font-bold text-black transition-colors hover:bg-[#97b593] ${
            photos.length > 0 ? "" : "ml-auto"
          }`}
        >
          + Add Photos
        </button>
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
                    ? "bg-[#A8C3A4] text-black"
                    : isDark
                      ? "bg-[#A8C3A4]/15 text-[#A8C3A4] hover:bg-[#A8C3A4]/25"
                      : "bg-[#A8C3A4]/20 text-[#5c7658] hover:bg-[#A8C3A4]/30"
                }`}
              >
                #{tag}
              </button>
            );
          })}
          {activeTags.length > 0 && (
            <button
              onClick={() => setActiveTags([])}
              className={`rounded-full px-2.5 py-1 text-xs font-medium underline transition-colors ${
                isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {photos.length === 0 ? (
        <div
          className={`mt-6 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-16 text-center transition-colors ${
            isDragging
              ? "border-[#A8C3A4] bg-[#A8C3A4]/10"
              : isDark
                ? "border-zinc-700 bg-[#1F1F23]"
                : "border-slate-300 bg-white"
          }`}
        >
          <p className={`text-sm font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            {isBusy ? "Adding…" : isDragging ? "Drop to add" : "No photos in this folder yet — drag and drop to add some."}
          </p>
        </div>
      ) : visiblePhotos.length === 0 ? (
        <div
          className={`mt-6 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-16 text-center ${
            isDark ? "border-zinc-700 bg-[#1F1F23]" : "border-slate-300 bg-white"
          }`}
        >
          <p className={`text-sm font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            No photos match the selected tags.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visiblePhotos.map((photo) => {
            const isSelected = selectedIds.has(photo.id);
            return (
            <div
              key={photo.id}
              onClick={isSelecting ? () => toggleSelected(photo.id) : undefined}
              className={`group overflow-hidden rounded-xl border shadow-sm transition-colors ${
                isSelecting ? "cursor-pointer" : ""
              } ${
                isSelected
                  ? "border-[#A8C3A4] ring-2 ring-[#A8C3A4]"
                  : isDark
                    ? "border-zinc-800 bg-[#242428]"
                    : "border-slate-200 bg-white"
              } ${isDark ? "bg-[#242428]" : "bg-white"}`}
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
                      isSelected ? "bg-[#A8C3A4] text-black" : "bg-black/40 text-white backdrop-blur-sm"
                    }`}
                  >
                    {isSelected ? "✓" : ""}
                  </div>
                ) : (
                  <button
                    onClick={() => onDeletePhoto(photo)}
                    title="Delete this photo"
                    className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-sm text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="p-2.5">
                <TagEditor
                  tags={photo.tags || []}
                  isDark={isDark}
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
          <div
            className={`pointer-events-auto flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl ${
              isDark ? "border-zinc-700 bg-[#242428] text-slate-100" : "border-slate-200 bg-white text-slate-900"
            }`}
          >
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
                className={`w-20 rounded-full border border-dashed bg-transparent px-2.5 py-1 text-xs outline-none focus:border-solid focus:border-[#A8C3A4] ${
                  isDark ? "border-zinc-600 text-slate-300 placeholder:text-zinc-600" : "border-slate-300 text-slate-600 placeholder:text-slate-400"
                }`}
              />
              <button
                onClick={submitBulkTag}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isDark ? "bg-zinc-800 text-slate-300 hover:bg-zinc-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Add tag
              </button>
            </div>

            <select
              value={bulkMoveTarget}
              onChange={(e) => submitBulkMove(e.target.value)}
              className={`rounded-lg border px-2 py-1.5 text-xs ${
                isDark ? "border-zinc-700 bg-zinc-800 text-slate-200" : "border-slate-300 bg-white text-slate-700"
              }`}
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

            <button
              onClick={() => setConfirmingBulkDelete(true)}
              className="rounded-lg bg-[#E5989B] px-3 py-1.5 text-xs font-bold text-black transition-colors hover:bg-[#d97f83]"
            >
              Delete
            </button>

            <button
              onClick={exitSelecting}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold underline transition-colors ${
                isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {confirmingBulkDelete && (
        <ConfirmDialog
          isDark={isDark}
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
