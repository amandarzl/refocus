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
  isCropMode,
  cropRect,
  onCropChange,
  onApplyCrop,
  onCancelCrop,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
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

  // --- Crop logic (local drag handling, state synced via onCropChange) ---
  const handleCropPointerDown = (e, handle) => {
    e.stopPropagation();
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return;
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
    onCropChange(next);
  };

  const handleCropPointerUp = () => {
    cropDragRef.current = null;
  };

  // --- Style computation ---
  const clipStyle = crop
    ? {
        clipPath: `inset(${crop.top * 100}% ${(1 - crop.right) * 100}% ${(1 - crop.bottom) * 100}% ${crop.left * 100}%)`,
      }
    : {};

  const filterStyle = grayscale ? "grayscale(1)" : "none";

  const transformStyle = `rotate(${rotation}deg) scaleX(${mirrored ? -1 : 1})`;

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
      </div>
    </div>
  );
}
