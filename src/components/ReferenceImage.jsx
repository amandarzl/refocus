import { useRef, useState, useCallback, useEffect } from "react";

const DRAG_THRESHOLD = 5; // px before a pointer-down becomes a drag
const DEFAULT_WIDTH = 220;
const HIT_MARGIN = 24; // desired on-screen grab margin around the image (px)

export default function ReferenceImage({
  image,
  isDark,
  zoom = 1,
  isSelected,
  onSelect,
  onUpdate,
  onRemove,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [isCropMode, setIsCropMode] = useState(false);
  const [cropRect, setCropRect] = useState(null); // { left, top, right, bottom } normalized
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const imgRef = useRef(null);
  const containerRef = useRef(null);
  const cropDragRef = useRef(null);

  const {
    x,
    y,
    width = DEFAULT_WIDTH,
    rotation = 0,
    mirrored = false,
    grayscale = false,
    crop = null,
  } = image;

  // Zoom-compensated grab margin so the hit area stays a comfortable
  // constant size on screen regardless of the board zoom level
  const hitPad = HIT_MARGIN / zoom;

  // Reset crop mode when deselected
  useEffect(() => {
    if (!isSelected) {
      setIsCropMode(false);
      setIsMenuOpen(false);
    }
  }, [isSelected]);

  // --- Drag logic ---
  const handlePointerDown = (e) => {
    if (isCropMode) return;
    e.stopPropagation();
    onSelect();
    setDragStart({
      pointerX: e.clientX,
      pointerY: e.clientY,
      startX: x,
      startY: y,
      moved: false,
    });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!dragStart) return;
    // Divide by zoom so the image tracks the cursor 1:1 at any zoom level
    const dx = (e.clientX - dragStart.pointerX) / zoom;
    const dy = (e.clientY - dragStart.pointerY) / zoom;

    if (!dragStart.moved && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD)
      return;

    // Unbounded canvas: images move freely across the whole grid surface
    const newX = dragStart.startX + dx;
    const newY = dragStart.startY + dy;

    if (!dragStart.moved) {
      setDragStart((prev) => ({ ...prev, moved: true }));
      setIsDragging(true);
    }
    onUpdate(image.id, { x: newX, y: newY });
  };

  const handlePointerUp = () => {
    setDragStart(null);
    setIsDragging(false);
  };

  // --- Resize logic ---
  const resizeRef = useRef(null);

  const handleResizeStart = (e) => {
    if (isCropMode) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    resizeRef.current = {
      startX: e.clientX,
      startWidth: width,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleResizeMove = (e) => {
    const r = resizeRef.current;
    if (!r) return;
    const container = containerRef.current?.parentElement;
    const maxW = container ? container.clientWidth - x : DEFAULT_WIDTH;
    const newWidth = Math.max(
      60,
      Math.min(maxW, r.startWidth + (e.clientX - r.startX)),
    );
    onUpdate(image.id, { width: newWidth });
  };

  const handleResizeUp = () => {
    resizeRef.current = null;
  };

  // --- Crop logic ---
  const startCrop = () => {
    setIsCropMode(true);
    setIsMenuOpen(false);
    setCropRect(crop ?? { left: 0.1, top: 0.1, right: 0.9, bottom: 0.9 });
  };

  const handleCropPointerDown = (e, handle) => {
    e.stopPropagation();
    const rect = imgRef.current.getBoundingClientRect();
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
      if (drag.handle.includes("left"))
        next.left = Math.max(0, Math.min(init.right - min, init.left + dx));
      if (drag.handle.includes("right"))
        next.right = Math.min(1, Math.max(init.left + min, init.right + dx));
      if (drag.handle.includes("top"))
        next.top = Math.max(0, Math.min(init.bottom - min, init.top + dy));
      if (drag.handle.includes("bottom"))
        next.bottom = Math.min(1, Math.max(init.top + min, init.bottom + dy));
    }
    setCropRect(next);
  };

  const handleCropPointerUp = () => {
    cropDragRef.current = null;
  };

  const applyCrop = () => {
    onUpdate(image.id, { crop: cropRect });
    setIsCropMode(false);
  };

  const cancelCrop = () => {
    setCropRect(crop ?? null);
    setIsCropMode(false);
  };

  // --- Transform helpers ---
  const toggleMirror = () => {
    onUpdate(image.id, { mirrored: !mirrored });
    setIsMenuOpen(false);
  };

  const toggleGray = () => {
    onUpdate(image.id, { grayscale: !grayscale });
    setIsMenuOpen(false);
  };

  const rotate = () => {
    onUpdate(image.id, { rotation: (rotation + 90) % 360 });
    setIsMenuOpen(false);
  };

  const revert = () => {
    onUpdate(image.id, {
      rotation: 0,
      mirrored: false,
      grayscale: false,
      crop: null,
    });
    setIsMenuOpen(false);
  };

  // --- Copy ---
  const copyImage = async () => {
    setIsMenuOpen(false);
    try {
      const blob = await fetch(image.src).then((r) => r.blob());
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type || "image/png"]: blob }),
      ]);
    } catch {
      // Fallback: copy the URL text
      try {
        await navigator.clipboard.writeText(image.src);
      } catch {
        /* ignore */
      }
    }
  };

  // --- Export ---
  const exportImage = async () => {
    setIsMenuOpen(false);
    setIsExporting(true);
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = image.src;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const c = crop ?? { left: 0, top: 0, right: 1, bottom: 1 };
      const srcW = img.naturalWidth;
      const srcH = img.naturalHeight;
      const sx = c.left * srcW;
      const sy = c.top * srcH;
      const sw = (c.right - c.left) * srcW;
      const sh = (c.bottom - c.top) * srcH;

      const rotated = rotation % 180 !== 0;
      const outW = rotated ? sh : sw;
      const outH = rotated ? sw : sh;

      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");

      ctx.translate(outW / 2, outH / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      if (mirrored) ctx.scale(-1, 1);
      ctx.drawImage(img, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
      if (grayscale) {
        ctx.globalCompositeOperation = "saturation";
        ctx.fillStyle = "#000";
        ctx.fillRect(-outW / 2, -outH / 2, outW, outH);
      }

      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `reference-${image.id}.png`;
      a.click();
    } catch {
      // Cross-origin taint fallback: download original
      const a = document.createElement("a");
      a.href = image.src;
      a.download = `reference-${image.id}.png`;
      a.click();
    } finally {
      setIsExporting(false);
    }
  };

  // --- Style computation ---
  const clipStyle = crop
    ? {
        clipPath: `inset(${crop.top * 100}% ${(1 - crop.right) * 100}% ${(1 - crop.bottom) * 100}% ${crop.left * 100}%)`,
      }
    : {};

  const filterStyle = grayscale ? "grayscale(1)" : "none";

  const transformStyle = `rotate(${rotation}deg) scaleX(${mirrored ? -1 : 1})`;

  const toolbarBtn =
    "flex h-8 w-8 items-center justify-center rounded-lg transition-colors " +
    (isDark
      ? "text-slate-300 hover:bg-zinc-700"
      : "text-slate-600 hover:bg-slate-200");

  return (
    <div
      ref={containerRef}
      className="absolute"
      style={{
        left: x - hitPad,
        top: y - hitPad,
        width: width + hitPad * 2,
        padding: hitPad,
        boxSizing: "border-box",
        zIndex: isSelected ? 30 : 10,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Inner content wrapper — keeps the image visually at x,y */}
      <div className="relative" style={{ width }}>
        {/* Toolbar (selected) */}
        {isSelected && !isCropMode && (
          <div
            className={`absolute -top-14 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-xl border px-2 py-1 shadow-2xl ${
              isDark
                ? "border-zinc-700 bg-[#242428]"
                : "border-slate-200 bg-white"
            }`}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button className={toolbarBtn} title="Crop" onClick={startCrop}>
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
              onClick={toggleMirror}
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
                  d="M8 3v18M16 3v18M3 8h18M3 16h18"
                />
              </svg>
            </button>
            <button
              className={toolbarBtn}
              title={grayscale ? "Ungray" : "Gray"}
              onClick={toggleGray}
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
            <button className={toolbarBtn} title="Rotate" onClick={rotate}>
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
            <button className={toolbarBtn} title="Revert" onClick={revert}>
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
                onClick={() => setIsMenuOpen((v) => !v)}
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
              {isMenuOpen && (
                <div
                  className={`absolute right-0 top-9 z-50 w-40 overflow-hidden rounded-xl border shadow-2xl ${
                    isDark
                      ? "border-zinc-700 bg-[#242428]"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onRemove(image.id);
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
                    onClick={copyImage}
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
                    onClick={exportImage}
                    disabled={isExporting}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                      isDark
                        ? "text-slate-200 hover:bg-zinc-800"
                        : "text-slate-700 hover:bg-slate-100"
                    } ${isExporting ? "opacity-50" : ""}`}
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
                    {isExporting ? "Exporting…" : "Export"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Image */}
        <div
          className={`relative overflow-hidden rounded-lg shadow-lg transition-shadow ${
            isSelected ? "ring-2 ring-[#A8C3A4]" : "ring-1 ring-black/10"
          } ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
          style={{ width, ...clipStyle }}
        >
          <img
            ref={imgRef}
            src={image.src}
            alt="Reference"
            draggable={false}
            className="block w-full select-none"
            style={{ transform: transformStyle, filter: filterStyle }}
            onDragStart={(e) => e.preventDefault()}
          />

          {/* Crop overlay */}
          {isCropMode && cropRect && (
            <div
              className="absolute inset-0"
              onPointerMove={handleCropPointerMove}
              onPointerUp={handleCropPointerUp}
              onPointerCancel={handleCropPointerUp}
            >
              {/* Darken outside crop */}
              <div
                className="absolute inset-0 bg-black/50"
                style={{
                  clipPath: `inset(${cropRect.top * 100}% ${(1 - cropRect.right) * 100}% ${(1 - cropRect.bottom) * 100}% ${cropRect.left * 100}%)`,
                }}
              />
              {/* Crop rect */}
              <div
                className="absolute border-2 border-[#A8C3A4]"
                style={{
                  left: `${cropRect.left * 100}%`,
                  top: `${cropRect.top * 100}%`,
                  width: `${(cropRect.right - cropRect.left) * 100}%`,
                  height: `${(cropRect.bottom - cropRect.top) * 100}%`,
                }}
                onPointerDown={(e) => handleCropPointerDown(e, "move")}
              >
                {/* Handles */}
                {["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((h) => (
                  <div
                    key={h}
                    className="absolute h-3 w-3 rounded-sm bg-[#A8C3A4]"
                    style={{
                      left: h.includes("w")
                        ? -6
                        : h.includes("e")
                          ? "auto"
                          : "50%",
                      right: h.includes("e") ? -6 : "auto",
                      top: h.includes("n")
                        ? -6
                        : h.includes("s")
                          ? "auto"
                          : "50%",
                      bottom: h.includes("s") ? -6 : "auto",
                      transform: "translate(-50%, -50%)",
                      cursor: `${h}-resize`,
                    }}
                    onPointerDown={(e) => handleCropPointerDown(e, h)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Resize handle (selected) */}
        {isSelected && !isCropMode && (
          <div
            className="absolute -bottom-1.5 -right-1.5 z-50 flex h-4 w-4 cursor-nwse-resize items-center justify-center rounded-sm bg-[#A8C3A4] text-black shadow-lg"
            title="Resize image"
            aria-label="Resize image"
            onPointerDown={handleResizeStart}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeUp}
            onPointerCancel={handleResizeUp}
          >
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 5l6 6-6 6M5 13l6 6 6-6"
              />
            </svg>
          </div>
        )}

        {/* Crop action bar */}
        {isCropMode && (
          <div
            className="absolute -bottom-12 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-xl border px-3 py-1.5 shadow-2xl"
            style={{
              background: isDark ? "#242428" : "#fff",
              borderColor: isDark ? "#3f3f46" : "#e2e8f0",
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={applyCrop}
              className="rounded-lg bg-[#A8C3A4] px-3 py-1 text-xs font-bold text-black transition-colors hover:bg-[#97b593]"
            >
              Apply
            </button>
            <button
              onClick={cancelCrop}
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
      </div>
    </div>
  );
}
