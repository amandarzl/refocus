import { db } from "../../db.js";

const MIN_WIDTH = 140;
const MAX_WIDTH = 480;
const STEP = 10;
const DEFAULT_WIDTH = 160; // close to the old S/M/L control's "Small"

// Turns a chosen minimum card width into the folder grid's own style —
// repeat(auto-fill, minmax()) picks however many columns actually fit the
// real container width at that minimum, continuously, at every viewport
// size. This is what replaces the old fixed grid-cols-2/3/4 breakpoint
// table (CARD_SIZE_GRID_CLASSES): there's no longer a fixed set of steps
// that can collide with each other at some in-between window width.
//
// The minmax() minimum is wrapped in min(…, 100%) so it can never exceed
// the container's own width — plain minmax(400px, 1fr) on a narrower-
// than-400px screen forces every track (and the square card inside it,
// via aspect-square) to actually BE 400px wide regardless, overflowing
// past the edge of the screen. min(400px, 100%) instead falls back to
// "100% of the container" once the container itself is the tighter
// constraint, so a single column just fills the available width instead.
export function cardGridStyle(minWidthPx) {
  return { gridTemplateColumns: `repeat(auto-fill, minmax(min(${minWidthPx}px, 100%), 1fr))` };
}

// A single db.settings key ("cardMinWidth") — an accessibility preference
// for the Reference Board's own folder grid, same spot the old S/M/L
// control lived in. Self-contained like that control was: writes straight
// to db.settings on every change, no lifted/staged value, since a
// settings-table write per slider tick is cheap enough here.
export default function CardSizeControl({ value }) {
  const setWidth = (minWidthPx) => {
    db.settings.put({ key: "cardMinWidth", value: minWidthPx });
  };

  // Drives the Chrome/Safari track fill (see index.css's --fill custom
  // property) — Firefox paints its own fill natively via
  // ::-moz-range-progress and ignores this.
  const percent = ((value - MIN_WIDTH) / (MAX_WIDTH - MIN_WIDTH)) * 100;

  return (
    <div className="flex items-center gap-2.5">
      {/* Small/large square-outline icons instead of "S"/"L" text — a
          wordless size cue matching the icon-first buttons (Shuffle,
          Focus Lock, etc.) already sitting in this same toolbar. */}
      <svg className="h-3 w-3 shrink-0 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
        <rect x="7" y="7" width="10" height="10" rx="1.5" />
      </svg>
      <input
        type="range"
        min={MIN_WIDTH}
        max={MAX_WIDTH}
        step={STEP}
        value={value}
        onChange={(e) => setWidth(Number(e.target.value))}
        aria-label="Card size"
        className="card-size-slider h-4 w-28 cursor-pointer"
        style={{ "--fill": `${percent}%` }}
      />
      <svg className="h-5 w-5 shrink-0 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="2" />
      </svg>
    </div>
  );
}

export { MIN_WIDTH, MAX_WIDTH, DEFAULT_WIDTH };
