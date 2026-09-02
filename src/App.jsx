import { useCallback, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Header from "./components/Header.jsx";
import TemplateModal from "./components/TemplateModal.jsx";
import FinishModal from "./components/FinishModal.jsx";
import ReferenceBoard from "./components/board/ReferenceBoard.jsx";
import ReferenceLibrary from "./components/library/ReferenceLibrary.jsx";
import { db } from "./db.js";
import { revokeObjectUrl } from "./utils/imageProcessor.js";
import { DEFAULT_TRANSFORM } from "./components/board/constants.js";

const TEMPLATES = [
  {
    id: "cute-cozy",
    name: "Illustration Art",
    description: "Narrative focus, polished visual storytelling",
  },
  {
    id: "dynamic-action",
    name: "Anatomy & Gesture",
    description: "Figure drawing and dynamic poses",
  },
  {
    id: "blank-canvas",
    name: "Blank Canvas",
    description: "Freeform framework",
  },
];

// Each template's starter categories — auto-attached (with an empty slot,
// or pre-filled if the folder already has photos) the moment that template
// is selected for a new drawing. Blank Canvas has no entry: it's the
// freeform option and stays genuinely empty (see handleSelectTemplate).
const TEMPLATE_FOLDER_SETS = {
  "Illustration Art": ["Form", "Pose", "Color", "Vibe"],
  "Anatomy & Gesture": ["Gesture", "Anatomy", "Hands & Feet", "Dynamic Poses"],
};

export default function App() {
  const [viewMode, setViewMode] = useState("hub");
  const [currentSession, setCurrentSession] = useState(null);
  const [selectedSessionIds, setSelectedSessionIds] = useState([]);
  const [previewSession, setPreviewSession] = useState(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    // Persist theme preference across sessions
    const saved = localStorage.getItem("refocus-theme");
    return saved === "light" || saved === "dark" ? saved : "dark";
  });
  const [selectedGoal, setSelectedGoal] = useState("Illustration Art");
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

  const isDark = theme === "dark";

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

  // Makes sure `templateName`'s starter categories exist as real folders,
  // adopting an existing same-named folder (stamping it with this
  // template's tag) rather than creating a duplicate — this is what lets
  // an install's existing Form/Pose/Color/Vibe get picked up as
  // "Illustration Art"'s set the first time it's selected post-update,
  // instead of doubling them. Returns the resolved folder rows, in order.
  const ensureTemplateFolders = async (templateName) => {
    const names = TEMPLATE_FOLDER_SETS[templateName];
    if (!names) return [];
    const existing = await db.folders.toArray();
    const resolved = [];
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const match = existing.find((f) => (f.name || "").toLowerCase() === name.toLowerCase());
      if (match) {
        if (match.templateTag !== templateName || !match.isDefault) {
          await db.folders.update(match.id, { templateTag: templateName, isDefault: true });
        }
        resolved.push(match);
      } else {
        const newId = await db.folders.add({
          name,
          order: existing.length + i,
          createdAt: Date.now(),
          isDefault: true,
          templateTag: templateName,
        });
        resolved.push({ id: newId, name });
      }
    }
    return resolved;
  };

  // A brand-new board's template folders always start attached — pre-
  // filled with whatever's already in their archive instead of an empty
  // "+" slot when they have photos, but attached (with an empty slot) even
  // when they don't, so they can be detached/reattached like any other
  // folder from here on. `isDefault`/`templateTag` only control this
  // initial auto-attach; neither makes a folder permanent afterward.
  const buildInitialBoardSlots = async (templateName) => {
    const templateFolders = await ensureTemplateFolders(templateName);
    const slots = [];
    for (const folder of templateFolders) {
      const latest = await db.references
        .where("folderId")
        .equals(folder.id)
        .last();
      slots.push({
        folderId: folder.id,
        activeReferenceId: latest ? latest.id : null,
        locked: false,
        transform: DEFAULT_TRANSFORM,
      });
    }
    return slots;
  };

  const handleSelectTemplate = async (template) => {
    // A brand-new drawing must never inherit a pointer to whatever session
    // was last saved/opened — without this, saving this drawing later could
    // silently overwrite that unrelated vault entry instead of creating its
    // own.
    setCurrentSession(null);
    setBoardOrder([]);
    // Blank Canvas is the freeform option — it stays genuinely empty rather
    // than pre-filling from the archive like the other templates do.
    const isBlankCanvas = template.name === "Blank Canvas";
    setBoardSlots(isBlankCanvas ? [] : await buildInitialBoardSlots(template.name));
    setSelectedGoal(template.name);

    // Map template selections to default clean title strings
    if (isBlankCanvas) {
      setCanvasTitle("Untitled Canvas");
    } else {
      setCanvasTitle(template.name);
    }

    setIsTemplateModalOpen(false);
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
        goal: selectedGoal,
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
    setSelectedGoal(session.goal);
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

  const openTemplateModal = () => setIsTemplateModalOpen(true);

  return (
    <div
      data-theme={theme}
      className={`h-screen flex flex-col overflow-hidden transition-colors duration-300 ${
        isDark ? "bg-[#1A1A1E] text-slate-100" : "bg-slate-50 text-slate-900"
      }`}
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
          onStartDrawing={openTemplateModal}
          onFinishDrawing={() => setIsFinishModalOpen(true)}
        />
      )}

      {viewMode === "hub" ? (
        <main className="flex-1 overflow-y-auto">
          {/* Hero Section */}
          <section
            className={`mx-auto flex max-w-3xl flex-col items-center px-6 pt-20 pb-16 text-center sm:pt-28 ${
              isDark ? "text-slate-100" : "text-slate-900"
            }`}
          >
            <div
              className={`w-full rounded-2xl p-10 sm:p-14 shadow-xl border ${
                isDark
                  ? "bg-[#242428] border-zinc-800"
                  : "bg-white border-slate-200"
              }`}
            >
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
                Ready to create without the burnout?
              </h1>
              <p
                className={`mt-4 text-base sm:text-lg ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Banish reference hoarding. Pick a template framework and protect
                your creative flow state.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={openTemplateModal}
                  className="rounded-xl bg-[#A8C3A4] px-6 py-3 text-sm font-bold text-black shadow-lg transition-colors hover:bg-[#97b593] sm:text-base"
                >
                  + START NEW DRAWING GOAL
                </button>
                <button
                  onClick={() => setViewMode("library")}
                  className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-900 shadow-lg transition-colors hover:bg-slate-100 sm:text-base"
                >
                  📁 ADD REFERENCES
                </button>
              </div>
            </div>
          </section>

          {/* Gallery Vault Section */}
          <section
            className={`mx-auto max-w-6xl px-6 pb-20 ${
              isDark ? "text-slate-100" : "text-slate-900"
            }`}
          >
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-sm font-bold uppercase tracking-widest">
                Your Gallery Vault ({savedSessions?.length || 0})
              </h2>
              <div className="h-px flex-1 bg-zinc-700/40" />
              {savedSessions?.length > 0 && (
                <div className="flex items-center gap-2">
                  {selectedSessionIds.length > 0 && (
                    <button
                      onClick={handleDeleteSelected}
                      className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-500/20"
                    >
                      Delete ({selectedSessionIds.length})
                    </button>
                  )}
                  <button
                    onClick={handleSelectAll}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      isDark
                        ? "bg-zinc-800 text-slate-300 hover:bg-zinc-700"
                        : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                    }`}
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
                  className={`min-w-[180px] flex-1 rounded-lg border px-3 py-1.5 text-sm outline-none transition-colors focus:border-[#A8C3A4] ${
                    isDark
                      ? "border-zinc-700 bg-[#1F1F23] text-slate-100 placeholder:text-zinc-500"
                      : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
                  }`}
                />
                <select
                  value={gallerySortOrder}
                  onChange={(e) => setGallerySortOrder(e.target.value)}
                  className={`rounded-lg border px-2 py-1.5 text-xs ${
                    isDark ? "border-zinc-700 bg-zinc-800 text-slate-200" : "border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
                <div className={`flex items-center gap-1.5 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  <label htmlFor="gallery-date-from">From</label>
                  <input
                    id="gallery-date-from"
                    type="date"
                    value={galleryDateFrom}
                    onChange={(e) => setGalleryDateFrom(e.target.value)}
                    className={`rounded-lg border px-2 py-1 text-xs ${
                      isDark ? "border-zinc-700 bg-zinc-800 text-slate-200" : "border-slate-300 bg-white text-slate-700"
                    }`}
                  />
                  <label htmlFor="gallery-date-to">To</label>
                  <input
                    id="gallery-date-to"
                    type="date"
                    value={galleryDateTo}
                    onChange={(e) => setGalleryDateTo(e.target.value)}
                    className={`rounded-lg border px-2 py-1 text-xs ${
                      isDark ? "border-zinc-700 bg-zinc-800 text-slate-200" : "border-slate-300 bg-white text-slate-700"
                    }`}
                  />
                </div>
                {(gallerySearch || galleryDateFrom || galleryDateTo) && (
                  <button
                    onClick={clearGalleryFilters}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold underline transition-colors ${
                      isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}

            {!savedSessions?.length ? (
              <div
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-16 text-center ${
                  isDark
                    ? "border-zinc-700 bg-[#1F1F23]"
                    : "border-slate-300 bg-white"
                }`}
              >
                <svg
                  className={`h-12 w-12 ${
                    isDark ? "text-zinc-600" : "text-slate-300"
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                  />
                </svg>
                <p
                  className={`mt-4 text-sm font-medium ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  No saved sessions yet. Finish a drawing or save & exit to
                  build your vault.
                </p>
              </div>
            ) : visibleSessions?.length === 0 ? (
              <div
                className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-16 text-center ${
                  isDark
                    ? "border-zinc-700 bg-[#1F1F23]"
                    : "border-slate-300 bg-white"
                }`}
              >
                <p
                  className={`text-sm font-medium ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  No saved drawings match your search or date filter.
                </p>
                <button
                  onClick={clearGalleryFilters}
                  className="rounded-lg bg-[#A8C3A4] px-3 py-1.5 text-xs font-bold text-black transition-colors hover:bg-[#97b593]"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {visibleSessions?.map((session) => {
                  const isSelected = selectedSessionIds.includes(session.id);
                  return (
                    <div
                      key={session.id}
                      onClick={() => handleOpenSession(session)}
                      className={`group cursor-pointer overflow-hidden rounded-2xl border shadow-md transition-all hover:scale-[1.02] hover:shadow-xl ${
                        isSelected
                          ? "border-emerald-500/80 ring-1 ring-emerald-500/50"
                          : isDark
                            ? "border-zinc-800 bg-[#242428]"
                            : "border-slate-200 bg-white"
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
                          <div
                            className={`flex h-44 w-full items-center justify-center ${
                              isDark ? "bg-[#1F1F23]" : "bg-slate-100"
                            }`}
                          >
                            <svg
                              className={`h-10 w-10 ${
                                isDark ? "text-zinc-600" : "text-slate-300"
                              }`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={1.5}
                            >
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
                            className="h-4 w-4 cursor-pointer accent-emerald-500"
                          />
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100 group-focus-within:bg-black/40 group-focus-within:opacity-100">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewSession(session);
                            }}
                            className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-black backdrop-blur-sm transition-colors hover:bg-white"
                          >
                            🔍 Preview Canvas
                          </button>
                        </div>
                      </div>
                      <div className="p-5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold tracking-wider text-[#A8C3A4] truncate max-w-[180px]">
                            {session.canvasTitle || session.goal}
                          </span>
                          <span
                            className={`text-xs flex-shrink-0 ${
                              isDark ? "text-zinc-500" : "text-slate-400"
                            }`}
                          >
                            {session.date}
                          </span>
                        </div>

                        {session.notes && (
                          <p
                            className={`mt-2 text-sm line-clamp-2 ${
                              isDark ? "text-slate-400" : "text-slate-500"
                            }`}
                          >
                            {session.notes}
                          </p>
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
          isDark={isDark}
          boardSlots={boardSlots}
          onSlotsChange={setBoardSlots}
        />
      ) : (
        /* Workspace View: the Reference Board */
        <div className="flex-1 overflow-y-auto">
          <ReferenceBoard
            isDark={isDark}
            boardSlots={boardSlots}
            boardOrder={boardOrder}
            onSlotsChange={setBoardSlots}
            onBoardOrderChange={setBoardOrder}
            isBoardLocked={isBoardLocked}
            onToggleBoardLocked={setIsBoardLocked}
          />
        </div>
      )}

      {/* Template Selector Modal */}
      {isTemplateModalOpen && (
        <TemplateModal
          isDark={isDark}
          templates={TEMPLATES}
          onClose={() => setIsTemplateModalOpen(false)}
          onSelect={handleSelectTemplate}
        />
      )}

      {/* Finish Drawing Review Modal */}
      {isFinishModalOpen && (
        <FinishModal
          isDark={isDark}
          title={canvasTitle}
          session={currentSession}
          onClose={() => setIsFinishModalOpen(false)}
          onSave={handleSaveToVault}
        />
      )}

      {/* Editable Preview Lightbox Modal */}
      {previewSession && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setPreviewSession(null)}
        >
          <div
            className={`relative mx-4 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl shadow-2xl ${
              isDark ? "bg-[#242428]" : "bg-white"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              className={`sticky top-0 z-10 flex items-center justify-between border-b px-6 py-4 ${
                isDark
                  ? "border-zinc-700 bg-[#242428]"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex-1">
                <input
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
                  className={`w-full bg-transparent text-lg font-bold outline-none ${
                    isDark ? "text-slate-100" : "text-slate-900"
                  }`}
                  placeholder="Canvas Title"
                />
                <p
                  className={`mt-1 text-xs ${
                    isDark ? "text-zinc-500" : "text-slate-400"
                  }`}
                >
                  {previewSession.date}
                </p>
              </div>
              <button
                onClick={() => setPreviewSession(null)}
                className={`ml-4 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xl transition-colors ${
                  isDark
                    ? "text-slate-400 hover:bg-zinc-700"
                    : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                ✕
              </button>
            </div>

            {/* Modal Body - Drawing Snapshot */}
            <div className="p-6">
              <div
                className={`flex items-center justify-center overflow-hidden rounded-xl ${
                  isDark ? "bg-[#1F1F23]" : "bg-slate-100"
                }`}
              >
                {previewSession.image ? (
                  <img
                    src={previewSession.image}
                    alt={previewSession.canvasTitle || previewSession.goal}
                    className="max-h-[400px] w-full object-contain"
                  />
                ) : (
                  <div className="flex h-64 w-full flex-col items-center justify-center gap-3">
                    <span
                      className={`inline-flex items-center rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest ${
                        isDark
                          ? "bg-[#252529] text-slate-300"
                          : "bg-white text-slate-600 shadow-sm"
                      }`}
                    >
                      In Progress
                    </span>
                  </div>
                )}
              </div>

              {/* Review Notes */}
              <div className="mt-6">
                <label
                  className={`mb-2 block text-sm font-semibold ${
                    isDark ? "text-slate-300" : "text-slate-700"
                  }`}
                >
                  Review Notes
                </label>
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
                  className={`w-full resize-none rounded-xl border px-4 py-3 text-sm outline-none transition-colors ${
                    isDark
                      ? "border-zinc-700 bg-[#1F1F23] text-slate-100 placeholder:text-zinc-500 focus:border-[#A8C3A4]"
                      : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-[#A8C3A4]"
                  }`}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
