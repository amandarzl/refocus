import { useRef, useState } from "react";
import { filesToReferences } from "../../utils/imageProcessor";
import { normalizeTag } from "./TagEditor";

// Adds images to one folder's persistent library. Combines the old
// canvas uploader's drag/drop + clipboard-paste + Pinterest/URL fetch
// (via the local proxy in server.js) with straight-to-Dexie base64
// storage, since folder images are a long-lived library, not scattered
// canvas objects with revocable blob URLs.
export default function FolderUploadModal({
  isDark,
  folder,
  onClose,
  onAddReferences,
  existingReferences,
  onPick,
}) {
  const [tagsInput, setTagsInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const parsedTags = tagsInput
    .split(/\s+/)
    .map(normalizeTag)
    .filter(Boolean)
    .filter((t, i, arr) => arr.indexOf(t) === i);

  // The Tags field does double duty: it labels new uploads, and it filters
  // the "pick from this folder" grid down to matching existing photos.
  const visibleExisting =
    parsedTags.length === 0
      ? existingReferences || []
      : (existingReferences || []).filter((ref) => (ref.tags || []).some((t) => parsedTags.includes(t)));

  const triggerShake = (message) => {
    setError(message);
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  const handleFiles = async (files) => {
    const imageFiles = Array.from(files).filter(
      (file) => file && file.type && file.type.startsWith("image/"),
    );
    if (imageFiles.length === 0) return;

    setIsBusy(true);
    setError(null);
    try {
      const refs = await filesToReferences(imageFiles, folder.id, parsedTags);
      if (refs.length > 0) {
        await onAddReferences(refs);
        onClose();
      } else {
        triggerShake("Couldn't process those images. Try a different file.");
      }
    } catch (err) {
      console.error("Reference upload failed:", err);
      triggerShake("Something went wrong processing those images.");
    } finally {
      setIsBusy(false);
    }
  };

  const normalizeUrl = (raw) => {
    const value = raw?.trim();
    if (!value) return null;
    try {
      return new URL(value).toString();
    } catch {
      return null;
    }
  };

  const isPinterestUrl = (url) => {
    if (!url) return false;
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return hostname.includes("pinterest") || hostname.includes("pinimg");
    } catch {
      return false;
    }
  };

  const extractImageUrlFromHtml = (html) => {
    if (!html) return null;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const candidates = [
      doc.querySelector('meta[property="og:image"]'),
      doc.querySelector('meta[name="twitter:image"]'),
      doc.querySelector("img"),
    ];
    for (const candidate of candidates) {
      const src =
        candidate?.getAttribute("content") || candidate?.getAttribute("src");
      if (src && /^https?:\/\//i.test(src)) return src;
    }
    return null;
  };

  // Fetches an external image through the local proxy (server.js) so
  // Pinterest/CDN pages that block direct cross-origin fetches still work.
  const fetchImageFromUrl = async (url) => {
    try {
      const cleanUrl = normalizeUrl(url);
      if (!cleanUrl) throw new Error("Invalid URL");

      // Relative — Vite's dev server mounts this proxy itself (see
      // vite.config.js), so it's always same-origin and needs no separate
      // process running.
      const response = await fetch("/api/proxy-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: cleanUrl }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error || "Proxy failed");

      const binaryString = atob(result.data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: result.type });
      return new File([blob], result.filename || "image", {
        type: result.type,
      });
    } catch (err) {
      console.error("Failed to fetch image:", err);
      return null;
    }
  };

  const fetchAndAdd = async (url) => {
    const file = await fetchImageFromUrl(url);
    if (file) {
      await handleFiles([file]);
    } else {
      triggerShake(
        "This image could not be loaded. Try a direct image URL or another Pinterest link.",
      );
    }
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles = Array.from(items)
      .filter((item) => item.type && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter(Boolean);
    if (imageFiles.length > 0) {
      await handleFiles(imageFiles);
      return;
    }

    const pastedText = e.clipboardData?.getData("text/plain") || "";
    const url = normalizeUrl(pastedText);
    if (url && (isPinterestUrl(url) || /^https?:\/\//i.test(url))) {
      await fetchAndAdd(url);
    }
  };

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    const trimmed = urlInput.trim();
    if (!trimmed) return;

    const normalized = normalizeUrl(trimmed);
    if (!normalized || (!isPinterestUrl(normalized) && !/^https?:\/\//i.test(normalized))) {
      triggerShake("Enter a valid image or Pinterest URL.");
      return;
    }

    setIsBusy(true);
    await fetchAndAdd(normalized);
    setIsBusy(false);
    setUrlInput("");
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer?.files?.length > 0) {
      await handleFiles(e.dataTransfer.files);
      return;
    }

    const html = e.dataTransfer?.getData("text/html");
    const htmlImageUrl = html ? extractImageUrlFromHtml(html) : null;
    if (htmlImageUrl) {
      await fetchAndAdd(htmlImageUrl);
      return;
    }

    const url =
      e.dataTransfer?.getData("text/uri-list") ||
      e.dataTransfer?.getData("text/plain");
    const cleanUrl = normalizeUrl(url);
    if (cleanUrl) await fetchAndAdd(cleanUrl);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-[71] flex items-center justify-center p-4">
        <div
          onClick={(e) => e.stopPropagation()}
          onPaste={handlePaste}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl ${
            isDark
              ? "border-zinc-800 bg-[#1F1F23] text-slate-100"
              : "border-slate-200 bg-white text-slate-900"
          } ${isShaking ? "animate-shake" : ""}`}
          role="dialog"
          aria-label={`Add references to ${folder.name}`}
          tabIndex={0}
        >
          <div className="flex items-start justify-between">
            <h3 className="text-lg font-bold">Add to "{folder.name}"</h3>
            <button
              onClick={onClose}
              className={`rounded-lg p-1 transition-colors ${
                isDark
                  ? "text-slate-400 hover:bg-zinc-800 hover:text-slate-200"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              }`}
              title="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tags */}
          <label className={`mt-4 block text-xs font-semibold uppercase tracking-wider ${
            isDark ? "text-slate-500" : "text-slate-400"
          }`}>
            {onPick && existingReferences?.length > 0
              ? "Tags — filters photos below, tags anything new you add"
              : "Tags (optional, applies to this batch)"}
          </label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="#pose #anatomy #lighting"
            className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors ${
              isDark
                ? "border-zinc-700 bg-[#1A1A1E] text-slate-100 placeholder:text-zinc-600 focus:border-[#A8C3A4]"
                : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-[#A8C3A4]"
            }`}
          />

          {/* Pick from this folder's existing archive — only offered where
              picking-as-active makes sense (the board wires this up; the
              Add References archive page doesn't). Typing in Tags above also
              filters this grid down to matching photos. */}
          {onPick && existingReferences?.length > 0 && (
            <>
              <div className="mt-4 flex items-center gap-3">
                <span className={`text-xs font-medium uppercase tracking-wider ${
                  isDark ? "text-slate-500" : "text-slate-400"
                }`}>
                  Or pick from this folder
                </span>
                <div className={`h-px flex-1 ${isDark ? "bg-zinc-800" : "bg-slate-200"}`} />
              </div>
              {visibleExisting.length === 0 ? (
                <p className={`mt-2 text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                  No photos match those tags.
                </p>
              ) : (
                <div className="mt-2 grid max-h-40 grid-cols-4 gap-2 overflow-y-auto">
                  {visibleExisting.map((ref) => (
                    <button
                      key={ref.id}
                      onClick={() => {
                        onPick(ref.id);
                        onClose();
                      }}
                      title="Use this picture"
                      className={`aspect-square overflow-hidden rounded-lg border transition-colors ${
                        isDark ? "border-zinc-700 hover:border-[#A8C3A4]" : "border-slate-200 hover:border-[#A8C3A4]"
                      }`}
                    >
                      <img src={ref.src} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
              isDragging
                ? "border-[#A8C3A4] bg-[#A8C3A4]/10"
                : isDark
                  ? "border-zinc-700 bg-[#1A1A1E] hover:border-[#A8C3A4]"
                  : "border-slate-300 bg-slate-50 hover:border-[#A8C3A4]"
            }`}
          >
            <svg className={`h-8 w-8 ${isDark ? "text-slate-500" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <p className={`mt-2 text-sm font-semibold ${isDark ? "text-slate-200" : "text-slate-700"}`}>
              {isBusy ? "Processing…" : "Click to browse or drag & drop"}
            </p>
            <p className={`mt-1 text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              Multiple images, a Pinterest link, or paste from clipboard
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
            <div className={`h-px flex-1 ${isDark ? "bg-zinc-800" : "bg-slate-200"}`} />
            <span className={`text-xs font-medium uppercase tracking-wider ${
              isDark ? "text-slate-500" : "text-slate-400"
            }`}>
              or paste URL
            </span>
            <div className={`h-px flex-1 ${isDark ? "bg-zinc-800" : "bg-slate-200"}`} />
          </div>

          <form onSubmit={handleUrlSubmit} className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://... or a Pinterest pin"
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors ${
                isDark
                  ? "border-zinc-700 bg-[#1A1A1E] text-slate-100 placeholder:text-slate-600 focus:border-[#A8C3A4]"
                  : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-[#A8C3A4]"
              }`}
              aria-label="Image URL"
            />
            <button
              type="submit"
              disabled={!urlInput.trim() || isBusy}
              className={`rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
                !urlInput.trim() || isBusy
                  ? "cursor-not-allowed opacity-40"
                  : "bg-[#A8C3A4] text-black hover:bg-[#97b593]"
              }`}
            >
              Add
            </button>
          </form>

          {error && (
            <p className="mt-3 text-xs font-medium text-[#E5989B]">{error}</p>
          )}
        </div>
      </div>
    </>
  );
}
