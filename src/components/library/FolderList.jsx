import { useState } from "react";
import AddFolderControl from "../board/AddFolderControl.jsx";

// A soft "this is getting big" nudge, not a hard cap — the archive stays
// explicitly unbounded (see PhotoGrid.jsx). Past these, exports/backups and
// initial load just start taking noticeably longer, so it's worth knowing.
const WARN_PHOTO_COUNT = 300;
const WARN_BYTES = 150 * 1024 * 1024; // 150 MB

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Landing screen: every folder as a library card. No photo-count cap here —
// this is the unbounded archive, unlike the Reference Board's single
// active slot per folder.
export default function FolderList({ isDark, folders, counts, stats, onOpenFolder, onAddFolder, onDeleteFolder, onRenameFolder }) {
  const isGettingLarge = stats && (stats.count >= WARN_PHOTO_COUNT || stats.bytes >= WARN_BYTES);

  const [editingId, setEditingId] = useState(null);
  const [tempName, setTempName] = useState("");

  const startEditing = (folder) => {
    setEditingId(folder.id);
    setTempName(folder.name);
  };

  const saveEdit = (folder) => {
    const finalName = tempName.trim();
    if (finalName && finalName !== folder.name) onRenameFolder?.(folder.id, finalName);
    setEditingId(null);
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className={`text-2xl font-bold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
        Add References
      </h1>
      <p className={`mt-1 text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
        Your photo library, organized by folder. Add as many as you like —
        the Reference Board draws from these when you Shuffle.
      </p>
      {stats && stats.count > 0 && (
        <p
          className={`mt-1 text-xs font-medium ${
            isGettingLarge ? "text-[#E5989B]" : isDark ? "text-zinc-500" : "text-slate-400"
          }`}
        >
          {stats.count} photo{stats.count === 1 ? "" : "s"} · ~{formatBytes(stats.bytes)} stored
          {isGettingLarge ? " — getting large, exports/backups may take a while" : ""}
        </p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {folders.map((folder) => (
          <div key={folder.id} className="group relative">
            <button
              onClick={() => onOpenFolder(folder)}
              className={`flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 transition-colors ${
                isDark
                  ? "border-zinc-800 bg-[#242428] hover:border-[#A8C3A4]"
                  : "border-slate-200 bg-slate-100 hover:border-[#A8C3A4]"
              }`}
            >
              <span className={`text-3xl font-bold ${isDark ? "text-slate-200" : "text-slate-700"}`}>
                {counts[folder.id] || 0}
              </span>
              <span className={`text-xs ${isDark ? "text-zinc-500" : "text-slate-400"}`}>
                photo{counts[folder.id] === 1 ? "" : "s"}
              </span>
            </button>

            {/* Delete this folder (and all its photos) — top-right corner,
                matching the Reference Board's corner-control convention. */}
            <button
              onClick={() => onDeleteFolder(folder)}
              title={`Remove ${folder.name} folder`}
              className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-sm text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            >
              ✕
            </button>

            <div className="mt-2 px-0.5">
              {editingId === folder.id ? (
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  autoFocus
                  onFocus={(e) => e.target.select()}
                  onBlur={() => saveEdit(folder)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit(folder);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  style={{ width: `${Math.max(tempName.length, 1) + 1}ch` }}
                  className={`max-w-full rounded bg-blue-500/10 text-sm font-semibold outline-none focus:ring-1 focus:ring-blue-500/50 ${
                    isDark ? "text-slate-200" : "text-slate-700"
                  }`}
                />
              ) : (
                <span
                  onClick={() => startEditing(folder)}
                  title="Click to rename"
                  className={`block max-w-full cursor-pointer truncate text-sm font-semibold ${
                    isDark ? "text-slate-200" : "text-slate-700"
                  }`}
                >
                  {folder.name}
                </span>
              )}
            </div>
          </div>
        ))}
        <AddFolderControl isDark={isDark} onCreateFolder={onAddFolder} />
      </div>
    </div>
  );
}
