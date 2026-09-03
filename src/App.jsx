import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Header from "./components/Header.jsx";
import NewDrawingModal from "./components/NewDrawingModal.jsx";
import FinishModal from "./components/FinishModal.jsx";
import ReferenceBoard from "./components/board/ReferenceBoard.jsx";
import ReferenceLibrary from "./components/library/ReferenceLibrary.jsx";
import Button from "./components/ui/Button.jsx";
import Modal from "./components/ui/Modal.jsx";
import EmptyTile from "./components/ui/EmptyTile.jsx";
import { db } from "./db.js";
import { revokeObjectUrl } from "./utils/imageProcessor.js";
import { DEFAULT_TRANSFORM } from "./components/board/constants.js";

export default function App() {
  const [viewMode, setViewMode] = useState("hub");
  const [currentSession, setCurrentSession] = useState(null);
  const [selectedSessionIds, setSelectedSessionIds] = useState([]);
  const [previewSession, setPreviewSession] = useState(null);
  const [isNewDrawingModalOpen, setIsNewDrawingModalOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    // Persist theme preference across sessions
    const saved = localStorage.getItem("refocus-theme");
    return saved === "light" || saved === "dark" ? saved : "dark";
  });
  const [canvasTitle, setCanvasTitle] = useState("Untitled Canvas");
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  // Lives here (not in ReferenceBoard) so the header can hide alongside the
  // board's own controls while Focus Lock is on — Header and ReferenceBoard
  // are siblings, both rendered by this component.
  const [isBoardLocked, setIsBoardLocked] = useState(false);
  const savedSessions = useLiveQuery(
    () => db.sessions.orderBy("id").reverse().toArray(),
    [],
  );

  // Gallery Vault search/sort/date-filter — derived, never mutates
  // savedSessions itself (the header count and "no sessions at all" empty
  // state below both stay keyed off the unfiltered list).
  const [gallerySearch, setGallerySearch] = useState("");
  const [galleryDateFrom, setGalleryDateFrom] = useState("");
  const [galleryDateTo, setGalleryDateTo] = useState("");
  const [gallerySortOrder, setGallerySortOrder] = useState("newest");

  const clearGalleryFilters = () => {
    setGallerySearch("");
    setGalleryDateFrom("");
    setGalleryDateTo("");
  };

  // Old sessions predate the createdAt stamp — fall back to parsing the
  // display date string for them (best-effort; new sessions always have
  // createdAt, so this only matters for pre-existing vault entries).
  const getSessionTime = (s) => s.createdAt ?? (s.date ? new Date(s.date).getTime() : null);

  const visibleSessions = useMemo(() => {
    if (!savedSessions) return savedSessions;
    const q = gallerySearch.trim().toLowerCase();
    const fromTime = galleryDateFrom ? new Date(galleryDateFrom).getTime() : null;
    const toTime = galleryDateTo ? new Date(galleryDateTo).getTime() + 86399999 : null; // end of that day

    const filtered = savedSessions.filter((s) => {
      if (q) {
        const haystack = `${s.canvasTitle || ""} ${s.goal || ""} ${s.notes || ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (fromTime != null || toTime != null) {
        const t = getSessionTime(s);
        if (t == null) return false;
        if (fromTime != null && t < fromTime) return false;
        if (toTime != null && t > toTime) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      const diff = (getSessionTime(a) ?? 0) - (getSessionTime(b) ?? 0);
      return gallerySortOrder === "oldest" ? diff : -diff;
    });
  }, [savedSessions, gallerySearch, galleryDateFrom, galleryDateTo, gallerySortOrder]);

  // Reference Board state: one slot per folder ({folderId, activeReferenceId,
  // locked}) — a plain, serializable array. The actual image bytes live in
  // db.references, so there's no blob-URL lifecycle to manage here (unlike
  // the old scattered-canvas model).
  const [boardSlots, setBoardSlots] = useState([]);
  // Board-only card arrangement (folder ids, in display order) — separate
  // from db.folders' shared `order`, which the Add References archive page
  // uses for its own folder list. Session state like boardSlots: saved/
  // restored with the drawing, reset on a brand-new one.
  const [boardOrder, setBoardOrder] = useState([]);

  // The color tokens in index.css are keyed on `:root[data-theme]` — `:root`
  // is always the <html> element in CSS, never this component's own div, so
  // the attribute has to live there for the tokens to actually switch. (The
  // static data-theme on <html> in index.html is only a pre-hydration
  // fallback for the first paint.)
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("refocus-theme", next);
      return next;
    });
  };

  const resetCanvasState = useCallback(() => {
    setBoardSlots([]);
    setBoardOrder([]);
  }, []);

  // Replaces the old template-driven setup: the folders to attach are
  // whatever the user explicitly picked in NewDrawingModal, not implied by
  // a named theme. An empty `folderIds` array naturally produces an empty
  // board — that's the old "Blank Canvas" option, generalized to just be
  // what "select nothing" already does, with no special-case branch needed.
  const handleStartDrawing = async ({ title, folderIds }) => {
    // A brand-new drawing must never inherit a pointer to whatever session
    // was last saved/opened — without this, saving this drawing later could
    // silently overwrite that unrelated vault entry instead of creating its
    // own.
    setCurrentSession(null);
    setBoardOrder([]);

    const slots = [];
    for (const folderId of folderIds) {
      const latest = await db.references.where("folderId").equals(folderId).last();
      slots.push({
        folderId,
        activeReferenceId: latest ? latest.id : null,
        locked: false,
        transform: DEFAULT_TRANSFORM,
      });
    }
    setBoardSlots(slots);
    setCanvasTitle(title);
    await db.settings.put({ key: "lastNewDrawingFolderIds", value: folderIds });

    setIsNewDrawingModalOpen(false);
    setViewMode("workspace");
  };

  // Convert blob URL to base64 for Dexie persistence
  const blobUrlToBase64 = (blobUrl) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = () => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(xhr.response);
      };
      xhr.onerror = reject;
      xhr.open("GET", blobUrl);
      xhr.responseType = "blob";
      xhr.send();
    });
  };

  const handleSaveToVault = async (session) => {
    // Capture current workspace state for re-entry
    const sessionData = { ...session, canvasTitle };

    // Convert blob URL (drawing snapshot from FinishModal) to base64
    if (sessionData.image && sessionData.image.startsWith("blob:")) {
      sessionData.image = await blobUrlToBase64(sessionData.image);
    }

    // Preserve the original save time across re-saves of the same drawing —
    // only a genuinely new record gets a fresh timestamp.
    const existingForTimestamp = session.id ? await db.sessions.get(session.id) : null;

    const fullSession = {
      ...sessionData,
      canvasTitle,
      canvasState: { boardSlots, boardOrder },
      createdAt: existingForTimestamp?.createdAt ?? Date.now(),
    };

    if (session.id) {
      // Reopened session: update the existing vault record in place
      const updatedSession = { ...fullSession, id: session.id };
      await db.sessions.put(updatedSession);
      setCurrentSession(updatedSession);
    } else {
      // Brand-new drawing: create a fresh Gallery Vault entry
      const newId = await db.sessions.add(fullSession);
      setCurrentSession({ ...fullSession, id: newId });
    }

    if (session.image?.startsWith("blob:")) {
      revokeObjectUrl(session.image);
    }

    setIsFinishModalOpen(false);
    setCurrentSession(null);
    setViewMode("hub");
  };

  const handleSaveAndExit = async (sessionData) => {
    // Fall back to the first filled slot's image as the vault card preview
    let previewImage = sessionData?.previewImage || null;
    if (!previewImage) {
      const firstFilled = boardSlots.find((s) => s.activeReferenceId);
      if (firstFilled) {
        const ref = await db.references.get(firstFilled.activeReferenceId);
        previewImage = ref?.src || null;
      }
    }

    // Preserve the original save time across re-saves of the same drawing —
    // only a genuinely new record gets a fresh timestamp.
    const existingForTimestamp = sessionData?.id ? await db.sessions.get(sessionData.id) : null;

    const sessionPayload = {
      ...(sessionData || {}),
      canvasTitle,
      previewImage,
      canvasState: { boardSlots, boardOrder },
      createdAt: existingForTimestamp?.createdAt ?? Date.now(),
    };

    if (sessionData?.id) {
      // Re-opened session: update the existing vault record in place
      const updatedSession = { ...sessionPayload, id: sessionData.id };
      await db.sessions.put(updatedSession);
      setCurrentSession(updatedSession);
    } else {
      // Brand-new drawing: create a fresh Gallery Vault entry
      const newId = await db.sessions.add({
        ...sessionPayload,
        date: new Date().toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
      });
      setCurrentSession({ ...sessionPayload, id: newId });
    }

    setViewMode("hub");
    resetCanvasState();
  };

  // Leaving the workspace via the logo/Home no longer silently discards the
  // board — it saves the same way "Save Draft" used to, silently, so the
  // arrangement you built is still there in the Gallery Vault later. Only
  // saves when there's actually something to save; a still-empty board just
  // goes home with no new vault entry.
  const handleLogoClick = () => {
    if (viewMode === "workspace") {
      const hasContent = boardSlots.some((s) => s.activeReferenceId);
      if (hasContent) {
        handleSaveAndExit(currentSession);
        return;
      }
      resetCanvasState();
      setCurrentSession(null);
    }
    setViewMode("hub");
  };

  const handleOpenSession = (session) => {
    setCurrentSession(session);
    setBoardSlots(session.canvasState?.boardSlots || []);
    setBoardOrder(session.canvasState?.boardOrder || []);
    setCanvasTitle(session.canvasTitle || "Untitled Canvas");
    setViewMode("workspace");
  };

  const toggleSelectSession = (id) => {
    setSelectedSessionIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id],
    );
  };

  const handleSelectAll = () => {
    // Scoped to what's currently visible — selecting "all" while a search
    // or date filter is active shouldn't reach into hidden cards.
    if (!visibleSessions?.length) return;
    if (selectedSessionIds.length === visibleSessions.length) {
      setSelectedSessionIds([]);
    } else {
      setSelectedSessionIds(visibleSessions.map((s) => s.id));
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedSessionIds.length) return;
    await db.sessions.bulkDelete(selectedSessionIds);
    setSelectedSessionIds([]);
  };

  const handleUpdateSession = async (id, field, value) => {
    const session = await db.sessions.get(id);
    if (session) {
      const updated = { ...session, [field]: value };
      await db.sessions.put(updated);
      if (previewSession && previewSession.id === id) {
        setPreviewSession(updated);
      }
    }
  };

  const openNewDrawingModal = () => setIsNewDrawingModalOpen(true);

  return (
    <div
      data-theme={theme}
      className="flex h-screen flex-col overflow-hidden bg-surface-canvas text-ink-primary transition-colors duration-300"
    >
      {/* Hidden while Focus Lock is on — Home/Finish/theme/profile become
          unreachable until you unlock, same as the board's own controls;
          nothing about saving changes, it's just out of reach meanwhile. */}
      {!(viewMode === "workspace" && isBoardLocked) && (
        <Header
          viewMode={viewMode}
          theme={theme}
          canvasTitle={canvasTitle}
          onTitleChange={setCanvasTitle}
          onToggleTheme={toggleTheme}
          onLogoClick={handleLogoClick}
          onStartDrawing={openNewDrawingModal}
          onFinishDrawing={() => setIsFinishModalOpen(true)}
        />
      )}

      {viewMode === "hub" ? (
        <main className="flex-1 overflow-y-auto">
          {/* Hero Section */}
          <section className="mx-auto flex max-w-3xl flex-col items-center px-6 pt-20 pb-16 text-center sm:pt-28">
            <div className="w-full rounded-panel border border-border bg-surface-raised p-10 shadow-card sm:p-14">
              <h1 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
                Ready to create without the burnout?
              </h1>
              <p className="mt-4 text-base text-ink-secondary sm:text-lg">
                Banish reference hoarding. Pick your folders and protect
                your creative flow state.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button variant="primary" onClick={openNewDrawingModal} className="shadow-card sm:text-base">
                  + Start new drawing
                </Button>
                <Button variant="secondary" onClick={() => setViewMode("library")} className="shadow-card sm:text-base">
                  📁 Add references
                </Button>
              </div>
            </div>
          </section>

          {/* Gallery Vault Section */}
          <section className="mx-auto max-w-6xl px-6 pb-20 text-ink-primary">
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-sm font-bold uppercase tracking-widest text-ink-secondary">
                Your Gallery Vault ({savedSessions?.length || 0})
              </h2>
              <div className="h-px flex-1 bg-border" />
              {savedSessions?.length > 0 && (
                <div className="flex items-center gap-2">
                  {selectedSessionIds.length > 0 && (
                    <button
                      onClick={handleDeleteSelected}
                      className="rounded-control bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-danger/20"
                    >
                      Delete ({selectedSessionIds.length})
                    </button>
                  )}
                  <button
                    onClick={handleSelectAll}
                    className="rounded-control bg-surface-sunken px-3 py-1.5 text-xs font-semibold text-ink-secondary transition-colors hover:bg-surface-raised hover:text-ink-primary"
                  >
                    {selectedSessionIds.length === visibleSessions?.length
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                </div>
              )}
            </div>

            {savedSessions?.length > 0 && (
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={gallerySearch}
                  onChange={(e) => setGallerySearch(e.target.value)}
                  placeholder="Search by title, goal, or notes…"
                  className="min-w-[180px] flex-1 rounded-control border border-border bg-surface-raised px-3 py-1.5 text-sm text-ink-primary placeholder:text-ink-muted outline-none transition-colors focus:border-accent-primary"
                />
                <select
                  value={gallerySortOrder}
                  onChange={(e) => setGallerySortOrder(e.target.value)}
                  className="rounded-control border border-border bg-surface-raised px-2 py-1.5 text-xs text-ink-secondary"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
                <div className="flex items-center gap-1.5 text-xs text-ink-secondary">
                  <label htmlFor="gallery-date-from">From</label>
                  <input
                    id="gallery-date-from"
                    type="date"
                    value={galleryDateFrom}
                    onChange={(e) => setGalleryDateFrom(e.target.value)}
                    className="rounded-control border border-border bg-surface-raised px-2 py-1 text-xs text-ink-secondary"
                  />
                  <label htmlFor="gallery-date-to">To</label>
                  <input
                    id="gallery-date-to"
                    type="date"
                    value={galleryDateTo}
                    onChange={(e) => setGalleryDateTo(e.target.value)}
                    className="rounded-control border border-border bg-surface-raised px-2 py-1 text-xs text-ink-secondary"
                  />
                </div>
                {(gallerySearch || galleryDateFrom || galleryDateTo) && (
                  <button
                    onClick={clearGalleryFilters}
                    className="rounded-control px-3 py-1.5 text-xs font-semibold text-ink-muted underline transition-colors hover:text-ink-primary"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}

            {!savedSessions?.length ? (
              <EmptyTile size="wide" className="gap-3">
                <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                  />
                </svg>
                <p className="text-sm font-medium">
                  No saved sessions yet. Finish a drawing or save & exit to
                  build your vault.
                </p>
              </EmptyTile>
            ) : visibleSessions?.length === 0 ? (
              <EmptyTile size="wide" className="gap-3">
                <p className="text-sm font-medium">
                  No saved drawings match your search or date filter.
                </p>
                <Button variant="primary" onClick={clearGalleryFilters} className="text-xs">
                  Clear filters
                </Button>
              </EmptyTile>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {visibleSessions?.map((session) => {
                  const isSelected = selectedSessionIds.includes(session.id);
                  return (
                    <div
                      key={session.id}
                      onClick={() => handleOpenSession(session)}
                      className={`group cursor-pointer overflow-hidden rounded-panel border shadow-card transition-all hover:scale-[1.02] hover:shadow-2xl ${
                        isSelected
                          ? "border-accent-primary ring-1 ring-accent-primary/50"
                          : "border-border bg-surface-raised"
                      }`}
                    >
                      <div className="relative">
                        {session.image || session.previewImage ? (
                          <img
                            src={session.image || session.previewImage}
                            alt={session.goal}
                            className="h-44 w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-44 w-full items-center justify-center bg-surface-sunken">
                            <svg className="h-10 w-10 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                              />
                            </svg>
                          </div>
                        )}
                        <div className="absolute left-3 top-3 z-10">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleSelectSession(session.id);
                            }}
                            className="h-4 w-4 cursor-pointer accent-accent-primary"
                          />
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100 group-focus-within:bg-black/40 group-focus-within:opacity-100">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewSession(session);
                            }}
                            className="rounded-control bg-white/90 px-3 py-1.5 text-xs font-semibold text-black backdrop-blur-sm transition-colors hover:bg-white"
                          >
                            🔍 Preview Canvas
                          </button>
                        </div>
                      </div>
                      <div className="p-5">
                        <div className="flex items-center justify-between">
                          <span className="max-w-[180px] truncate text-xs font-semibold tracking-wider text-accent-primary">
                            {session.canvasTitle || session.goal}
                          </span>
                          <span className="flex-shrink-0 text-xs text-ink-muted">{session.date}</span>
                        </div>

                        {session.notes && (
                          <p className="mt-2 line-clamp-2 text-sm text-ink-secondary">{session.notes}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      ) : viewMode === "library" ? (
        <ReferenceLibrary
          boardSlots={boardSlots}
          onSlotsChange={setBoardSlots}
        />
      ) : (
        /* Workspace View: the Reference Board */
        <div className="flex-1 overflow-y-auto">
          <ReferenceBoard
            boardSlots={boardSlots}
            boardOrder={boardOrder}
            onSlotsChange={setBoardSlots}
            onBoardOrderChange={setBoardOrder}
            isBoardLocked={isBoardLocked}
            onToggleBoardLocked={setIsBoardLocked}
          />
        </div>
      )}

      {/* New Drawing Setup Modal */}
      {isNewDrawingModalOpen && (
        <NewDrawingModal
          onClose={() => setIsNewDrawingModalOpen(false)}
          onStartDrawing={handleStartDrawing}
        />
      )}

      {/* Finish Drawing Review Modal */}
      {isFinishModalOpen && (
        <FinishModal
          title={canvasTitle}
          session={currentSession}
          onClose={() => setIsFinishModalOpen(false)}
          onSave={handleSaveToVault}
        />
      )}

      {/* Editable Preview Lightbox Modal */}
      {previewSession && (
        <Modal onClose={() => setPreviewSession(null)} maxWidth="3xl" labelledBy="preview-session-title">
          <div className="max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface-overlay px-6 py-4">
              <div className="flex-1">
                <input
                  id="preview-session-title"
                  type="text"
                  value={
                    previewSession.canvasTitle || previewSession.goal || ""
                  }
                  onChange={(e) =>
                    handleUpdateSession(
                      previewSession.id,
                      "canvasTitle",
                      e.target.value,
                    )
                  }
                  className="w-full bg-transparent text-lg font-bold text-ink-primary outline-none"
                  placeholder="Canvas Title"
                />
                <p className="mt-1 text-xs text-ink-muted">{previewSession.date}</p>
              </div>
              <button
                onClick={() => setPreviewSession(null)}
                aria-label="Close"
                title="Close"
                className="ml-4 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-control text-xl text-ink-secondary transition-colors hover:bg-surface-sunken"
              >
                ✕
              </button>
            </div>

            {/* Modal Body - Drawing Snapshot */}
            <div className="p-6">
              <div className="flex items-center justify-center overflow-hidden rounded-panel bg-surface-sunken">
                {previewSession.image ? (
                  <img
                    src={previewSession.image}
                    alt={previewSession.canvasTitle || previewSession.goal}
                    className="max-h-[400px] w-full object-contain"
                  />
                ) : (
                  <div className="flex h-64 w-full flex-col items-center justify-center gap-3">
                    <span className="inline-flex items-center rounded-full bg-surface-overlay px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-ink-secondary shadow-card">
                      In Progress
                    </span>
                  </div>
                )}
              </div>

              {/* Review Notes */}
              <div className="mt-6">
                <label className="mb-2 block text-sm font-semibold text-ink-secondary">Review Notes</label>
                <textarea
                  value={previewSession.notes || ""}
                  onChange={(e) =>
                    handleUpdateSession(
                      previewSession.id,
                      "notes",
                      e.target.value,
                    )
                  }
                  placeholder="Add your review notes here..."
                  rows={4}
                  className="w-full resize-none rounded-panel border border-border bg-surface-sunken px-4 py-3 text-sm text-ink-primary placeholder:text-ink-muted outline-none transition-colors focus:border-accent-primary"
                />
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
