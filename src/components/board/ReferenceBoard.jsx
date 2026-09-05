import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db.js";
import {
  extractPaletteFromImageSrc,
  filesToReferences,
  getImageFilesFromClipboard,
} from "../../utils/imageProcessor.js";
import FolderSlot from "./FolderSlot.jsx";
import AddFolderMenu from "./AddFolderMenu.jsx";
import FocusMode from "./FocusMode.jsx";
import FolderUploadModal from "./FolderUploadModal.jsx";
import BreakBanner from "./BreakBanner.jsx";
import PaletteSection from "./PaletteSection.jsx";
import Button from "../ui/Button.jsx";
import Popover from "../ui/Popover.jsx";
import TourCallout from "../ui/TourCallout.jsx";
import CardSizeControl, { cardGridStyle, DEFAULT_WIDTH } from "../ui/CardSizeControl.jsx";
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
  // Accessibility preference for this board's own folder grid — see
  // CardSizeControl.jsx. "loading" is a sentinel distinct from `undefined`
  // (which `.value` would also be for a genuinely absent row) so a
  // still-loading read is never mistaken for "no preference set" — see
  // App.jsx's welcomeSetting for the same pattern.
  const cardMinWidthSetting = useLiveQuery(() => db.settings.get("cardMinWidth"), [], "loading");
  const cardMinWidth = cardMinWidthSetting?.value || DEFAULT_WIDTH;

  // Folder creation for a brand-new library happens in NewDrawingModal.jsx,
  // the moment a new drawing is actually started — no blanket seed here.

  // A folder is "on the board" purely by having a boardSlots entry —
  // whichever folders were checked in NewDrawingModal get one the moment a
  // drawing starts (see App.jsx's handleStartDrawing), but from then on
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
  // Excludes drafts too — an orphaned draft from an abandoned, never-saved
  // session (see App.jsx's confirmBoardFolders) isn't "existing" yet, so it
  // shouldn't be offered back via "Add existing" until it's confirmed.
  const attachableFolders = useMemo(
    () => folders.filter((f) => !attachedFolderIds.has(f.id) && !f.isDraft),
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
    // Continue the placeholder numbering from whatever's actually still
    // around — confirmed folders anywhere, or a draft still attached to
    // this board — so a second batch never repeats a name still in use.
    // Orphaned drafts from some other, abandoned session are excluded: they
    // don't show up anywhere you'd see them (Add References, this same
    // "New folder" list), so they shouldn't be able to push the count up
    // either — once 1-4 are gone from view, the next one really is 1.
    const relevantFolders = folders.filter((f) => !f.isDraft || attachedFolderIds.has(f.id));
    const usedNumbers = relevantFolders
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
        isDraft: true,
      });
      newSlots.push({ folderId: newId, activeReferenceId: null, locked: false });
    }
    onSlotsChange([...boardSlots, ...newSlots]);
  };

  const handleRenameFolder = async (folderId, name) => {
    await db.folders.update(folderId, { name });
  };

  // Takes an array so "Add existing" can attach a whole checklist's worth
  // at once in a single state update — calling the single-folder version
  // of this in a loop would have each call read the same stale
  // `boardSlots` closure and overwrite the previous one's result instead
  // of accumulating.
  const handleAttachFolders = (folderIds) => {
    const existingIds = new Set(boardSlots.map((s) => s.folderId));
    const newSlots = folderIds
      .filter((id) => !existingIds.has(id))
      .map((folderId) => ({ folderId, activeReferenceId: null, locked: false }));
    if (newSlots.length === 0) return;
    onSlotsChange([...boardSlots, ...newSlots]);
  };

  // Removes a manually-attached folder's card from this board only — the
  // folder and its photos are untouched in Add References, and it's still
  // pickable again from "Add existing" any time. Deleting a folder for
  // good only ever happens on the Add References page.
  const handleDetachFolder = async (folderId) => {
    onSlotsChange(boardSlots.filter((s) => s.folderId !== folderId));
    if (focusFolderId === folderId) closeFocus();

    // A folder only counts as "real" once it's added directly in Add
    // References, or the board session it was created on has actually been
    // saved (see App.jsx's confirmBoardFolders) — no exceptions for
    // Form/Pose/Gesture/etc. just because of their name. Until then it's
    // still a draft, and detaching it while empty has nothing worth
    // keeping, so it's deleted outright instead of lingering as a
    // meaningless entry in Add References.
    const folder = folders.find((f) => f.id === folderId);
    const hasPhotos = (refsByFolder.get(folderId) || []).length > 0;
    if (folder?.isDraft && !hasPhotos) {
      await db.folders.delete(folderId);
    }
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
  // Which slot's card the mouse is currently over — just enough to tell
  // Ctrl+V which folder to paste into (see the paste effect below).
  const [hoveredFolderId, setHoveredFolderId] = useState(null);

  // Ctrl+V anywhere on the board adds straight to whichever folder you're
  // looking at — the folder open in Focus Mode (a full overlay, so hover
  // can't apply there), otherwise whichever slot card the mouse is over.
  // Skipped while "Add more" is already open for a slot (it owns paste
  // itself, see FolderUploadModal.jsx) so a paste never lands twice.
  useEffect(() => {
    if (uploadFolderId != null) return;
    const handleWindowPaste = async (e) => {
      const imageFiles = getImageFilesFromClipboard(e.clipboardData);
      if (imageFiles.length === 0) return;
      const targetId = focusFolderId ?? hoveredFolderId;
      const target = folders.find((f) => f.id === targetId);
      if (!target) return;
      const refs = await filesToReferences(imageFiles, target.id);
      if (refs.length > 0) await handleAddReferences(refs);
    };
    window.addEventListener("paste", handleWindowPaste);
    return () => window.removeEventListener("paste", handleWindowPaste);
  }, [uploadFolderId, focusFolderId, hoveredFolderId, folders, boardSlots]);
  const [focusIndex, setFocusIndex] = useState(0);
  const [isAddFolderMenuOpen, setIsAddFolderMenuOpen] = useState(false);
  const [isToolbarMenuOpen, setIsToolbarMenuOpen] = useState(false);

  // --- First-time board tour: Shuffle -> first slot's Lock -> Focus Lock,
  // each shown once ever (see App.jsx's matching hasSeenWelcome, for the
  // hub-side welcome modal — a separate flag). Only starts once there's
  // at least one folder on the board, since otherwise there's nothing for
  // Shuffle/Lock to point at — someone whose first drawing is a blank
  // canvas just gets the tour the next time they open a populated board.
  const boardTourSetting = useLiveQuery(() => db.settings.get("hasSeenBoardTour"), [], "loading");
  const [tourStep, setTourStep] = useState(null); // 'shuffle' | 'lock' | 'focusLock' | null
  const hasStartedTour = useRef(false);

  useEffect(() => {
    // Onboarding temporarily disabled — see App.jsx's OnboardingModal render
    // and Header.jsx's "Replay welcome tour" for the other two pieces of
    // this same feature, also disabled. `tourStep` simply never leaves
    // `null` this way, so every TourCallout below (and FolderSlot's
    // tourActive) stays inert without touching the rest of this logic.
    return;
    // eslint-disable-next-line no-unreachable
    if (hasStartedTour.current) return;
    if (boardTourSetting === "loading") return; // still loading — see App.jsx's welcomeSetting for why
    if (boardTourSetting?.value) return; // already seen
    if (boardSlots.length === 0) return; // nothing to point at yet
    hasStartedTour.current = true;
    setTourStep("shuffle");
  }, [boardTourSetting, boardSlots.length]);

  const finishTour = async () => {
    setTourStep(null);
    await db.settings.put({ key: "hasSeenBoardTour", value: true });
  };

  const advanceTour = () => {
    if (tourStep === "shuffle") {
      // The lock step points at the first slot's own lock toggle, which
      // only renders once that slot actually has a picture to lock (see
      // FolderSlot.jsx) — skip straight to Focus Lock if it's still
      // empty rather than pointing at a control that isn't there.
      const firstFolder = orderedBoardFolders[0];
      const hasPicture = firstFolder && !!getSlot(firstFolder.id).activeReferenceId;
      setTourStep(hasPicture ? "lock" : "focusLock");
    } else if (tourStep === "lock") {
      setTourStep("focusLock");
    } else {
      finishTour();
    }
  };

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

  // A slot card can unmount while the mouse is still "over" it — opening
  // Focus Mode or Rearrange mode replaces the grid outright, and a card's
  // own onMouseLeave never fires for that (only a real pointer move would).
  // Left alone, `hoveredFolderId` would keep pointing at that folder even
  // after you've moved on, so Ctrl+V could silently land somewhere you're
  // no longer looking at. Clearing it whenever the grid stops being the
  // literal thing under the mouse means a stale hover never outlives the
  // view that produced it — the next genuine hover sets it fresh.
  useEffect(() => {
    if (focusFolderId != null || uploadFolderId != null || isRearranging || isBoardLocked) {
      setHoveredFolderId(null);
    }
  }, [focusFolderId, uploadFolderId, isRearranging, isBoardLocked]);

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
              <Button
                variant="primary"
                icon
                label="Unlock board"
                onClick={() => onToggleBoardLocked(false)}
                className="ml-auto"
                title="Unlock — bring back the board's controls"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 118 0" />
                </svg>
              </Button>
            ) : (
              <>
                <CardSizeControl value={cardMinWidth} />
                <div className="relative ml-auto">
                  <Button
                    variant={isAddFolderMenuOpen ? "primary" : "secondary"}
                    icon
                    label="Add a folder to this board"
                    onClick={() => setIsAddFolderMenuOpen((v) => !v)}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </Button>
                  <AddFolderMenu
                    isOpen={isAddFolderMenuOpen}
                    existingFolders={attachableFolders}
                    onCreateFolders={handleCreateFolders}
                    onAttachFolders={handleAttachFolders}
                    onClose={() => setIsAddFolderMenuOpen(false)}
                  />
                </div>
                <div className="relative">
                  <Button variant="secondary" icon label="Shuffle" onClick={handleShuffle}>
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 3 21 3 21 8" />
                      <line x1="4" y1="20" x2="21" y2="3" />
                      <polyline points="21 16 21 21 16 21" />
                      <line x1="15" y1="15" x2="21" y2="21" />
                      <line x1="4" y1="4" x2="9" y2="9" />
                    </svg>
                  </Button>
                  {tourStep === "shuffle" && (
                    <TourCallout
                      message="Shuffle swaps in a new picture from each unlocked folder. Try it anytime you want a fresh angle."
                      align="right"
                      onAdvance={advanceTour}
                      onSkip={finishTour}
                    />
                  )}
                </div>
                <div className="relative">
                  <Button
                    variant="secondary"
                    icon
                    label="Focus Lock — hide controls and freeze the pictures"
                    onClick={() => onToggleBoardLocked(true)}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="5" y="11" width="14" height="10" rx="2" />
                      <path d="M8 11V7a4 4 0 018 0v4" />
                    </svg>
                  </Button>
                  {tourStep === "focusLock" && (
                    <TourCallout
                      message="Focus Lock hides every control so you can just draw. Unlock anytime from the same spot."
                      advanceLabel="Got it"
                      align="right"
                      onAdvance={finishTour}
                      onSkip={finishTour}
                    />
                  )}
                </div>
                <div className="relative">
                  <Button
                    variant={isToolbarMenuOpen ? "primary" : "secondary"}
                    icon
                    label="More board actions"
                    onClick={() => setIsToolbarMenuOpen((v) => !v)}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <line x1="3" y1="12" x2="21" y2="12" />
                      <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                  </Button>
                  <Popover isOpen={isToolbarMenuOpen} onClose={() => setIsToolbarMenuOpen(false)} width="w-48">
                    <div className="p-1">
                      <button
                        onClick={() => {
                          setIsRearranging((v) => !v);
                          setIsToolbarMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-control px-3 py-2 text-left text-sm font-semibold text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary"
                      >
                        {isRearranging ? "Done rearranging" : "Rearrange folders"}
                      </button>
                      <button
                        onClick={() => {
                          handleGeneratePaletteForBoard();
                          setIsToolbarMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-control px-3 py-2 text-left text-sm font-semibold text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary"
                      >
                        Generate Palette
                      </button>
                    </div>
                  </Popover>
                </div>
              </>
            )}
          </div>

          {!isBoardLocked && (
            <label className="mt-3 flex w-fit items-center gap-2 text-xs font-medium text-ink-secondary">
              <input
                type="checkbox"
                checked={timerEnabled}
                onChange={(e) => handleToggleTimer(e.target.checked)}
                className="h-3.5 w-3.5 cursor-pointer accent-accent-primary"
              />
              Session timer
              {timerEnabled && (
                <>
                  <select
                    value={timerDuration}
                    onChange={(e) => handleTimerDurationChange(Number(e.target.value))}
                    className="rounded-control border border-border bg-surface-raised px-1.5 py-0.5 text-xs text-ink-secondary"
                  >
                    {TIMER_DURATIONS.map((min) => (
                      <option key={min} value={min}>{min} min</option>
                    ))}
                  </select>
                  <span className="font-mono tabular-nums text-accent-primary">{timeRemaining}</span>
                </>
              )}
            </label>
          )}

          {/* Folder slots */}
          <div className="mt-6 grid gap-6" style={cardGridStyle(cardMinWidth)}>
            {orderedBoardFolders.map((folder, index) => {
              const slot = getSlot(folder.id);
              return (
                <FolderSlot
                  key={folder.id}
                  cardRef={(el) => (cardRefs.current[folder.id] = el)}
                  folder={folder}
                  tourActive={index === 0 && tourStep === "lock"}
                  onTourAdvance={advanceTour}
                  onTourSkip={finishTour}
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
                  onMouseEnter={
                    isRearranging || isBoardLocked ? undefined : () => setHoveredFolderId(folder.id)
                  }
                  onMouseLeave={
                    isRearranging || isBoardLocked
                      ? undefined
                      : () => setHoveredFolderId((current) => (current === folder.id ? null : current))
                  }
                />
              );
            })}
          </div>

          {/* Palette */}
          {paletteEntries.length > 0 && (
            <div className="mt-8">
              <PaletteSection entries={paletteEntries} onRemove={handleRemovePalette} />
            </div>
          )}
        </>
      )}

      {uploadFolder && (
        <FolderUploadModal
          folder={uploadFolder}
          onClose={() => setUploadFolderId(null)}
          onAddReferences={handleAddReferences}
          existingReferences={refsByFolder.get(uploadFolder.id) || []}
          onPick={(refId) => handlePick(uploadFolder.id, refId)}
        />
      )}

      {showBreak && !isBoardLocked && (
        <BreakBanner
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
