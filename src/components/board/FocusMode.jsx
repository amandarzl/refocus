import { useEffect, useRef, useState } from "react";
import TagEditor from "./TagEditor";
import Popover from "../ui/Popover.jsx";
import { getTransformStyle, getClipStyle } from "./constants.js";

const SWIPE_THRESHOLD = 50; // px
const CROP_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

// One-card-at-a-time browser for a folder's full image library. Used from
// a board slot to manually override Shuffle's random pick — paging never
// hits a hard cap here (that's the old Practice Mode's job, superseded by
// Shuffle + Lock), it just clamps at the folder's ends.
//
// When viewing the folder's *active* image, this also carries the
// non-destructive edit toolbar (crop/mirror/gray/rotate/undo) ported from
// the old free-form canvas, plus a Copy/Export/Generate Palette menu
// available for any image being browsed.
export default function FocusMode({
  images,
  index,
  activeId,
  transform,
  onIndexChange,
  onPick,
  onExit,
  onAddTag,
  onRemoveTag,
  onToggleMirror,
  onToggleGray,
  onRotate,
  onRevert,
  onClearSlot,
  onGeneratePalette,
  isCropMode,
  cropRect,
  onStartCrop,
  onApplyCrop,
  onCancelCrop,
  onCropPointerDown,
  onCropPointerMove,
  onCropPointerUp,
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  // A rule-of-thirds overlay for checking composition/proportions while
  // drawing — purely a view aid, not part of the transform pipeline (see
  // onToggleMirror/onToggleGray/onRotate below), so it's local state here
  // rather than something persisted per-image or lifted to ReferenceBoard.
  // Left on across images on purpose (unlike zoom, which resets per image
  // below) since comparing proportions across several references in a row
  // is a real use case.
  const [showGrid, setShowGrid] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copiedHex, setCopiedHex] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const dragRef = useRef(null);
  const panDragRef = useRef(null);
  const cropOverlayRef = useRef(null);

  const current = images[index];
  const isCurrentActive = current?.id === activeId;

  useEffect(() => {
    setMenuOpen(false);
  }, [index]);

  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Zoom/pan is a browsing aid only — reset per image (a fresh look starts
  // unzoomed) and whenever crop mode opens, since crop coordinates assume
  // the image is shown at its natural, unzoomed size.
  useEffect(() => {
    resetZoom();
  }, [index]);

  useEffect(() => {
    if (isCropMode) resetZoom();
  }, [isCropMode]);

  const goPrev = () => onIndexChange(Math.max(0, index - 1));
  const goNext = () => onIndexChange(Math.min(images.length - 1, index + 1));

  // Keyboard nav
  useEffect(() => {
    const onKeyDown = (e) => {
      if (isCropMode) return;
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "Escape") {
        if (isFullscreen) setIsFullscreen(false);
        else onExit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  // Swipe (pointer-drag) nav while at normal size — disabled while cropping.
  // Once zoomed in, the same drag pans around the image instead.
  const handlePointerDown = (e) => {
    if (isCropMode) return;
    if (zoom > 1) {
      panDragRef.current = { startX: e.clientX, startY: e.clientY, originX: pan.x, originY: pan.y };
      setIsPanning(true);
      e.currentTarget.setPointerCapture?.(e.pointerId);
      return;
    }
    dragRef.current = { startX: e.clientX, startY: e.clientY };
  };
  const handlePointerMove = (e) => {
    const panDrag = panDragRef.current;
    if (!panDrag) return;
    setPan({
      x: panDrag.originX + (e.clientX - panDrag.startX),
      y: panDrag.originY + (e.clientY - panDrag.startY),
    });
  };
  const handlePointerUp = (e) => {
    if (panDragRef.current) {
      panDragRef.current = null;
      setIsPanning(false);
      return;
    }
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) goNext();
      else goPrev();
    }
  };

  // Scroll/trackpad-pinch to zoom, centered on wherever the cursor is —
  // disabled while cropping (see the reset effect above for why).
  const handleWheel = (e) => {
    if (isCropMode) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    setZoom((z) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta * z));
      if (next <= MIN_ZOOM + 0.001) {
        setPan({ x: 0, y: 0 });
        return MIN_ZOOM;
      }
      return next;
    });
  };

  const copyImage = async () => {
    setMenuOpen(false);
    try {
      const response = await fetch(current.src);
      const blob = await response.blob();
      try {
        const item = new ClipboardItem({ [blob.type]: blob });
        await navigator.clipboard.write([item]);
      } catch {
        await navigator.clipboard.writeText(current.src);
      }
    } catch (err) {
      console.error("Failed to copy image:", err);
    }
  };

  const exportImage = () => {
    setMenuOpen(false);
    const a = document.createElement("a");
    a.href = current.src;
    a.download = `reference-${current.id}.png`;
    a.click();
  };

  const generatePalette = async () => {
    setIsGenerating(true);
    await onGeneratePalette(current.id);
    setIsGenerating(false);
  };

  const copyHex = (hex) => {
    navigator.clipboard.writeText(hex).then(() => {
      setCopiedHex(hex);
      setTimeout(() => setCopiedHex((h) => (h === hex ? null : h)), 1200);
    });
  };

  // rotate() is a paint-only transform — it never changes the element's own
  // layout box, so a landscape image rotated 90° still occupies its
  // original wide-short box and spills past it, getting clipped by the
  // stage's overflow-hidden. A 90°/270° rotation always fits within a
  // SQUARE at least as large as either of its own two dimensions, though
  // (rotating anything ≤N on both axes by 90° keeps both axes ≤N) — so the
  // stage only needs to become square while actually sideways; 0°/180°
  // keeps today's tight, non-square framing exactly as it was.
  const isSideways = isCurrentActive && transform.rotation % 180 !== 0;

  const containerClass = isFullscreen
    ? "fixed inset-0 z-[75] flex flex-col bg-surface-canvas text-ink-primary"
    : "relative flex flex-col rounded-panel border border-border bg-surface-sunken text-ink-primary overflow-hidden";

  const toolbarBtn =
    "flex h-8 w-8 items-center justify-center rounded-control text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary";

  if (!current) return null;

  return (
    <div className={containerClass} style={isFullscreen ? undefined : { minHeight: "70vh" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink-secondary">
            Image {index + 1} of {images.length}
          </span>
          {zoom > 1 && !isCropMode && (
            <button
              onClick={resetZoom}
              title="Reset zoom"
              className="rounded-full bg-surface-raised px-2 py-0.5 text-xs font-semibold text-ink-secondary transition-colors hover:bg-surface-overlay"
            >
              {Math.round(zoom * 100)}% · Reset
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsFullscreen((v) => !v)}
            title={isFullscreen ? "Exit full screen" : "Full screen"}
            aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
            className="flex h-9 w-9 items-center justify-center rounded-control text-ink-secondary transition-colors hover:bg-surface-raised"
          >
            {isFullscreen ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9L4 4m0 0v4m0-4h4m7 5l5-5m0 0v4m0-4h-4M9 15l-5 5m0 0v-4m0 4h4m7-5l5 5m0 0v-4m0 4h-4" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" />
              </svg>
            )}
          </button>
          <button
            onClick={onExit}
            title="Close"
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-control text-ink-secondary transition-colors hover:bg-surface-raised"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Card area */}
      <div className="relative flex flex-1 items-center justify-center px-4 pb-4">
        {!isCropMode && (
          <button
            onClick={goPrev}
            disabled={index === 0}
            className="absolute left-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-surface-overlay text-ink-secondary shadow-lg transition-opacity disabled:opacity-30"
            aria-label="Previous image"
          >
            ‹
          </button>
        )}

        <div className="flex max-h-full max-w-full flex-col items-center gap-4">
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            onDoubleClick={isCropMode ? undefined : resetZoom}
            className={`relative flex max-h-[55vh] max-w-full items-center justify-center overflow-hidden shadow-2xl ${
              isSideways ? "aspect-square" : ""
            }`}
            style={{
              touchAction: "pan-y",
              cursor: isCropMode ? undefined : zoom > 1 ? (isPanning ? "grabbing" : "grab") : undefined,
            }}
          >
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transition: isPanning ? "none" : "transform 0.15s ease-out",
              }}
            >
              <div
                className="relative"
                style={{ clipPath: isCurrentActive && !isCropMode ? getClipStyle(transform.crop) : undefined }}
              >
                <img
                  src={current.src}
                  alt={`Reference ${index + 1}`}
                  draggable={false}
                  className={`select-none object-contain ${isSideways ? "max-h-full max-w-full" : "max-h-[55vh] max-w-full"} ${
                    isCurrentActive && transform.grayscale ? "grayscale" : ""
                  }`}
                  style={{ transform: isCurrentActive ? getTransformStyle(transform) : undefined }}
                />
                {showGrid && (
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{ transform: isCurrentActive ? getTransformStyle(transform) : undefined }}
                    aria-hidden="true"
                  >
                    {/* Rule-of-thirds — white lines with mix-blend-difference
                        so they stay visible over any photo, dark or light. */}
                    <div className="absolute bottom-0 top-0 w-px bg-white mix-blend-difference" style={{ left: "33.333%" }} />
                    <div className="absolute bottom-0 top-0 w-px bg-white mix-blend-difference" style={{ left: "66.666%" }} />
                    <div className="absolute inset-x-0 h-px bg-white mix-blend-difference" style={{ top: "33.333%" }} />
                    <div className="absolute inset-x-0 h-px bg-white mix-blend-difference" style={{ top: "66.666%" }} />
                  </div>
                )}
              </div>
            </div>

            {/* Crop overlay */}
            {isCropMode && cropRect && (
              <div
                ref={cropOverlayRef}
                className="absolute inset-0"
                onPointerMove={onCropPointerMove}
                onPointerUp={onCropPointerUp}
                onPointerCancel={onCropPointerUp}
              >
                <div
                  className="absolute inset-0 bg-black/50"
                  style={{
                    clipPath: `inset(${cropRect.top * 100}% ${(1 - cropRect.right) * 100}% ${(1 - cropRect.bottom) * 100}% ${cropRect.left * 100}%)`,
                  }}
                />
                <div
                  className="absolute border-2 border-accent-primary"
                  style={{
                    left: `${cropRect.left * 100}%`,
                    top: `${cropRect.top * 100}%`,
                    width: `${(cropRect.right - cropRect.left) * 100}%`,
                    height: `${(cropRect.bottom - cropRect.top) * 100}%`,
                  }}
                  onPointerDown={(e) => onCropPointerDown(e, "move", cropOverlayRef.current.getBoundingClientRect())}
                >
                  {CROP_HANDLES.map((h) => (
                    <div
                      key={h}
                      className="absolute h-3 w-3 rounded-sm bg-accent-primary"
                      style={{
                        left: h.includes("w") ? -6 : h.includes("e") ? "auto" : "50%",
                        right: h.includes("e") ? -6 : "auto",
                        top: h.includes("n") ? -6 : h.includes("s") ? "auto" : "50%",
                        bottom: h.includes("s") ? -6 : "auto",
                        transform: "translate(-50%, -50%)",
                        cursor: `${h}-resize`,
                      }}
                      onPointerDown={(e) => onCropPointerDown(e, h, cropOverlayRef.current.getBoundingClientRect())}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <TagEditor
            tags={current.tags || []}
            size="md"
            onAddTag={(tag) => onAddTag(current.id, tag)}
            onRemoveTag={(tag) => onRemoveTag(current.id, tag)}
          />

          {/* Palette swatches, if this image has one cached */}
          {current.palette?.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {current.palette.map((hex) => (
                <button
                  key={hex}
                  onClick={() => copyHex(hex)}
                  title={`Copy ${hex}`}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-surface-raised px-2 py-1 font-mono text-xs text-ink-secondary transition-colors hover:border-accent-primary"
                >
                  <span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: hex }} />
                  {copiedHex === hex ? "Copied!" : hex}
                </button>
              ))}
            </div>
          )}

          {/* Crop action bar */}
          {isCropMode ? (
            <div className="flex items-center gap-2">
              <button
                onClick={onApplyCrop}
                className="rounded-control bg-accent-primary px-4 py-2 text-sm font-bold text-accent-primary-ink transition-colors hover:bg-accent-primary-hover"
              >
                Apply
              </button>
              <button
                onClick={onCancelCrop}
                className="rounded-control px-4 py-2 text-sm font-semibold text-ink-secondary transition-colors hover:bg-surface-raised"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {isCurrentActive && (
                <div className="flex items-center gap-1 rounded-panel border border-border bg-surface-raised px-2 py-1 shadow-card">
                  <button className={toolbarBtn} title="Crop" aria-label="Crop" onClick={onStartCrop}>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 2v14a2 2 0 002 2h14M2 6h14a2 2 0 012 2v14" />
                    </svg>
                  </button>
                  <button className={toolbarBtn} title="Mirror" aria-label="Mirror" onClick={onToggleMirror}>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M8 7l-4 4 4 4M16 7l4 4-4 4" />
                    </svg>
                  </button>
                  <button
                    className={toolbarBtn}
                    title={transform.grayscale ? "Ungray" : "Gray"}
                    aria-label={transform.grayscale ? "Remove grayscale" : "Apply grayscale"}
                    onClick={onToggleGray}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="12" r="9" />
                      <path strokeLinecap="round" d="M12 3a9 9 0 010 18" />
                    </svg>
                  </button>
                  <button className={toolbarBtn} title="Rotate" aria-label="Rotate" onClick={onRotate}>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 9a8 8 0 0114-3M20 15a8 8 0 01-14 3" />
                    </svg>
                  </button>
                  <button className={toolbarBtn} title="Undo" aria-label="Undo" onClick={onRevert}>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v0a5 5 0 01-5 5H8M3 10l4-4M3 10l4 4" />
                    </svg>
                  </button>
                  <button
                    className={`${toolbarBtn} ${showGrid ? "bg-surface-sunken text-ink-primary" : ""}`}
                    title={showGrid ? "Hide grid" : "Show grid"}
                    aria-label={showGrid ? "Hide grid" : "Show grid"}
                    aria-pressed={showGrid}
                    onClick={() => setShowGrid((v) => !v)}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <rect x="3" y="3" width="18" height="18" rx="1" />
                      <line x1="9" y1="3" x2="9" y2="21" />
                      <line x1="15" y1="3" x2="15" y2="21" />
                      <line x1="3" y1="9" x2="21" y2="9" />
                      <line x1="3" y1="15" x2="21" y2="15" />
                    </svg>
                  </button>
                </div>
              )}

              {!isCurrentActive && (
                <button
                  onClick={() => onPick(current.id)}
                  className="rounded-control bg-accent-primary px-5 py-2 text-sm font-bold text-accent-primary-ink transition-colors hover:bg-accent-primary-hover"
                >
                  Use this reference
                </button>
              )}

              {/* ⋯ menu — Copy/Export/Generate Palette always; Delete only for the active image */}
              <div className="relative">
                <button className={toolbarBtn} title="More options" aria-label="More options" onClick={() => setMenuOpen((v) => !v)}>
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="5" cy="12" r="1.5" />
                    <circle cx="12" cy="12" r="1.5" />
                    <circle cx="19" cy="12" r="1.5" />
                  </svg>
                </button>
                <Popover isOpen={menuOpen} onClose={() => setMenuOpen(false)} width="w-44" align="right" placement="top">
                  <div className="flex flex-col">
                    {isCurrentActive && (
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          onClearSlot();
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-primary transition-colors hover:bg-surface-sunken"
                      >
                        Delete
                      </button>
                    )}
                    <button
                      onClick={copyImage}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-primary transition-colors hover:bg-surface-sunken"
                    >
                      Copy
                    </button>
                    <button
                      onClick={exportImage}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-primary transition-colors hover:bg-surface-sunken"
                    >
                      Export
                    </button>
                    <button
                      onClick={generatePalette}
                      disabled={isGenerating}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-primary transition-colors hover:bg-surface-sunken disabled:opacity-50"
                    >
                      {isGenerating ? "Generating…" : "Generate Palette"}
                    </button>
                  </div>
                </Popover>
              </div>
            </div>
          )}
        </div>

        {!isCropMode && (
          <button
            onClick={goNext}
            disabled={index === images.length - 1}
            className="absolute right-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-surface-overlay text-ink-secondary shadow-lg transition-opacity disabled:opacity-30"
            aria-label="Next image"
          >
            ›
          </button>
        )}
      </div>
    </div>
  );
}
