export const TIMER_DURATIONS = [25, 30]; // minutes
export const TIMER_DURATION_DEFAULT = 25;

// A board slot's non-destructive display transform — never mutates the
// underlying reference. Resets to this whenever a slot's active reference
// changes (new shuffle pick, manual pick, restore, or fresh upload).
export const DEFAULT_TRANSFORM = {
  rotation: 0,
  mirrored: false,
  grayscale: false,
  crop: null,
};

// CSS transform string for a slot/focus image, mirroring the old
// ReferenceImage.jsx approach.
export function getTransformStyle(transform) {
  const { rotation = 0, mirrored = false } = transform || {};
  return `rotate(${rotation}deg) scaleX(${mirrored ? -1 : 1})`;
}

// clip-path inset() string for a crop rect ({left,top,right,bottom} as
// 0-1 fractions), or undefined when there's no crop.
export function getClipStyle(crop) {
  if (!crop) return undefined;
  return `inset(${crop.top * 100}% ${(1 - crop.right) * 100}% ${(1 - crop.bottom) * 100}% ${crop.left * 100}%)`;
}

// Fisher-Yates shuffle, returns a new array (does not mutate input).
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Pick a random item from a pool, preferring one that isn't `excludeId`
// when the pool has more than one option (so Shuffle visibly changes
// something whenever it can).
export function pickRandom(pool, excludeId) {
  if (pool.length === 0) return null;
  const candidates =
    pool.length > 1 ? pool.filter((r) => r.id !== excludeId) : pool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// A folder counts as "on the board" if it currently has a boardSlots entry
// — true for every folder alike, defaults included, since a default folder
// that's been detached this session is off-board just like any other.
// Never true just because the folder exists in the library — attachment
// stays explicit.
export function isFolderOnBoard(folder, boardSlots) {
  return boardSlots.some((s) => s.folderId === folder.id);
}

// If `folder` is on the board, make `latestRef` its slot's active picture —
// whether the slot was empty or already showing something else. Whatever
// was showing before isn't lost, it just stops being the one displayed
// (same rule dragging a photo onto another folder card uses on the board
// itself: the newest addition is what you see). Used both for the board's
// own "+" upload and for uploading to an on-board folder from the Add
// References archive.
// Returns the same `boardSlots` array (by reference) when nothing should
// change, so callers can skip a no-op state update.
export function setActiveReference(boardSlots, folder, latestRef) {
  if (!folder || !latestRef || !isFolderOnBoard(folder, boardSlots)) return boardSlots;
  const existing = boardSlots.find((s) => s.folderId === folder.id);
  const filled = {
    folderId: folder.id,
    activeReferenceId: latestRef.id,
    locked: existing?.locked || false,
    transform: DEFAULT_TRANSFORM,
  };
  return existing
    ? boardSlots.map((s) => (s.folderId === folder.id ? filled : s))
    : [...boardSlots, filled];
}
