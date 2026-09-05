import { useState } from "react";
import AddFolderControl from "../board/AddFolderControl.jsx";
import InlineRenameField from "../ui/InlineRenameField.jsx";
import Popover from "../ui/Popover.jsx";

// A soft "this is getting big" nudge, not a hard cap — the archive stays
// explicitly unbounded (see PhotoGrid.jsx). Past these, exports/backups and
// initial load just start taking noticeably longer, so it's worth knowing.
const WARN_PHOTO_COUNT = 300;
const WARN_BYTES = 150 * 1024 * 1024; // 150 MB

// Manila-folder palette — fixed, theme-independent colors (these are meant
// to look like actual colored folders sitting on a desk, not app chrome).
// A folder defaults to one of these by id (stable across reorders) until
// the user picks their own via the swatch button on the card.
const FOLDER_COLORS = [
  "#E2795A", "#6FA97A", "#C6A3B9", "#E4C25E",
  "#E08F4F", "#BFE0E6", "#4E9AA6", "#D8C7EA",
  "#F0C98A", "#EFC3C0", "#B08A2E", "#CFE3B8",
];
const FOLDER_INK = "#1A1611";

export function defaultFolderColor(folderId) {
  return FOLDER_COLORS[folderId % FOLDER_COLORS.length];
}

// The manila-folder silhouette: a tab on the top-left, beveled down into
// the main body. One clip-path on the card itself — no extra markup.
const FOLDER_CLIP = "polygon(0 0, 42% 0, 48% 12%, 100% 12%, 100% 100%, 0 100%)";

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Landing screen: every folder as a library card. No photo-count cap here —
// this is the unbounded archive, unlike the Reference Board's single
// active slot per folder.
export default function FolderList({
  folders,
  hasAnyFolders = true,
  counts,
  stats,
  searchQuery = "",
  onSearchQueryChange,
  onOpenFolder,
  onAddFolder,
  onDeleteFolder,
  onRenameFolder,
  onChangeFolderColor,
}) {
  const isGettingLarge = stats && (stats.count >= WARN_PHOTO_COUNT || stats.bytes >= WARN_BYTES);
  const [colorPickerId, setColorPickerId] = useState(null);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="font-display text-2xl font-semibold text-ink-primary">Add References</h1>
      <p className="mt-1 text-sm text-ink-secondary">
        Your photo library, organized by folder. Add as many as you like —
        the Reference Board draws from these when you Shuffle.
      </p>
      {stats && stats.count > 0 && (
        <p className={`mt-1 text-xs font-medium ${isGettingLarge ? "text-danger" : "text-ink-muted"}`}>
          {stats.count} photo{stats.count === 1 ? "" : "s"} · ~{formatBytes(stats.bytes)} stored
          {isGettingLarge ? " — getting large, exports/backups may take a while" : ""}
        </p>
      )}

      {hasAnyFolders && (
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange?.(e.target.value)}
          placeholder="Search folders or tags…"
          className="mt-4 w-full max-w-sm rounded-control border border-border bg-surface-canvas px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted outline-none transition-colors focus:border-accent-primary"
        />
      )}

      <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {searchQuery.trim() && folders.length === 0 && hasAnyFolders ? (
          <div className="col-span-full rounded-panel border border-dashed border-border p-8 text-center text-sm text-ink-secondary">
            <p>No folders match "{searchQuery.trim()}".</p>
            <button
              onClick={() => onSearchQueryChange?.("")}
              className="mt-2 text-xs font-semibold text-accent-primary underline"
            >
              Clear search
            </button>
          </div>
        ) : (
        folders.map((folder) => {
          const color = folder.color || defaultFolderColor(folder.id);
          const count = counts[folder.id] || 0;
          return (
            <div key={folder.id} className="group relative">
              <div
                role="button"
                tabIndex={0}
                onClick={() => onOpenFolder(folder)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenFolder(folder);
                  }
                }}
                style={{ backgroundColor: color, clipPath: FOLDER_CLIP, color: FOLDER_INK }}
                className="flex aspect-[4/3] w-full cursor-pointer flex-col justify-between p-3 pt-6 text-left shadow-card outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-canvas"
              >
                {/* Color swatch — click to pick a different folder color;
                    doubles as the folder's little corner "tag" visually. */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setColorPickerId(folder.id);
                  }}
                  title="Change folder color"
                  aria-label="Change folder color"
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-sm border-2 transition-transform hover:scale-125"
                  style={{ borderColor: FOLDER_INK, opacity: 0.55 }}
                />

                <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                  <InlineRenameField
                    value={folder.name}
                    onSave={(name) => onRenameFolder?.(folder.id, name)}
                    className="line-clamp-2 text-sm font-bold leading-tight"
                    inputClassName="w-full bg-white/40 text-sm font-bold leading-tight"
                  />
                </span>

                <span className="flex items-center justify-between text-[9px] font-semibold uppercase tracking-wider opacity-70">
                  <span>
                    {count} photo{count === 1 ? "" : "s"}
                  </span>
                  <span aria-hidden="true" className="text-sm opacity-100">→</span>
                </span>
              </div>

              {colorPickerId === folder.id && (
                <Popover isOpen width="w-40" onClose={() => setColorPickerId(null)}>
                  <div className="grid grid-cols-4 gap-2 p-3">
                    {FOLDER_COLORS.map((swatch) => (
                      <button
                        key={swatch}
                        onClick={() => {
                          onChangeFolderColor?.(folder.id, swatch);
                          setColorPickerId(null);
                        }}
                        title={swatch}
                        aria-label={`Use ${swatch} for ${folder.name}`}
                        style={{ backgroundColor: swatch }}
                        className={`h-6 w-6 rounded-full transition-transform hover:scale-110 ${
                          swatch === color ? "ring-2 ring-accent-primary ring-offset-2 ring-offset-surface-overlay" : ""
                        }`}
                      />
                    ))}
                  </div>
                </Popover>
              )}

              {/* Delete this folder (and all its photos) — top-right corner,
                  matching the Reference Board's corner-control convention. */}
              <button
                onClick={() => onDeleteFolder(folder)}
                title={`Remove ${folder.name} folder`}
                aria-label={`Remove ${folder.name} folder`}
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-sm text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                ✕
              </button>
            </div>
          );
        })
        )}
        <AddFolderControl onCreateFolder={onAddFolder} tileSize="folder" />
      </div>
    </div>
  );
}
