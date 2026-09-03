import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db.js";
import FolderList from "./FolderList.jsx";
import PhotoGrid from "./PhotoGrid.jsx";
import FolderUploadModal from "../board/FolderUploadModal.jsx";
import ConfirmDialog from "../ConfirmDialog.jsx";
import { setActiveReference } from "../board/constants.js";

// Standalone "Add References" destination: browse/manage the same
// db.folders + db.references library the Reference Board draws from —
// unbounded, no session or slot concept here, just a photo archive.
// `boardSlots`/`onSlotsChange` are the same board state App.jsx passes to
// ReferenceBoard — only used here to make an on-the-board folder's newly
// uploaded photo its active picture when you upload to it from this page.
export default function ReferenceLibrary({ boardSlots, onSlotsChange }) {
  const folders = useLiveQuery(() => db.folders.orderBy("order").toArray(), []) || [];
  const allRefs = useLiveQuery(() => db.references.toArray(), []) || [];

  const [openFolderId, setOpenFolderId] = useState(null);
  const [uploadFolderId, setUploadFolderId] = useState(null);
  const [folderToDelete, setFolderToDelete] = useState(null);

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

  const confirmDeleteFolder = async () => {
    const folder = folderToDelete;
    setFolderToDelete(null);
    if (!folder) return;
    await db.references.where("folderId").equals(folder.id).delete();
    await db.folders.delete(folder.id);
    if (openFolderId === folder.id) setOpenFolderId(null);
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

  const handleDeletePhoto = async (photo) => {
    await db.references.delete(photo.id);
  };

  // Bulk actions — same one-off "fix several at once" scope as the single-
  // photo handlers above; no board-slot syncing here either (matches
  // handleDeletePhoto, which already doesn't touch boardSlots).
  const handleBulkDelete = async (ids) => {
    await db.references.bulkDelete(ids);
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
          folders={folders}
          counts={counts}
          stats={archiveStats}
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
          message="This deletes the folder and every photo inside it. This can't be undone."
          confirmLabel="Delete"
          onConfirm={confirmDeleteFolder}
          onCancel={() => setFolderToDelete(null)}
        />
      )}
    </div>
  );
}
