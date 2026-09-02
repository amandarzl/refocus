import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db.js";
import { extractPaletteFromImageSrc } from "../../utils/imageProcessor.js";
import FolderSlot from "./FolderSlot.jsx";
import AddFolderMenu from "./AddFolderMenu.jsx";
import FocusMode from "./FocusMode.jsx";
import FolderUploadModal from "./FolderUploadModal.jsx";
import BreakBanner from "./BreakBanner.jsx";
import PaletteSection from "./PaletteSection.jsx";
import {
  TIMER_DURATIONS,
  TIMER_DURATION_DEFAULT,
  DEFAULT_TRANSFORM,
  pickRandom,
  setActiveReference,
} from "./constants.js";

// The workspace itself: one board of folders, each showing its current
// active pick. Shuffle re-rolls every unlocked slot at once; locked
// slots sit out.
export default function ReferenceBoard({
  isDark,
  boardSlots,
  boardOrder,
  onSlotsChange,
  onBoardOrderChange,
  isBoardLocked,
  onToggleBoardLocked,
}) {
  const foldersRaw = useLiveQuery(() => db.folders.orderBy("order").toArray(), []);
  const folders = foldersRaw || [];
  const allRefs = useLiveQuery(() => db.references.toArray(), []) || [];

  // Folder creation for a brand-new library now happens per-template, the
  // moment a template is actually selected (see App.jsx's
  // ensureTemplateFolders/buildInitialBoardSlots) — no blanket seed here.

  // A folder is "on the board" purely by having a boardSlots entry — the
  // default folders (Form/Pose/Color/Vibe) get one automatically when a
  // drawing starts (see App.jsx's buildInitialBoardSlots), but from then on
  // they're detachable/reattachable exactly like any other folder. A folder
  // created in the Add References library stays library-only until it's
  // explicitly attached here — attachment is per-drawing-session, tracked
  // as a boardSlots entry (folders never auto-sync onto the board).
  const attachedFolderIds = useMemo(
    () => new Set(boardSlots.map((s) => s.folderId)),
    [boardSlots],
  );
  const boardFolders = useMemo(
    () => folders.filter((f) => attachedFolderIds.has(f.id)),
    [folders, attachedFolderIds],
  );
  const attachableFolders = useMemo(
    () => folders.filter((f) => !attachedFolderIds.has(f.id)),
    [folders, attachedFolderIds],
  );

  // The board's own card arrangement — independent of db.folders' shared
  // `order` (which the Add References archive's folder list uses). Anything
  // not yet in `boardOrder` (a brand-new or freshly-attached folder) just
  // falls in at the end in natural order; dragging is what actually writes
  // to `boardOrder`.
  const orderedBoardFolders = useMemo(() => {
    const known = boardOrder
      .filter((id) => boardFolders.some((f) => f.id === id))
      .map((id) => boardFolders.find((f) => f.id === id));
    const rest = boardFolders.filter((f) => !boardOrder.includes(f.id));
    return [...known, ...rest];
  }, [boardFolders, boardOrder]);

  const refsByFolder = useMemo(() => {
    const map = new Map();
    for (const ref of allRefs) {
      if (!map.has(ref.folderId)) map.set(ref.folderId, []);
      map.get(ref.folderId).push(ref);
    }
    for (const list of map.values()) list.sort((a, b) => a.createdAt - b.createdAt);
    return map;
  }, [allRefs]);

  const slotsByFolder = useMemo(() => {
    const map = new Map();
    for (const s of boardSlots) map.set(s.folderId, s);
    return map;
  }, [boardSlots]);

  const getSlot = (folderId) =>
    slotsByFolder.get(folderId) || {
      folderId,
      activeReferenceId: null,
      locked: false,
      transform: DEFAULT_TRANSFORM,
    };

  const refById = useMemo(() => {
    const map = new Map();
    for (const ref of allRefs) map.set(ref.id, ref);
    return map;
  }, [allRefs]);

  // --- Actions ---
  const handleShuffle = () => {
    if (isBoardLocked) return;
    const newSlots = [];
    for (const folder of boardFolders) {
      const slot = getSlot(folder.id);
      const pool = refsByFolder.get(folder.id) || [];
      if (slot.locked || pool.length === 0) {
        newSlots.push(slot);
        continue;
      }
      const picked = pickRandom(pool, slot.activeReferenceId);
      if (picked && picked.id !== slot.activeReferenceId) {
        newSlots.push({ ...slot, activeReferenceId: picked.id, transform: DEFAULT_TRANSFORM });
      } else {
        newSlots.push(slot);
      }
    }
    onSlotsChange(newSlots);
  };

  const handleToggleLock = (folderId) => {
    onSlotsChange(
      boardFolders.map((f) => {
        const slot = getSlot(f.id);
        return f.id === folderId ? { ...slot, locked: !slot.locked } : slot;
      }),
    );
  };

  const handlePick = (folderId, referenceId) => {
    const slot = getSlot(folderId);
    onSlotsChange(
      boardFolders.map((f) =>
        f.id === folderId
          ? { ...slot, activeReferenceId: referenceId, transform: DEFAULT_TRANSFORM }
          : getSlot(f.id),
      ),
    );
    closeFocus();
  };

  // Creating folders directly on the board is itself the "manual add" —
  // each gets an immediate slot. A folder created in the Add References
  // library instead, or picked from the "Add existing" list below, only
  // shows up here once explicitly attached. Placeholder-named ("New folder
  // 1", "New folder 2", …) since the point is to add several quickly and
  // rename each after, right on its card.
  const handleCreateFolders = async (count) => {
    // Continue the placeholder numbering from whatever's already in use
    // (anywhere — attached or not) instead of always restarting at 1, so a
    // second or third batch never repeats a name a previous one already
    // used (e.g. six existing "New folder"s → next batch starts at 7).
    const usedNumbers = folders
      .map((f) => /^New folder (\d+)$/i.exec(f.name)?.[1])
      .filter(Boolean)
      .map(Number);
    const startAt = (usedNumbers.length ? Math.max(...usedNumbers) : 0) + 1;

    const newSlots = [];
    const baseOrder = folders.length;
    for (let i = 0; i < count; i++) {
      const newId = await db.folders.add({
        name: `New folder ${startAt + i}`,
        order: baseOrder + i,
        createdAt: Date.now(),
      });
      newSlots.push({ folderId: newId, activeReferenceId: null, locked: false });
    }
    onSlotsChange([...boardSlots, ...newSlots]);
  };

  const handleRenameFolder = async (folderId, name) => {
    await db.folders.update(folderId, { name });
  };

  const handleAttachFolder = (folderId) => {
    if (boardSlots.some((s) => s.folderId === folderId)) return;
    onSlotsChange([...boardSlots, { folderId, activeReferenceId: null, locked: false }]);
  };

  // Removes a manually-attached folder's card from this board only — the
  // folder and its photos are untouched in Add References, and it's still
  // pickable again from "Add existing" any time. Deleting a folder for
  // good only ever happens on the Add References page.
  const handleDetachFolder = (folderId) => {
    onSlotsChange(boardSlots.filter((s) => s.folderId !== folderId));
    if (focusFolderId === folderId) closeFocus();
  };

  // --- Drag a folder card's picture onto another folder card to move it
  // out of one folder and into another. A one-off correction, not a
  // reorganizing workflow: no multi-select, no persistent "move mode".
  const [draggingPhoto, setDraggingPhoto] = useState(null); // { folderId, refId }

  const handleMovePhoto = async (toFolderId) => {
    const draft = draggingPhoto;
    setDraggingPhoto(null);
    if (!draft || draft.folderId === toFolderId) return;
    await db.references.update(draft.refId, { folderId: toFolderId });
    // The dropped picture always becomes the destination's active pick —
    // whatever it was showing before isn't lost, just no longer displayed
    // (still in that folder's pool, same as after any Shuffle re-pick).
    const next = boardFolders.map((f) => {
      const slot = getSlot(f.id);
      if (f.id === draft.folderId && slot.activeReferenceId === draft.refId) {
        return { ...slot, activeReferenceId: null, locked: false, transform: DEFAULT_TRANSFORM };
      }
      if (f.id === toFolderId) {
        return { ...slot, activeReferenceId: draft.refId, locked: false, transform: DEFAULT_TRANSFORM };
      }
      return slot;
    });
    onSlotsChange(next);
  };

  const handleAddReferences = async (refs) => {
    await db.references.bulkAdd(refs);
    if (refs.length === 0) return;

    // The freshly-added image becomes the slot's active picture — whether
    // the folder was showing "+" or already had something else up — same
    // rule the Add References archive page uses for its own uploads.
    const folderId = refs[0].folderId;
    const folder = folders.find((f) => f.id === folderId);
    const latest = await db.references.where("folderId").equals(folderId).last();
    const updated = setActiveReference(boardSlots, folder, latest);
    if (updated !== boardSlots) onSlotsChange(updated);
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

  // --- Non-destructive per-slot edits (crop/mirror/gray/rotate/undo) ---
  // These only ever touch boardSlots — the underlying reference in
  // db.references (and therefore the Add References library and every
  // other session) is never modified.
  const patchTransform = (folderId, patch) => {
    onSlotsChange(
      boardFolders.map((f) => {
        const slot = getSlot(f.id);
        if (f.id !== folderId) return slot;
        return { ...slot, transform: { ...(slot.transform || DEFAULT_TRANSFORM), ...patch } };
      }),
    );
  };

  const handleToggleMirror = (folderId) => {
    const slot = getSlot(folderId);
    patchTransform(folderId, { mirrored: !(slot.transform?.mirrored) });
  };

  const handleToggleGray = (folderId) => {
    const slot = getSlot(folderId);
    patchTransform(folderId, { grayscale: !(slot.transform?.grayscale) });
  };

  const handleRotate = (folderId) => {
    const slot = getSlot(folderId);
    patchTransform(folderId, { rotation: ((slot.transform?.rotation || 0) + 90) % 360 });
  };

  const handleRevert = (folderId) => {
    onSlotsChange(
      boardFolders.map((f) => {
        const slot = getSlot(f.id);
        return f.id === folderId ? { ...slot, transform: DEFAULT_TRANSFORM } : slot;
      }),
    );
    setIsCropMode(false);
    setCropRect(null);
  };

  // "Delete" in the edit menu clears the slot back to empty — it never
  // deletes the photo itself from the library (that's Add References' job).
  const handleClearSlot = (folderId) => {
    onSlotsChange(
      boardFolders.map((f) => {
        const slot = getSlot(f.id);
        return f.id === folderId
          ? { ...slot, activeReferenceId: null, locked: false, transform: DEFAULT_TRANSFORM }
          : slot;
      }),
    );
    closeFocus();
  };

  // --- Crop (ported from the old free-form canvas's crop tool) ---
  const [isCropMode, setIsCropMode] = useState(false);
  const [cropRect, setCropRect] = useState(null);
  const cropDragRef = useRef(null);

  const handleStartCrop = (folderId) => {
    const slot = getSlot(folderId);
    setIsCropMode(true);
    setCropRect(slot.transform?.crop ?? { left: 0.1, top: 0.1, right: 0.9, bottom: 0.9 });
  };

  const applyCrop = (folderId) => {
    if (!cropRect) return;
    patchTransform(folderId, { crop: cropRect });
    setIsCropMode(false);
  };

  const cancelCrop = () => {
    setCropRect(null);
    setIsCropMode(false);
  };

  const handleCropPointerDown = (e, handle, containerRect) => {
    e.stopPropagation();
    const rect = containerRect;
    cropDragRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      rect,
      initial: { ...cropRect },
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleCropPointerMove = (e) => {
    const drag = cropDragRef.current;
    if (!drag) return;
    const dx = (e.clientX - drag.startX) / drag.rect.width;
    const dy = (e.clientY - drag.startY) / drag.rect.height;
    const init = drag.initial;

    let next = { ...init };
    const min = 0.05;

    if (drag.handle === "move") {
      const w = init.right - init.left;
      const h = init.bottom - init.top;
      next.left = Math.max(0, Math.min(1 - w, init.left + dx));
      next.top = Math.max(0, Math.min(1 - h, init.top + dy));
      next.right = next.left + w;
      next.bottom = next.top + h;
    } else {
      // Handle names are compass abbreviations (nw, n, ne, e, se, s, sw, w) —
      // check for the w/e/n/s letters, not full words.
      if (drag.handle.includes("w"))
        next.left = Math.max(0, Math.min(init.right - min, init.left + dx));
      if (drag.handle.includes("e"))
        next.right = Math.min(1, Math.max(init.left + min, init.right + dx));
      if (drag.handle.includes("n"))
        next.top = Math.max(0, Math.min(init.bottom - min, init.top + dy));
      if (drag.handle.includes("s"))
        next.bottom = Math.min(1, Math.max(init.top + min, init.bottom + dy));
    }
    setCropRect(next);
  };

  const handleCropPointerUp = () => {
    cropDragRef.current = null;
  };

  // --- Palette generation (shared cache: db.references[id].palette) ---
  const handleGeneratePalette = async (refId) => {
    const ref = await db.references.get(refId);
    if (!ref) return;
    try {
      const palette = await extractPaletteFromImageSrc(ref.src, 5);
      await db.references.update(refId, { palette });
    } catch (err) {
      console.error("Palette generation failed:", err);
    }
  };

  const handleGeneratePaletteForBoard = () => {
    // Only fill in folders that don't already have a cached palette on
    // their active image — this is what lets a deleted row (or a fresh
    // pick that's never been generated) come back on the next click
    // without redoing every other row's swatches too.
    const missingIds = boardFolders
      .map((f) => getSlot(f.id).activeReferenceId)
      .filter((id) => id && !refById.get(id)?.palette?.length);
    missingIds.forEach((id) => handleGeneratePalette(id));
  };

  // Drop a folder's palette row from the section below the grid — clears
  // the cache on its active image so the row disappears; "Generate
  // Palette" recomputes it (or whatever picture is active by then).
  const handleRemovePalette = async (folderId) => {
    const activeId = getSlot(folderId).activeReferenceId;
    if (!activeId) return;
    await db.references.update(activeId, { palette: null });
  };

  // --- UI state ---
  const [uploadFolderId, setUploadFolderId] = useState(null);
  const [focusFolderId, setFocusFolderId] = useState(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const [isAddFolderMenuOpen, setIsAddFolderMenuOpen] = useState(false);
  const [isToolbarMenuOpen, setIsToolbarMenuOpen] = useState(false);

  const openFocus = (folder) => {
    const pool = refsByFolder.get(folder.id) || [];
    const activeId = getSlot(folder.id).activeReferenceId;
    const idx = Math.max(0, pool.findIndex((r) => r.id === activeId));
    setFocusFolderId(folder.id);
    setFocusIndex(idx);
  };

  const closeFocus = () => {
    setFocusFolderId(null);
    setIsCropMode(false);
    setCropRect(null);
  };

  // --- Focus Lock: hide every card control and freeze the pictures so you
  // can just look at them while drawing — no accidental Shuffle/Clear/
  // Detach/drag clicks. Opening Focus Mode to view/zoom an image still
  // works while locked (that's viewing, not changing the board); Shuffle
  // and every other board-altering control disappear along with the rest
  // of the toolbar (see the toolbar render below). Lives in App.jsx
  // (`isBoardLocked`/`onToggleBoardLocked` props) so the header can hide
  // alongside these controls — see App.jsx.

  // --- Rearrange mode: drag cards to reorder them (board-only, see
  // orderedBoardFolders above). Cards are plain drag surfaces while this is
  // on — no click-to-open, no overlay buttons — so a tap can't be mistaken
  // for the start of a drag and vice versa.
  const [isRearranging, setIsRearranging] = useState(false);
  const [draggingFolderId, setDraggingFolderId] = useState(null);
  const cardRefs = useRef({});
  const dragPointerId = useRef(null);

  const handleDragPointerDown = (folderId, e) => {
    if (!isRearranging) return;
    e.preventDefault();
    dragPointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingFolderId(folderId);
  };

  const handleDragPointerMove = (e) => {
    if (!draggingFolderId || e.pointerId !== dragPointerId.current) return;
    for (const folder of orderedBoardFolders) {
      if (folder.id === draggingFolderId) continue;
      const el = cardRefs.current[folder.id];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const over =
        e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!over) continue;
      const currentOrder = orderedBoardFolders.map((f) => f.id);
      const from = currentOrder.indexOf(draggingFolderId);
      const to = currentOrder.indexOf(folder.id);
      if (from === -1 || to === -1 || from === to) continue;
      const next = [...currentOrder];
      next.splice(from, 1);
      next.splice(to, 0, draggingFolderId);
      onBoardOrderChange(next);
      break;
    }
  };

  const handleDragPointerUp = () => {
    dragPointerId.current = null;
    setDraggingFolderId(null);
  };

  // --- Timer (soft, non-blocking Pomodoro-style reminder) ---
  const timerEnabledSetting = useLiveQuery(() => db.settings.get("boardTimerEnabled"), []);
  const timerDurationSetting = useLiveQuery(() => db.settings.get("boardTimerDuration"), []);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerDuration, setTimerDuration] = useState(TIMER_DURATION_DEFAULT);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [showBreak, setShowBreak] = useState(false);

  useEffect(() => {
    if (timerEnabledSetting) setTimerEnabled(!!timerEnabledSetting.value);
  }, [timerEnabledSetting]);
  useEffect(() => {
    if (timerDurationSetting) setTimerDuration(timerDurationSetting.value);
  }, [timerDurationSetting]);

  const handleToggleTimer = (enabled) => {
    setTimerEnabled(enabled);
    db.settings.put({ key: "boardTimerEnabled", value: enabled });
    // Ask now, while this is still a direct user gesture (the checkbox
    // click) — some browsers refuse the permission prompt otherwise.
    if (enabled && typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  };
  const handleTimerDurationChange = (minutes) => {
    setTimerDuration(minutes);
    db.settings.put({ key: "boardTimerDuration", value: minutes });
  };

  useEffect(() => {
    if (!timerEnabled) {
      setSecondsLeft(null);
      setShowBreak(false);
      return;
    }
    setSecondsLeft(timerDuration * 60);
    setShowBreak(false);
  }, [timerEnabled, timerDuration]);

  useEffect(() => {
    // Paused, not reset, while Focus Lock is on — the whole point of that
    // mode is an uninterrupted view, so a break banner popping up mid-lock
    // would defeat it. Resumes from wherever it left off once unlocked.
    if (secondsLeft === null || showBreak || isBoardLocked) return;
    if (secondsLeft <= 0) {
      setShowBreak(true);
      // Real OS notification alongside the in-page banner below — the
      // banner alone is invisible once you've tabbed away to actually draw.
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        const n = new Notification("Time for a break", {
          body: "Rest your eyes for a bit — come back when you're ready.",
        });
        n.onclick = () => window.focus();
      }
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, showBreak, isBoardLocked]);

  const timeRemaining =
    secondsLeft === null
      ? "--:--"
      : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;

  // --- Derived palette view (one row per folder with a cached palette) ---
  const paletteEntries = useMemo(
    () =>
      boardFolders
        .map((folder) => {
          const activeId = getSlot(folder.id).activeReferenceId;
          const ref = activeId ? refById.get(activeId) : null;
          if (!ref?.palette?.length) return null;
          return { folderId: folder.id, folderName: folder.name, palette: ref.palette };
        })
        .filter(Boolean),
    [boardFolders, boardSlots, refById],
  );

  const focusFolder = folders.find((f) => f.id === focusFolderId);
  const uploadFolder = folders.find((f) => f.id === uploadFolderId);
  const focusSlot = focusFolder ? getSlot(focusFolder.id) : null;

  // Clicking anywhere that isn't a folder card or a toolbar control while
  // rearranging is the same as "Done rearranging" — covers the grid gaps
  // and empty page area, not just this container's own padding. A card's
  // own drag/tap is excluded via its `data-folder-card` marker: a card
  // mid-drag has pointer capture, which redirects its release click to the
  // card itself even if you let go over a gap, so that never false-triggers.
  const handleBoardBackgroundClick = (e) => {
    if (!isRearranging) return;
    if (e.target.closest("[data-folder-card], button, select, input, label")) return;
    setIsRearranging(false);
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-8" onClick={handleBoardBackgroundClick}>
      {focusFolder ? (
        <FocusMode
          isDark={isDark}
          images={refsByFolder.get(focusFolder.id) || []}
          index={focusIndex}
          activeId={focusSlot.activeReferenceId}
          transform={focusSlot.transform || DEFAULT_TRANSFORM}
          onIndexChange={setFocusIndex}
          onPick={(refId) => handlePick(focusFolder.id, refId)}
          onExit={closeFocus}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
          onToggleMirror={() => handleToggleMirror(focusFolder.id)}
          onToggleGray={() => handleToggleGray(focusFolder.id)}
          onRotate={() => handleRotate(focusFolder.id)}
          onRevert={() => handleRevert(focusFolder.id)}
          onClearSlot={() => handleClearSlot(focusFolder.id)}
          onGeneratePalette={handleGeneratePalette}
          isCropMode={isCropMode}
          cropRect={cropRect}
          onStartCrop={() => handleStartCrop(focusFolder.id)}
          onApplyCrop={() => applyCrop(focusFolder.id)}
          onCancelCrop={cancelCrop}
          onCropPointerDown={handleCropPointerDown}
          onCropPointerMove={handleCropPointerMove}
          onCropPointerUp={handleCropPointerUp}
        />
      ) : (
        <>
          {/* Toolbar — collapses to just the Focus Lock button while
              locked, since every other control here changes the board in
              some way (add, shuffle, rearrange, generate palette). */}
          <div className="flex flex-wrap items-center gap-3">
            {isBoardLocked ? (
              <button
                onClick={() => onToggleBoardLocked(false)}
                title="Unlock — bring back the board's controls"
                aria-label="Unlock board"
                className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg bg-[#A8C3A4] text-black transition-colors"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 118 0" />
                </svg>
              </button>
            ) : (
              <>
                <div className="relative ml-auto">
                  <button
                    onClick={() => setIsAddFolderMenuOpen((v) => !v)}
                    title="Add a folder to this board"
                    aria-label="Add a folder to this board"
                    className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                      isAddFolderMenuOpen
                        ? "bg-[#A8C3A4] text-black"
                        : isDark
                          ? "bg-zinc-800 text-slate-200 hover:bg-zinc-700"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                  {isAddFolderMenuOpen && (
                    <AddFolderMenu
                      isDark={isDark}
                      existingFolders={attachableFolders}
                      onCreateFolders={handleCreateFolders}
                      onAttachFolder={handleAttachFolder}
                      onClose={() => setIsAddFolderMenuOpen(false)}
                    />
                  )}
                </div>
                <button
                  onClick={handleShuffle}
                  title="Shuffle"
                  aria-label="Shuffle"
                  className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                    isDark ? "bg-zinc-800 text-slate-200 hover:bg-zinc-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 3 21 3 21 8" />
                    <line x1="4" y1="20" x2="21" y2="3" />
                    <polyline points="21 16 21 21 16 21" />
                    <line x1="15" y1="15" x2="21" y2="21" />
                    <line x1="4" y1="4" x2="9" y2="9" />
                  </svg>
                </button>
                <button
                  onClick={() => onToggleBoardLocked(true)}
                  title="Focus Lock — hide controls and freeze the pictures"
                  aria-label="Focus Lock"
                  className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                    isDark ? "bg-zinc-800 text-slate-200 hover:bg-zinc-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 018 0v4" />
                  </svg>
                </button>
                <div className="relative">
                  <button
                    onClick={() => setIsToolbarMenuOpen((v) => !v)}
                    title="More board actions"
                    aria-label="More board actions"
                    className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                      isToolbarMenuOpen
                        ? "bg-[#A8C3A4] text-black"
                        : isDark
                          ? "bg-zinc-800 text-slate-200 hover:bg-zinc-700"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <line x1="3" y1="12" x2="21" y2="12" />
                      <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                  </button>
                  {isToolbarMenuOpen && (
                    <div
                      className={`absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border shadow-2xl ${
                        isDark ? "border-zinc-700 bg-[#242428]" : "border-slate-200 bg-white"
                      }`}
                    >
                      <button
                        onClick={() => {
                          setIsRearranging((v) => !v);
                          setIsToolbarMenuOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold transition-colors ${
                          isDark ? "text-slate-200 hover:bg-zinc-800" : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {isRearranging ? "Done rearranging" : "Rearrange folders"}
                      </button>
                      <button
                        onClick={() => {
                          handleGeneratePaletteForBoard();
                          setIsToolbarMenuOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold transition-colors ${
                          isDark ? "text-slate-200 hover:bg-zinc-800" : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        Generate Palette
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {!isBoardLocked && (
            <label className={`mt-3 flex w-fit items-center gap-2 text-xs font-medium ${
              isDark ? "text-slate-300" : "text-slate-600"
            }`}>
              <input
                type="checkbox"
                checked={timerEnabled}
                onChange={(e) => handleToggleTimer(e.target.checked)}
                className="h-3.5 w-3.5 cursor-pointer accent-[#A8C3A4]"
              />
              Session timer
              {timerEnabled && (
                <>
                  <select
                    value={timerDuration}
                    onChange={(e) => handleTimerDurationChange(Number(e.target.value))}
                    className={`rounded-md border px-1.5 py-0.5 text-xs ${
                      isDark ? "border-zinc-700 bg-zinc-800 text-slate-200" : "border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    {TIMER_DURATIONS.map((min) => (
                      <option key={min} value={min}>{min} min</option>
                    ))}
                  </select>
                  <span className={`font-mono tabular-nums ${isDark ? "text-[#A8C3A4]" : "text-[#5c7658]"}`}>
                    {timeRemaining}
                  </span>
                </>
              )}
            </label>
          )}

          {/* Folder slots */}
          <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
            {orderedBoardFolders.map((folder) => {
              const slot = getSlot(folder.id);
              return (
                <FolderSlot
                  key={folder.id}
                  cardRef={(el) => (cardRefs.current[folder.id] = el)}
                  isDark={isDark}
                  folder={folder}
                  activeReference={refById.get(slot.activeReferenceId) || null}
                  locked={slot.locked}
                  transform={slot.transform || DEFAULT_TRANSFORM}
                  isRearranging={isRearranging}
                  isFocusLocked={isBoardLocked}
                  isDragging={draggingFolderId === folder.id}
                  onDragPointerDown={(e) => handleDragPointerDown(folder.id, e)}
                  onDragPointerMove={handleDragPointerMove}
                  onDragPointerUp={handleDragPointerUp}
                  onToggleLock={() => handleToggleLock(folder.id)}
                  onOpenFocus={() => openFocus(folder)}
                  onOpenUpload={() => setUploadFolderId(folder.id)}
                  onClearSlot={() => handleClearSlot(folder.id)}
                  onDetachFolder={() => handleDetachFolder(folder.id)}
                  onRenameFolder={(name) => handleRenameFolder(folder.id, name)}
                  onPhotoDragStart={() => setDraggingPhoto({ folderId: folder.id, refId: slot.activeReferenceId })}
                  onPhotoDrop={() => handleMovePhoto(folder.id)}
                  isDropTarget={!!draggingPhoto && draggingPhoto.folderId !== folder.id}
                />
              );
            })}
          </div>

          {/* Palette */}
          {paletteEntries.length > 0 && (
            <div className="mt-8">
              <PaletteSection isDark={isDark} entries={paletteEntries} onRemove={handleRemovePalette} />
            </div>
          )}
        </>
      )}

      {uploadFolder && (
        <FolderUploadModal
          isDark={isDark}
          folder={uploadFolder}
          onClose={() => setUploadFolderId(null)}
          onAddReferences={handleAddReferences}
          existingReferences={refsByFolder.get(uploadFolder.id) || []}
          onPick={(refId) => handlePick(uploadFolder.id, refId)}
        />
      )}

      {showBreak && !isBoardLocked && (
        <BreakBanner
          isDark={isDark}
          onSnooze={() => {
            setSecondsLeft(5 * 60);
            setShowBreak(false);
          }}
          onDismiss={() => {
            setSecondsLeft(timerDuration * 60);
            setShowBreak(false);
          }}
        />
      )}
    </div>
  );
}
