import { useRef, useState } from "react";
import { compressImage } from "../utils/imageProcessor";

const MAX_IMAGES = 3;

export default function UploadModal({
  group,
  isDark,
  onAddImages,
  onReject,
  onClose,
}) {
  const [urlInput, setUrlInput] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const fileInputRef = useRef(null);

  const remainingSlots = Math.max(0, MAX_IMAGES - group.images.length);

  const triggerReject = () => {
    setIsShaking(true);
    onReject(group.id);
    setTimeout(() => setIsShaking(false), 500);
  };

  // Compress image using worker (off-thread) with main-thread fallback
  const compressAndResizeImage = async (file) => {
    // Determine if we should extract palette (Color category)
    const isColorCategory = group.subtitle === "Color";

    const result = await compressImage(file, {
      extractPalette: isColorCategory,
      preferWorker: true,
    });

    if (!result.success) {
      throw new Error(result.error || "Compression failed");
    }

    // Create blob URL for display (lifecycle managed by App.jsx)
    const blobUrl = URL.createObjectURL(result.blob);

    // Return object with src, width, height, and optional palette
    const imageData = {
      src: blobUrl,
      width: result.width,
      height: result.height,
    };

    if (result.palette && result.palette.length > 0) {
      imageData.palette = result.palette;
    }

    return imageData;
  };

  const handleFiles = async (files) => {
    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );

    if (imageFiles.length === 0) return;

    if (imageFiles.length > remainingSlots) {
      triggerReject();
      return;
    }

    const newImages = await Promise.all(
      imageFiles.map((file) => compressAndResizeImage(file)),
    );
    onAddImages(group.id, newImages);
    onClose();
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles = Array.from(items)
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter(Boolean);

    if (imageFiles.length === 0) return;

    if (imageFiles.length > remainingSlots) {
      triggerReject();
      return;
    }

    const newImages = await Promise.all(
      imageFiles.map((file) => compressAndResizeImage(file)),
    );
    onAddImages(group.id, newImages);
    onClose();
  };

  const handleUrlSubmit = (e) => {
    e.preventDefault();
    const trimmed = urlInput.trim();
    if (!trimmed) return;

    if (remainingSlots < 1) {
      triggerReject();
      return;
    }

    onAddImages(group.id, [trimmed]);
    setUrlInput("");
    onClose();
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer?.files);
  };

  const isFull = group.images.length >= MAX_IMAGES;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={`absolute bottom-24 left-6 z-50 w-80 overflow-hidden rounded-2xl border shadow-2xl ${
          isDark ? "border-zinc-700 bg-[#242428]" : "border-slate-200 bg-white"
        } ${isShaking ? "animate-shake" : ""}`}
        role="dialog"
        aria-label={`Upload to ${group.title}`}
        onPaste={handlePaste}
        tabIndex={0}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between border-b px-4 py-3 ${
            isDark ? "border-zinc-800" : "border-slate-100"
          }`}
        >
          <div>
            <h3
              className={`text-sm font-bold ${
                isDark ? "text-slate-100" : "text-slate-900"
              }`}
            >
              {group.title}
            </h3>
            <p
              className={`text-xs ${
                isDark ? "text-slate-500" : "text-slate-400"
              }`}
            >
              {group.subtitle} · {group.images.length}/{MAX_IMAGES} filled
            </p>
          </div>
          <button
            onClick={onClose}
            className={`rounded-lg p-1 transition-colors ${
              isDark
                ? "text-slate-400 hover:bg-zinc-800 hover:text-slate-200"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            }`}
            title="Close"
            aria-label="Close upload dialog"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-4">
          {/* Dropzone / file picker */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
              isDragging
                ? "border-[#A8C3A4] bg-[#A8C3A4]/10"
                : isDark
                  ? "border-zinc-700 bg-[#1A1A1E] hover:border-[#A8C3A4]"
                  : "border-slate-300 bg-slate-50 hover:border-[#A8C3A4]"
            }`}
            role="button"
            tabIndex={0}
            aria-label="Upload image files"
          >
            <svg
              className={`h-8 w-8 ${
                isDark ? "text-slate-500" : "text-slate-400"
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            <p
              className={`mt-2 text-sm font-semibold ${
                isDark ? "text-slate-200" : "text-slate-700"
              }`}
            >
              {isFull ? "Category is full" : "Click to browse or drag & drop"}
            </p>
            <p
              className={`mt-1 text-xs ${
                isDark ? "text-slate-500" : "text-slate-400"
              }`}
            >
              {isFull
                ? "Remove an image to swap"
                : `Images (${remainingSlots} slot${remainingSlots === 1 ? "" : "s"} left) · or paste from clipboard`}
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {/* Divider */}
          <div className="my-4 flex items-center gap-3">
            <div
              className={`h-px flex-1 ${
                isDark ? "bg-zinc-800" : "bg-slate-200"
              }`}
            />
            <span
              className={`text-xs font-medium uppercase tracking-wider ${
                isDark ? "text-slate-500" : "text-slate-400"
              }`}
            >
              or paste URL
            </span>
            <div
              className={`h-px flex-1 ${
                isDark ? "bg-zinc-800" : "bg-slate-200"
              }`}
            />
          </div>

          {/* URL input */}
          <form onSubmit={handleUrlSubmit} className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors ${
                isDark
                  ? "border-zinc-700 bg-[#1A1A1E] text-slate-100 placeholder:text-slate-600 focus:border-[#A8C3A4]"
                  : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-[#A8C3A4]"
              }`}
              aria-label="Image URL"
            />
            <button
              type="submit"
              disabled={!urlInput.trim() || isFull}
              className={`rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                !urlInput.trim() || isFull
                  ? "cursor-not-allowed opacity-40"
                  : "bg-[#A8C3A4] text-black hover:bg-[#97b593]"
              }`}
            >
              Add
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
