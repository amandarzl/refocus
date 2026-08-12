import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Header from "./components/Header.jsx";
import TemplateModal from "./components/TemplateModal.jsx";
import FinishModal from "./components/FinishModal.jsx";
import CategoryPopover from "./components/CategoryPopover.jsx";
import UploadModal from "./components/UploadModal.jsx";
import ReferenceImage from "./components/ReferenceImage.jsx";
import { db } from "./db.js";
import { revokeObjectUrl } from "./utils/imageProcessor.js";
import { exportAco } from "./utils/exportAco.js";

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
  const [theme, setTheme] = useState(() => {
    // Persist theme preference across sessions
    const saved = localStorage.getItem("refocus-theme");
    return saved === "light" || saved === "dark" ? saved : "dark";
  });
  const [selectedGoal, setSelectedGoal] = useState("Cute & Cozy");
  const [canvasTitle, setCanvasTitle] = useState("Untitled Canvas");
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const savedSessions = useLiveQuery(
    () => db.sessions.orderBy("id").reverse().toArray(),
    [],
  );

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
  const [referenceToolMenuOpen, setReferenceToolMenuOpen] = useState(false);
  const [isReferenceToolCropMode, setIsReferenceToolCropMode] = useState(false);
  const [referenceCropRect, setReferenceCropRect] = useState(null);
  const canvasRef = useRef(null);
  const cropDragRef = useRef(null);

  const isDark = theme === "dark";

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

  // Close toolbar menu when image is deselected
  useEffect(() => {
    if (!selectedImageId) {
      setReferenceToolMenuOpen(false);
    }
  }, [selectedImageId]);

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
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("refocus-theme", next);
      return next;
    });
  };

  const resetCanvasState = useCallback(() => {
    // Revoke blob URLs before clearing state to prevent memory leaks
    referenceGroups.forEach((g) => {
      g.images.forEach((img) => {
        if (img.src && img.src.startsWith("blob:")) {
          revokeObjectUrl(img.src);
        }
      });
    });

    setReferenceGroups(DEFAULT_GROUPS.map((g) => ({ ...g, images: [] })));
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setSelectedImageId(null);
    setUploadTargetGroup(null);
    setIsCategoryPopoverOpen(false);
  }, [referenceGroups]);

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

    // Convert blob URLs to base64 for Dexie persistence
    if (sessionData.image && sessionData.image.startsWith("blob:")) {
      sessionData.image = await blobUrlToBase64(sessionData.image);
    }

    // Convert reference group images from blob URLs to base64 so they persist across sessions
    const base64ReferenceGroups = await Promise.all(
      referenceGroups.map(async (g) => ({
        ...g,
        images: await Promise.all(
          g.images.map(async (img) => {
            if (img.src?.startsWith("blob:")) {
              return { ...img, src: await blobUrlToBase64(img.src) };
            }
            return img;
          }),
        ),
      })),
    );

    const fullSession = {
      ...sessionData,
      canvasTitle,
      canvasState: {
        referenceGroups: base64ReferenceGroups,
        pan,
        zoom,
      },
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

    // Revoke all blob URLs after successful save
    referenceGroups.forEach((g) => {
      g.images.forEach((img) => {
        if (img.src?.startsWith("blob:")) {
          revokeObjectUrl(img.src);
        }
      });
    });
    if (session.image?.startsWith("blob:")) {
      revokeObjectUrl(session.image);
    }

    setIsFinishModalOpen(false);
    setCurrentSession(null);
    setViewMode("hub");
  };

  const handleSaveAndExit = async (sessionData) => {
    // Extract all active photos from referenceGroups
    const allImages = referenceGroups.flatMap((g) => g.images);

    // Read the latest canvasTitle workspace state
    // Determine previewImage: use existing previewImage or fallback to first image src
    let previewImage = sessionData?.previewImage || allImages[0]?.src || null;

    // Convert blob URLs to base64 for persistence
    if (previewImage && previewImage.startsWith("blob:")) {
      previewImage = await blobUrlToBase64(previewImage);
    }

    // Convert reference group images from blob URLs to base64 so they persist across sessions
    const base64ReferenceGroups = await Promise.all(
      referenceGroups.map(async (g) => ({
        ...g,
        images: await Promise.all(
          g.images.map(async (img) => {
            if (img.src?.startsWith("blob:")) {
              return { ...img, src: await blobUrlToBase64(img.src) };
            }
            return img;
          }),
        ),
      })),
    );

    const sessionPayload = {
      ...(sessionData || {}),
      canvasTitle,
      previewImage,
      canvasState: {
        referenceGroups: base64ReferenceGroups,
        pan,
        zoom,
      },
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

    // Revoke all blob URLs after successful save
    referenceGroups.forEach((g) => {
      g.images.forEach((img) => {
        if (img.src?.startsWith("blob:")) {
          revokeObjectUrl(img.src);
        }
      });
    });

    setViewMode("hub");
    resetCanvasState();
  };

  const handleOpenSession = (session) => {
    // Revoke old blob URLs before switching sessions
    referenceGroups.forEach((g) => {
      g.images.forEach((img) => {
        if (img.src?.startsWith("blob:")) {
          revokeObjectUrl(img.src);
        }
      });
    });

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
    if (!savedSessions) return;
    if (selectedSessionIds.length === savedSessions.length) {
      setSelectedSessionIds([]);
    } else {
      setSelectedSessionIds(savedSessions.map((s) => s.id));
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
        const toAdd = newImages.slice(0, room).map((img) => {
          // Set sensible default display size (max 260px width) while preserving
          // the high-res original data in the blob for crisp zooming
          const maxDisplayWidth = 260;
          const originalWidth = img.width ?? 220;
          const originalHeight = img.height ?? 220;
          const aspectRatio = originalHeight / originalWidth;
          const displayWidth = Math.min(originalWidth, maxDisplayWidth);
          const displayHeight = displayWidth * aspectRatio;

          return {
            id: `${groupId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            src: img.src,
            width: displayWidth,
            height: displayHeight,
            palette: img.palette ?? [],
            x: Math.random() * Math.max(0, canvasSize.width - displayWidth),
            y: Math.random() * Math.max(0, canvasSize.height - displayHeight),
            rotation: 0,
            mirrored: false,
            grayscale: false,
            crop: null,
          };
        });
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
    // Revoke blob URL before removing from state
    const imageToRemove = referenceGroups
      .flatMap((g) => g.images)
      .find((img) => img.id === id);
    if (imageToRemove?.src?.startsWith("blob:")) {
      revokeObjectUrl(imageToRemove.src);
    }

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

  // --- Reference Toolbar Handlers ---
  const selectedImage = allImages.find((img) => img.id === selectedImageId);

  const handleReferenceToolAction = (patch) => {
    if (!selectedImageId) return;
    handleUpdateImage(selectedImageId, patch);
  };

  const handleReferenceToggleMirror = () => {
    if (!selectedImage) return;
    handleReferenceToolAction({ mirrored: !selectedImage.mirrored });
    setReferenceToolMenuOpen(false);
  };

  const handleReferenceToggleGray = () => {
    if (!selectedImage) return;
    handleReferenceToolAction({ grayscale: !selectedImage.grayscale });
    setReferenceToolMenuOpen(false);
  };

  const handleReferenceRotate = () => {
    if (!selectedImage) return;
    handleReferenceToolAction({
      rotation: ((selectedImage.rotation || 0) + 90) % 360,
    });
    setReferenceToolMenuOpen(false);
  };

  const handleReferenceRevert = () => {
    if (!selectedImage) return;
    handleReferenceToolAction({
      rotation: 0,
      mirrored: false,
      grayscale: false,
      crop: null,
    });
    setReferenceToolMenuOpen(false);
    setReferenceCropRect(null);
  };

  const handleReferenceStartCrop = () => {
    if (!selectedImage) return;
    setIsReferenceToolCropMode(true);
    setReferenceToolMenuOpen(false);
    setReferenceCropRect(
      selectedImage.crop ?? { left: 0.1, top: 0.1, right: 0.9, bottom: 0.9 },
    );
  };

  const applyReferenceCrop = () => {
    if (!selectedImageId || !referenceCropRect) return;
    handleUpdateImage(selectedImageId, { crop: referenceCropRect });
    setIsReferenceToolCropMode(false);
  };

  const cancelReferenceCrop = () => {
    setReferenceCropRect(null);
    setIsReferenceToolCropMode(false);
  };

  const handleReferenceCropPointerDown = (e, handle) => {
    e.stopPropagation();
    const img = selectedImage;
    if (!img) return;
    const rect = e.currentTarget.getBoundingClientRect();
    cropDragRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      rect,
      initial: { ...referenceCropRect },
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleReferenceCropPointerMove = (e) => {
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
      if (drag.handle.includes("left"))
        next.left = Math.max(0, Math.min(init.right - min, init.left + dx));
      if (drag.handle.includes("right"))
        next.right = Math.min(1, Math.max(init.left + min, init.right + dx));
      if (drag.handle.includes("top"))
        next.top = Math.max(0, Math.min(init.bottom - min, init.top + dy));
      if (drag.handle.includes("bottom"))
        next.bottom = Math.min(1, Math.max(init.top + min, init.bottom + dy));
    }
    setReferenceCropRect(next);
  };

  const handleReferenceCropPointerUp = () => {
    cropDragRef.current = null;
  };

  const copyReferenceImage = async () => {
    if (!selectedImage) return;
    setReferenceToolMenuOpen(false);
    try {
      // Try modern Clipboard API first
      const response = await fetch(selectedImage.src);
      const blob = await response.blob();

      try {
        const item = new ClipboardItem({ [blob.type]: blob });
        await navigator.clipboard.write([item]);
        showToast("Copied!");
      } catch {
        // Fallback: copy the image URL/link
        await navigator.clipboard.writeText(selectedImage.src);
        showToast("Link copied!");
      }
    } catch (error) {
      console.error("Failed to copy image:", error);
      showToast("Failed to copy");
    }
  };

  const exportReferenceImage = async () => {
    if (!selectedImage) return;
    setReferenceToolMenuOpen(false);
    const img = selectedImage;
    const exportDataUrl = img.src;
    const a = document.createElement("a");
    a.href = exportDataUrl;
    a.download = `reference-${img.id}.png`;
    a.click();
  };

  const exportReferencePalette = () => {
    if (!selectedImage || !selectedImage.palette) return;
    setReferenceToolMenuOpen(false);
    try {
      exportAco(selectedImage.palette, `palette-${selectedImage.id}.aco`);
    } catch {
      // Silent fail - no popup
    }
  };

  const toolbarBtn =
    "flex h-8 w-8 items-center justify-center rounded-lg transition-colors " +
    (isDark
      ? "text-slate-300 hover:bg-zinc-700"
      : "text-slate-600 hover:bg-slate-200");

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
        onSaveExit={() => handleSaveAndExit(currentSession)}
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
                Your Gallery Vault ({savedSessions?.length || 0})
              </h2>
              <div className="h-px flex-1 bg-zinc-700/40" />
              {savedSessions?.length > 0 && (
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
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {savedSessions?.map((session) => {
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
                  isCropMode={
                    isReferenceToolCropMode && selectedImageId === img.id
                  }
                  cropRect={
                    selectedImageId === img.id ? referenceCropRect : null
                  }
                  onCropChange={handleReferenceCropPointerMove}
                  onApplyCrop={applyReferenceCrop}
                  onCancelCrop={cancelReferenceCrop}
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

            {/* Reference Image Toolbar (bottom-center, only when image selected) */}
            {selectedImageId && !isReferenceToolCropMode && (
              <div
                className={`absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-xl border px-2 py-1 shadow-2xl ${
                  isDark
                    ? "border-zinc-700 bg-[#242428]"
                    : "border-slate-200 bg-white"
                }`}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  className={toolbarBtn}
                  title="Crop"
                  onClick={handleReferenceStartCrop}
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 2v14a2 2 0 002 2h14M2 6h14a2 2 0 012 2v14"
                    />
                  </svg>
                </button>
                <button
                  className={toolbarBtn}
                  title="Mirror"
                  onClick={handleReferenceToggleMirror}
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 3v18M8 7l-4 4 4 4M16 7l4 4-4 4"
                    />
                  </svg>
                </button>
                <button
                  className={toolbarBtn}
                  title={selectedImage?.grayscale ? "Ungray" : "Gray"}
                  onClick={handleReferenceToggleGray}
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path strokeLinecap="round" d="M12 3a9 9 0 010 18" />
                  </svg>
                </button>
                <button
                  className={toolbarBtn}
                  title="Rotate"
                  onClick={handleReferenceRotate}
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 4v5h5M20 20v-5h-5M4 9a8 8 0 0114-3M20 15a8 8 0 01-14 3"
                    />
                  </svg>
                </button>
                <button
                  className={toolbarBtn}
                  title="Revert"
                  onClick={handleReferenceRevert}
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 10h10a5 5 0 015 5v0a5 5 0 01-5 5H8M3 10l4-4M3 10l4 4"
                    />
                  </svg>
                </button>

                {/* ⋯ menu */}
                <div className="relative">
                  <button
                    className={toolbarBtn}
                    title="More options"
                    onClick={() => setReferenceToolMenuOpen((v) => !v)}
                  >
                    <svg
                      className="h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <circle cx="5" cy="12" r="1.5" />
                      <circle cx="12" cy="12" r="1.5" />
                      <circle cx="19" cy="12" r="1.5" />
                    </svg>
                  </button>
                  {referenceToolMenuOpen && (
                    <div
                      className={`absolute right-0 bottom-full mb-2 z-50 w-40 overflow-hidden rounded-xl border shadow-2xl ${
                        isDark
                          ? "border-zinc-700 bg-[#242428]"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <button
                        onClick={() => {
                          setReferenceToolMenuOpen(false);
                          handleRemoveImage(selectedImageId);
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                          isDark
                            ? "text-slate-200 hover:bg-zinc-800"
                            : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <svg
                          className="h-4 w-4 text-[#E5989B]"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                        Delete
                      </button>
                      <button
                        onClick={copyReferenceImage}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                          isDark
                            ? "text-slate-200 hover:bg-zinc-800"
                            : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        Copy
                      </button>
                      <button
                        onClick={exportReferenceImage}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                          isDark
                            ? "text-slate-200 hover:bg-zinc-800"
                            : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
                          />
                        </svg>
                        Export
                      </button>
                      {selectedImage?.palette &&
                        selectedImage.palette.length > 0 && (
                          <button
                            onClick={exportReferencePalette}
                            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                              isDark
                                ? "text-slate-200 hover:bg-zinc-800"
                                : "text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M4.098 19.902a3.75 3.75 0 005.304 0l3.75-3.75a3.75 3.75 0 00-5.304-5.304l-1.5 1.5m9-9l3.75-3.75a3.75 3.75 0 00-5.304-5.304l-1.5 1.5m0 0l3.75 3.75m-3.75-3.75l3.75 3.75"
                              />
                            </svg>
                            Export Palette (.aco)
                          </button>
                        )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Crop action bar */}
            {isReferenceToolCropMode && selectedImageId && (
              <div
                className="absolute bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-xl border px-3 py-1.5 shadow-2xl"
                style={{
                  background: isDark ? "#242428" : "#fff",
                  borderColor: isDark ? "#3f3f46" : "#e2e8f0",
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  onClick={applyReferenceCrop}
                  className="rounded-lg bg-[#A8C3A4] px-3 py-1 text-xs font-bold text-black transition-colors hover:bg-[#97b593]"
                >
                  Apply
                </button>
                <button
                  onClick={cancelReferenceCrop}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                    isDark
                      ? "text-slate-300 hover:bg-zinc-700"
                      : "text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Floating Action Button — toggles category popover */}
            <button
              onClick={() => setIsCategoryPopoverOpen((prev) => !prev)}
              title="Add category photos"
              className={`absolute bottom-6 left-8 z-20 flex h-16 w-16 items-center justify-center rounded-full text-3xl font-bold text-black shadow-xl transition-all hover:scale-105 hover:bg-[#97b593] ${
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
          session={currentSession}
          onClose={() => setIsFinishModalOpen(false)}
          onSave={handleSaveToVault}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2">
          <div className="rounded-xl border border-slate-300 bg-white px-4 py-3 shadow-lg backdrop-blur-md">
            <span className="text-sm font-medium text-slate-900">
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
