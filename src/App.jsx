import { useCallback, useEffect, useRef, useState } from "react";
import Header from "./components/Header.jsx";
import TemplateModal from "./components/TemplateModal.jsx";
import FinishModal from "./components/FinishModal.jsx";
import CategoryPopover from "./components/CategoryPopover.jsx";
import UploadModal from "./components/UploadModal.jsx";
import ReferenceImage from "./components/ReferenceImage.jsx";

const MAX_IMAGES = 3;

const DEFAULT_GROUPS = [
  { id: 1, title: "Reference 1", subtitle: "Form" },
  { id: 2, title: "Reference 2", subtitle: "Pose" },
  { id: 3, title: "Reference 3", subtitle: "Color" },
  { id: 4, title: "Reference 4", subtitle: "Vibe" },
];

const TEMPLATES = [
  {
    id: "cute-cozy",
    name: "Cute & Cozy",
    description: "Soft proportions, pastel tones",
  },
  {
    id: "dynamic-action",
    name: "Dynamic Action",
    description: "High energy perspectives",
  },
  {
    id: "blank-canvas",
    name: "Blank Canvas",
    description: "Freeform framework",
  },
];

export default function App() {
  const [viewMode, setViewMode] = useState("hub");
  const [currentSession, setCurrentSession] = useState(null);
  const [selectedSessionIds, setSelectedSessionIds] = useState([]);
  const [previewSession, setPreviewSession] = useState(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [theme, setTheme] = useState("dark"); // 'dark' or 'light'
  const [selectedGoal, setSelectedGoal] = useState("Cute & Cozy");
  const [canvasTitle, setCanvasTitle] = useState("Untitled Canvas");
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [savedSessions, setSavedSessions] = useState(() => {
    try {
      const stored = localStorage.getItem("refocus_sessions");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Reference box state shared between sidebar, category popover & upload modal
  const [referenceGroups, setReferenceGroups] = useState(() =>
    DEFAULT_GROUPS.map((g) => ({ ...g, images: [] })),
  );
  const [isCategoryPopoverOpen, setIsCategoryPopoverOpen] = useState(false);
  const [uploadTargetGroup, setUploadTargetGroup] = useState(null);
  const [rejectedGroupId, setRejectedGroupId] = useState(null);
  const [toast, setToast] = useState(null);
  const [selectedImageId, setSelectedImageId] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const canvasRef = useRef(null);

  const isDark = theme === "dark";

  // Persist saved sessions to localStorage
  useEffect(() => {
    localStorage.setItem("refocus_sessions", JSON.stringify(savedSessions));
  }, [savedSessions]);

  // Measure canvas size when entering the workspace so images scatter correctly
  useEffect(() => {
    if (viewMode !== "workspace") return;
    const el = canvasRef.current;
    if (!el) return;
    const measure = () =>
      setCanvasSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [viewMode]);

  const clampZoom = (z) => Math.max(0.25, Math.min(3, z));

  // Reset zoom with Ctrl+0 and track Spacebar for Hand Tool
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.ctrlKey && e.key === "0") {
        e.preventDefault();
        setZoom(1);
      }
      if (e.code === "Space" && !e.repeat) {
        if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName))
          return;
        setIsSpacePressed(true);
      }
    };
    const onKeyUp = (e) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Zoom anchored at the cursor position (Ctrl+scroll / trackpad pinch)
  // or Pan (standard scroll)
  const handleCanvasWheel = useCallback(
    (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        const nextZoom = clampZoom(zoom * factor);
        if (nextZoom === zoom) return;

        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        // Keep the point under the cursor stationary while zooming
        const ratio = nextZoom / zoom;
        setPan((prev) => ({
          x: cursorX - (cursorX - prev.x) * ratio,
          y: cursorY - (cursorY - prev.y) * ratio,
        }));
        setZoom(nextZoom);
      } else {
        // Standard two-finger scroll / wheel = Pan
        setPan((prev) => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }));
      }
    },
    [zoom],
  );

  const handlePointerDown = (e) => {
    // Middle click (1) or Space + Left click (0) starts panning
    if (e.button === 1 || (e.button === 0 && isSpacePressed)) {
      setIsPanning(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      // Prevent middle-click auto-scroll
      if (e.button === 1) e.preventDefault();
    } else if (e.button === 0) {
      // Left click (without space) just deselects
      setSelectedImageId(null);
    }
  };

  const handlePointerMove = (e) => {
    if (isPanning) {
      setPan((prev) => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY,
      }));
    }
  };

  const handlePointerUp = (e) => {
    if (isPanning) {
      setIsPanning(false);
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  // Attach wheel zoom as a native non-passive listener so preventDefault
  // actually blocks the browser's page zoom (nav + buttons stay fixed)
  useEffect(() => {
    if (viewMode !== "workspace") return;
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleCanvasWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleCanvasWheel);
  }, [viewMode, handleCanvasWheel]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const resetCanvasState = useCallback(() => {
    setReferenceGroups(DEFAULT_GROUPS.map((g) => ({ ...g, images: [] })));
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setSelectedImageId(null);
    setUploadTargetGroup(null);
    setIsCategoryPopoverOpen(false);
  }, []);

  const handleSelectTemplate = (template) => {
    resetCanvasState();
    setSelectedGoal(template.name);

    // Map template selections to default clean title strings
    if (template.name === "Blank Canvas") {
      setCanvasTitle("Untitled Canvas");
    } else {
      setCanvasTitle(template.name);
    }

    setIsTemplateModalOpen(false);
    setViewMode("workspace");
  };

  const handleSaveToVault = (session) => {
    // Capture current workspace state for re-entry
    const fullSession = {
      ...session,
      canvasTitle,
      canvasState: {
        referenceGroups,
        pan,
        zoom,
      },
    };
    setSavedSessions((prev) => [fullSession, ...prev]);
    setIsFinishModalOpen(false);
    setCurrentSession(null);
    setViewMode("hub");
  };

  const handleSaveAndExit = (sessionData) => {
    // Extract all active photos from referenceGroups
    const allImages = referenceGroups.flatMap((g) => g.images);

    // Read the latest canvasTitle workspace state
    // Determine previewImage: use existing previewImage or fallback to first image src
    const previewImage = sessionData.previewImage || allImages[0]?.src || null;

    const updatedSession = {
      ...sessionData,
      canvasTitle,
      previewImage,
      canvasState: {
        referenceGroups,
        pan,
        zoom,
      },
    };

    // Update savedSessions by matching session ID
    setSavedSessions((prev) =>
      prev.map((s) => (s.id === sessionData.id ? updatedSession : s)),
    );
    setCurrentSession(null);
    setViewMode("hub");
    resetCanvasState();
  };

  const handleOpenSession = (session) => {
    setCurrentSession(session);
    if (session.canvasState) {
      setReferenceGroups(session.canvasState.referenceGroups);
      setPan(session.canvasState.pan);
      setZoom(session.canvasState.zoom);
    }
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
    if (selectedSessionIds.length === savedSessions.length) {
      setSelectedSessionIds([]);
    } else {
      setSelectedSessionIds(savedSessions.map((s) => s.id));
    }
  };

  const handleDeleteSelected = () => {
    setSavedSessions((prev) =>
      prev.filter((s) => !selectedSessionIds.includes(s.id)),
    );
    setSelectedSessionIds([]);
  };

  const handleUpdateSession = (id, field, value) => {
    setSavedSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    );
    if (previewSession && previewSession.id === id) {
      setPreviewSession((prev) => ({ ...prev, [field]: value }));
    }
  };

  const openTemplateModal = () => setIsTemplateModalOpen(true);

  const showToast = (message) => {
    setToast({ id: Date.now(), message });
    setTimeout(() => setToast(null), 3000);
  };

  // Coral shake guardrail: highlight card border + shake + toast, no uploader
  const handleReject = (groupId) => {
    setRejectedGroupId(groupId);
    showToast("Category full! Remove an image to swap.");
    setTimeout(() => setRejectedGroupId(null), 500);
  };

  const handleAddImages = (groupId, newImages) => {
    setReferenceGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const existing = g.images;
        const room = MAX_IMAGES - existing.length;
        const toAdd = newImages.slice(0, room).map((src) => ({
          id: `${groupId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          src,
          x: Math.random() * Math.max(0, canvasSize.width - 220),
          y: Math.random() * Math.max(0, canvasSize.height - 220),
          width: 220,
          rotation: 0,
          mirrored: false,
          grayscale: false,
          crop: null,
        }));
        return { ...g, images: [...existing, ...toAdd] };
      }),
    );
  };

  const handleUpdateImage = (id, patch) => {
    setReferenceGroups((prev) =>
      prev.map((g) => ({
        ...g,
        images: g.images.map((img) =>
          img.id === id ? { ...img, ...patch } : img,
        ),
      })),
    );
  };

  const handleRemoveImage = (id) => {
    setReferenceGroups((prev) =>
      prev.map((g) => ({
        ...g,
        images: g.images.filter((img) => img.id !== id),
      })),
    );
    if (selectedImageId === id) setSelectedImageId(null);
  };

  // Clicking a category in the popover
  const handlePopoverSelect = (group) => {
    const target = referenceGroups.find((g) => g.id === group.id) ?? group;

    if (target.images.length >= MAX_IMAGES) {
      // Full: keep popover open, highlight + shake that card, show toast
      handleReject(target.id);
      return;
    }

    // Available: close menu, open uploader targeting this box
    setIsCategoryPopoverOpen(false);
    setUploadTargetGroup(target);
  };

  // Flatten all images across groups for canvas rendering
  const allImages = referenceGroups.flatMap((g) => g.images);

  const zoomIn = () => setZoom((z) => clampZoom(z * 1.25));
  const zoomOut = () => setZoom((z) => clampZoom(z / 1.25));
  const resetZoom = () => setZoom(1);

  const gridPatternStyle = isDark
    ? {
        backgroundImage:
          "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }
    : {
        backgroundImage:
          "radial-gradient(circle, rgba(0,0,0,0.07) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      };

  return (
    <div
      data-theme={theme}
      className={`h-screen flex flex-col overflow-hidden transition-colors duration-300 ${
        isDark ? "bg-[#1A1A1E] text-slate-100" : "bg-slate-50 text-slate-900"
      }`}
    >
      <Header
        viewMode={viewMode}
        theme={theme}
        canvasTitle={canvasTitle}
        onTitleChange={setCanvasTitle}
        onToggleTheme={toggleTheme}
        onLogoClick={() => setViewMode("hub")}
        onStartDrawing={openTemplateModal}
        onSaveExit={
          currentSession
            ? () => handleSaveAndExit(currentSession)
            : () => setViewMode("hub")
        }
        onFinishDrawing={() => setIsFinishModalOpen(true)}
      />

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
              <button
                onClick={openTemplateModal}
                className="mt-8 rounded-xl bg-[#A8C3A4] px-6 py-3 text-sm font-bold text-black shadow-lg transition-colors hover:bg-[#97b593] sm:text-base"
              >
                + START NEW DRAWING GOAL
              </button>
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
                Your Gallery Vault ({savedSessions.length})
              </h2>
              <div className="h-px flex-1 bg-zinc-700/40" />
              {savedSessions.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSelectAll}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      isDark
                        ? "bg-zinc-800 text-slate-300 hover:bg-zinc-700"
                        : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                    }`}
                  >
                    {selectedSessionIds.length === savedSessions.length
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                  {selectedSessionIds.length > 0 && (
                    <button
                      onClick={handleDeleteSelected}
                      className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-500/20"
                    >
                      Delete ({selectedSessionIds.length})
                    </button>
                  )}
                </div>
              )}
            </div>

            {savedSessions.length === 0 ? (
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
                  No saved sessions yet. Finish a drawing to build your vault.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {savedSessions.map((session) => {
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
                        {session.image ? (
                          <img
                            src={session.image}
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
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
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
      ) : (
        /* Workspace View */
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Main Drawing Canvas */}
          <div
            ref={canvasRef}
            className={`relative flex-1 overflow-hidden ${
              isDark ? "bg-[#121215]" : "bg-slate-100"
            }`}
            style={{
              cursor: isPanning
                ? "grabbing"
                : isSpacePressed
                  ? "grab"
                  : "default",
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <div
              className="absolute inset-0"
              style={gridPatternStyle}
              aria-hidden="true"
            />

            {/* Canvas content area */}
            {allImages.length === 0 && (
              <div className="relative z-10 flex h-full flex-col items-center justify-center px-8">
                <div className="text-center">
                  <span
                    className={`inline-block rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest ${
                      isDark
                        ? "bg-[#252529] text-slate-300"
                        : "bg-white text-slate-600 shadow-sm"
                    }`}
                  >
                    Drawing Goal: {selectedGoal}
                  </span>
                  <h2
                    className={`mt-6 text-2xl font-bold ${
                      isDark ? "text-slate-300" : "text-slate-500"
                    }`}
                  >
                    Your reference board is ready
                  </h2>
                  <p
                    className={`mt-2 text-sm ${
                      isDark ? "text-zinc-600" : "text-slate-400"
                    }`}
                  >
                    Tap the + button to add reference images. Click an image to
                    edit — drag to move, then use the toolbar to crop, mirror,
                    add grayscale, rotate, or export.
                  </p>
                </div>
              </div>
            )}

            {/* Zoomable reference board */}
            <div
              className="absolute inset-0"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "0 0",
              }}
            >
              {allImages.map((img) => (
                <ReferenceImage
                  key={img.id}
                  image={img}
                  isDark={isDark}
                  zoom={zoom}
                  isSelected={selectedImageId === img.id}
                  onSelect={() => setSelectedImageId(img.id)}
                  onUpdate={handleUpdateImage}
                  onRemove={handleRemoveImage}
                />
              ))}
            </div>

            {/* Zoom controls */}
            <div
              className={`absolute bottom-6 right-6 z-20 flex items-center gap-1 rounded-xl border px-2 py-1.5 shadow-xl ${
                isDark
                  ? "border-zinc-700 bg-[#242428]"
                  : "border-slate-200 bg-white"
              }`}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                onClick={zoomOut}
                title="Zoom out"
                className={`flex h-7 w-7 items-center justify-center rounded-lg text-lg font-bold transition-colors ${
                  isDark
                    ? "text-slate-300 hover:bg-zinc-700"
                    : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                −
              </button>
              <button
                onClick={resetZoom}
                title="Reset zoom (Ctrl+0)"
                className={`min-w-[52px] rounded-lg px-1 py-0.5 text-xs font-semibold transition-colors ${
                  isDark
                    ? "text-slate-300 hover:bg-zinc-700"
                    : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={zoomIn}
                title="Zoom in"
                className={`flex h-7 w-7 items-center justify-center rounded-lg text-lg font-bold transition-colors ${
                  isDark
                    ? "text-slate-300 hover:bg-zinc-700"
                    : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                +
              </button>
            </div>

            {/* Floating Action Button — toggles category popover */}
            <button
              onClick={() => setIsCategoryPopoverOpen((prev) => !prev)}
              title="Add category photos"
              className={`absolute bottom-6 left-6 z-20 flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold text-black shadow-xl transition-all hover:scale-105 hover:bg-[#97b593] ${
                isCategoryPopoverOpen
                  ? "bg-[#97b593] rotate-45"
                  : "bg-[#A8C3A4]"
              }`}
            >
              +
            </button>

            {/* Category Selector Popover */}
            {isCategoryPopoverOpen && (
              <CategoryPopover
                groups={referenceGroups}
                isDark={isDark}
                rejectedGroupId={rejectedGroupId}
                onSelect={handlePopoverSelect}
                onClose={() => setIsCategoryPopoverOpen(false)}
              />
            )}

            {/* Photo Upload / Paste Popover */}
            {uploadTargetGroup && (
              <UploadModal
                group={uploadTargetGroup}
                isDark={isDark}
                onAddImages={handleAddImages}
                onReject={handleReject}
                onClose={() => setUploadTargetGroup(null)}
              />
            )}
          </div>
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
          onClose={() => setIsFinishModalOpen(false)}
          onSave={handleSaveToVault}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-xl border border-[#E5989B] bg-[#E5989B]/10 px-4 py-3 shadow-lg backdrop-blur-md">
            <svg
              className="h-5 w-5 flex-shrink-0 text-[#E5989B]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span
              className={`text-sm font-medium ${
                isDark ? "text-slate-200" : "text-slate-800"
              }`}
            >
              {toast.message}
            </span>
          </div>
        </div>
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
                isDark ? "border-zinc-700" : "border-slate-200"
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
                {previewSession.previewImage ||
                previewSession.images?.[0]?.url ||
                previewSession.image ? (
                  <img
                    src={
                      previewSession.previewImage ||
                      previewSession.images?.[0]?.url ||
                      previewSession.image
                    }
                    alt={previewSession.canvasTitle || previewSession.goal}
                    className="max-h-[400px] w-full object-contain"
                  />
                ) : (
                  <div className="flex h-64 w-full items-center justify-center">
                    <svg
                      className={`h-16 w-16 ${
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
