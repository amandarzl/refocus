import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db.js";
import FolderList from "./FolderList.jsx";
import PhotoGrid from "./PhotoGrid.jsx";
import FolderUploadModal from "../board/FolderUploadModal.jsx";
import ConfirmDialog from "../ConfirmDialog.jsx";
import Toast from "../ui/Toast.jsx";
import { setActiveReference } from "../board/constants.js";

// Standalone "Add References" destination: browse/manage the same
// db.folders + db.references library the Reference Board draws from —
// unbounded, no session or slot concept here, just a photo archive.
// `boardSlots`/`onSlotsChange` are the same board state App.jsx passes to
// ReferenceBoard — only used here to make an on-the-board folder's newly
// uploaded photo its active picture when you upload to it from this page.
export default function ReferenceLibrary({ boardSlots, onSlotsChange }) {
  const foldersRaw = useLiveQuery(() => db.folders.orderBy("order").toArray(), []) || [];
  // A folder created on the board stays a draft — not yet "confirmed real"
  // (see App.jsx's confirmBoardFolders) — until the session it's part of is
  // actually saved. Until then it's board-only: it doesn't belong in this
  // archive yet, the same way an idea you haven't committed to shouldn't
  // clutter your library. It appears here the moment it's confirmed.
  const foldersConfirmed = foldersRaw.filter((f) => !f.isDraft);
  const allRefsRaw = useLiveQuery(() => db.references.toArray(), []) || [];

  const [openFolderId, setOpenFolderId] = useState(null);
  const [uploadFolderId, setUploadFolderId] = useState(null);
  const [folderToDelete, setFolderToDelete] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // A delete (folder, single photo, or bulk) is staged here rather than
  // run immediately: the item disappears from the archive right away (see
  // the folders/allRefs filtering below), but the real Dexie delete only
  // happens once `commitDelete` runs — either when the toast's timer
  // fires, or right away if you delete something else first. Undo just
  // cancels the timer; there's nothing to restore because nothing was
  // actually deleted yet.
  const [pendingDelete, setPendingDelete] = useState(null);

  const commitDelete = async (pending) => {
    if (!pending) return;
    if (pending.type === "folder") {
      await db.references.where("folderId").equals(pending.folderId).delete();
      await db.folders.delete(pending.folderId);
      if (openFolderId === pending.folderId) setOpenFolderId(null);
    } else {
      // "photo" and "bulk" are both just a set of reference ids to drop.
      await db.references.bulkDelete(pending.ids);
    }
  };

  const scheduleDelete = (pending) => {
    // Only one pending delete at a time — a second delete while a toast is
    // still showing commits the first immediately rather than leaving it
    // ambiguous which one "Undo" would apply to.
    if (pendingDelete) {
      clearTimeout(pendingDelete.timerId);
      commitDelete(pendingDelete);
    }
    const timerId = setTimeout(() => {
      commitDelete(pending);
      setPendingDelete(null);
    }, 5000);
    setPendingDelete({ ...pending, timerId });
  };

  const undoDelete = () => {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timerId);
    setPendingDelete(null);
  };

  // Everywhere folders/refs are read from below already looks like the
  // pending delete happened — the archive shouldn't show something that's
  // one un-clicked "Undo" away from being gone anyway.
  const folders = foldersConfirmed.filter(
    (f) => !(pendingDelete?.type === "folder" && pendingDelete.folderId === f.id),
  );
  const allRefs = allRefsRaw.filter((r) => {
    if (!pendingDelete) return true;
    if (pendingDelete.type === "folder") return r.folderId !== pendingDelete.folderId;
    return !pendingDelete.ids.includes(r.id);
  });

  // Matches on folder name OR any tag on a photo inside that folder, so
  // typing finds the right folder whether you remember its name or just a
  // tag you gave things in it. Header stats/counts below stay keyed off the
  // full, unfiltered folders/allRefs — only the grid itself narrows.
  const visibleFolders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return folders;
    const matchingTagFolderIds = new Set(
      allRefs
        .filter((r) => (r.tags || []).some((t) => t.toLowerCase().includes(q)))
        .map((r) => r.folderId),
    );
    return folders.filter(
      (f) => f.name.toLowerCase().includes(q) || matchingTagFolderIds.has(f.id),
    );
  }, [folders, allRefs, searchQuery]);

  const counts = useMemo(() => {
    const c = {};
    for (const ref of allRefs) c[ref.folderId] = (c[ref.folderId] || 0) + 1;
    return c;
  }, [allRefs]);

  // Rough size estimate for the "getting large" nudge below — base64 data
  // URLs run ~4/3 the size of the actual image bytes, so this slightly
  // overstates true storage use, which is the safer direction for a warning.
  const archiveStats = useMemo(
    () => ({
      count: allRefs.length,
      bytes: allRefs.reduce((sum, ref) => sum + (ref.src?.length || 0) * 0.75, 0),
    }),
    [allRefs],
  );

  const openFolder = folders.find((f) => f.id === openFolderId);
  const uploadFolder = folders.find((f) => f.id === uploadFolderId);
  const photosInOpenFolder = useMemo(
    () =>
      openFolderId
        ? allRefs.filter((r) => r.folderId === openFolderId).sort((a, b) => a.createdAt - b.createdAt)
        : [],
    [allRefs, openFolderId],
  );

  const handleAddFolder = async (name) => {
    await db.folders.add({ name, order: folders.length, createdAt: Date.now() });
  };

  const handleRenameFolder = async (id, name) => {
    await db.folders.update(id, { name });
  };

  const handleChangeFolderColor = async (id, color) => {
    await db.folders.update(id, { color });
  };

  const confirmDeleteFolder = () => {
    const folder = folderToDelete;
    setFolderToDelete(null);
    if (!folder) return;
    scheduleDelete({
      type: "folder",
      folderId: folder.id,
      message: `Deleted "${folder.name}" and its photos`,
    });
  };

  const handleAddReferences = async (refs) => {
    await db.references.bulkAdd(refs);
    if (refs.length === 0 || !onSlotsChange) return;

    // Make the freshly-added photo the board slot's active picture — same
    // rule the board's own "+" upload uses — but only for a folder that's
    // already on the board (default, or already attached this session).
    const folderId = refs[0].folderId;
    const folder = folders.find((f) => f.id === folderId);
    const latest = await db.references.where("folderId").equals(folderId).last();
    const updated = setActiveReference(boardSlots || [], folder, latest);
    if (updated !== (boardSlots || [])) onSlotsChange(updated);
  };

  const handleDeletePhoto = (photo) => {
    scheduleDelete({ type: "photo", ids: [photo.id], message: "Photo deleted" });
  };

  // Bulk actions — same one-off "fix several at once" scope as the single-
  // photo handlers above; no board-slot syncing here either (matches
  // handleDeletePhoto, which already doesn't touch boardSlots).
  const handleBulkDelete = (ids) => {
    scheduleDelete({ type: "bulk", ids, message: `${ids.length} photos deleted` });
  };

  const handleBulkMove = async (ids, toFolderId) => {
    await db.references.where("id").anyOf(ids).modify({ folderId: toFolderId });
  };

  const handleBulkAddTag = async (ids, tag) => {
    await db.references.where("id").anyOf(ids).modify((ref) => {
      ref.tags = [...new Set([...(ref.tags || []), tag])];
    });
  };

  const handleAddTag = async (refId, tag) => {
    const ref = await db.references.get(refId);
    if (!ref) return;
    const tags = [...new Set([...(ref.tags || []), tag])];
    await db.references.update(refId, { tags });
  };

  const handleRemoveTag = async (refId, tag) => {
    const ref = await db.references.get(refId);
    if (!ref) return;
    await db.references.update(refId, { tags: (ref.tags || []).filter((t) => t !== tag) });
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {openFolder ? (
        <PhotoGrid
          folder={openFolder}
          photos={photosInOpenFolder}
          allFolders={folders}
          isUploadModalOpen={uploadFolderId != null}
          onBack={() => setOpenFolderId(null)}
          onUpload={() => setUploadFolderId(openFolder.id)}
          onAddReferences={handleAddReferences}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
          onDeletePhoto={handleDeletePhoto}
          onBulkAddTag={handleBulkAddTag}
          onBulkMove={handleBulkMove}
          onBulkDelete={handleBulkDelete}
        />
      ) : (
        <FolderList
          folders={visibleFolders}
          hasAnyFolders={folders.length > 0}
          counts={counts}
          stats={archiveStats}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onOpenFolder={(f) => setOpenFolderId(f.id)}
          onAddFolder={handleAddFolder}
          onDeleteFolder={setFolderToDelete}
          onRenameFolder={handleRenameFolder}
          onChangeFolderColor={handleChangeFolderColor}
        />
      )}

      {uploadFolder && (
        <FolderUploadModal
          folder={uploadFolder}
          onClose={() => setUploadFolderId(null)}
          onAddReferences={handleAddReferences}
        />
      )}

      {folderToDelete && (
        <ConfirmDialog
          title={`Remove "${folderToDelete.name}"?`}
          message="This deletes the folder and every photo inside it. You'll have a few seconds to undo right after."
          confirmLabel="Delete"
          onConfirm={confirmDeleteFolder}
          onCancel={() => setFolderToDelete(null)}
        />
      )}

      {pendingDelete && (
        <Toast
          message={pendingDelete.message}
          onUndo={undoDelete}
          onDismiss={() => setPendingDelete((current) => (current === pendingDelete ? null : current))}
        />
      )}
    </div>
  );
}
