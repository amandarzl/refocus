import { useState } from "react";

// One swatch row per folder, generated in bulk from the board toolbar's
// "Generate Palette" button. Shares its cache (references[id].palette)
// with the per-image "Generate Palette" in Focus Mode, so either path
// fills this section in. The ✕ on a row just clears that image's cached
// palette — the row reappears (recomputed for whatever's active by then)
// the next time "Generate Palette" runs.
export default function PaletteSection({ entries, onRemove }) {
  const [copiedHex, setCopiedHex] = useState(null);

  const copyHex = (hex) => {
    navigator.clipboard.writeText(hex).then(() => {
      setCopiedHex(hex);
      setTimeout(() => setCopiedHex((h) => (h === hex ? null : h)), 1200);
    });
  };

  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">Palette</h3>
      <div className="mt-2 flex flex-col gap-3">
        {entries.map((entry) => (
          <div key={entry.folderId} className="flex items-center gap-3">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <span className="w-20 flex-shrink-0 truncate text-sm font-semibold text-ink-secondary">
                {entry.folderName}
              </span>
              <div className="flex flex-wrap gap-2">
                {entry.palette.map((hex) => (
                  <button
                    key={hex}
                    onClick={() => copyHex(hex)}
                    title={`Copy ${hex}`}
                    className="flex items-center gap-1.5 rounded-full border border-border bg-surface-raised px-2 py-1 font-mono text-xs text-ink-secondary transition-colors hover:border-accent-primary"
                  >
                    <span
                      className="h-4 w-4 rounded-full border border-black/10"
                      style={{ backgroundColor: hex }}
                    />
                    {copiedHex === hex ? "Copied!" : hex}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => onRemove?.(entry.folderId)}
              title={`Remove ${entry.folderName} from Palette`}
              aria-label={`Remove ${entry.folderName} from Palette`}
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink-secondary"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
