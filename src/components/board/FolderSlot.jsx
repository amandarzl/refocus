import { getTransformStyle, getClipStyle } from "./constants.js";
import InlineRenameField from "../ui/InlineRenameField.jsx";

// One folder's slot on the Reference Board: shows its current active
// image (or a "+" placeholder when empty), a lock toggle that keeps
// Shuffle from touching it, and small hover controls to add images, clear
// the current picture, or remove this folder's card from the board.
// Deleting a folder (and its photos) for good only ever happens on the Add
// References page, never from here — ✕ never touches the library copy.
//
// ✕ is a two-step, same-spot sequence: on a filled card it clears just the
// picture immediately (folder stays attached, low-stakes — Focus Mode or
// Shuffle can always refill it). Once that leaves the slot empty, ✕ no
// longer clears anything immediately-destructive-feeling by accident — it
// arms a short-lived "Detach?" pill instead of silently swapping what a
// second click on the same spot would do, so removing the folder's card
// itself always takes an explicit, visible confirmation.
//
// While `isRearranging` is on, the card becomes a plain drag surface for
// reordering the board (see ReferenceBoard's Rearrange mode): no click-to-
// open, no overlay buttons, just the picture and a grab cursor — keeps a
// tap from ever being mistaken for the start of a drag.
//
// ✕ is a two-step, same-spot sequence: on a filled card it clears just the
// picture immediately (folder stays attached, low-stakes — Focus Mode or
// Shuffle can always refill it). Once that leaves the slot empty, a second
// ✕ click detaches the folder's card from the board itself immediately —
// no extra confirm step, since detaching never touches the library copy
// (see onDetachFolder).
//
// While `isFocusLocked` is on (ReferenceBoard's board-wide Focus Lock),
// every overlay control disappears and the picture can't be dragged out —
// nothing about the board can change. Opening Focus Mode to view/zoom the
// picture still works, since that's viewing, not altering anything here.
export default function FolderSlot({
  folder,
  activeReference,
  locked,
  transform,
  isRearranging,
  isFocusLocked,
  isDragging,
  cardRef,
  onDragPointerDown,
  onDragPointerMove,
  onDragPointerUp,
  onToggleLock,
  onOpenFocus,
  onOpenUpload,
  onClearSlot,
  onDetachFolder,
  onRenameFolder,
  onPhotoDragStart,
  onPhotoDrop,
  isDropTarget,
}) {
  const isEmpty = !activeReference;

  const borderClass = isRearranging
    ? "touch-none border-dashed border-border"
    : isDropTarget
      ? "border-dashed border-accent-primary"
      : locked && !isEmpty
        ? "border-accent-primary"
        : "border-border";

  return (
    <div className="group relative" data-folder-card>
      <div
        ref={cardRef}
        onPointerDown={isRearranging ? onDragPointerDown : undefined}
        onPointerMove={isRearranging ? onDragPointerMove : undefined}
        onPointerUp={isRearranging ? onDragPointerUp : undefined}
        onPointerCancel={isRearranging ? onDragPointerUp : undefined}
        onDragOver={!isRearranging && !isFocusLocked ? (e) => e.preventDefault() : undefined}
        onDrop={!isRearranging && !isFocusLocked ? onPhotoDrop : undefined}
        className={`relative aspect-square w-full overflow-hidden rounded-panel border-2 bg-surface-sunken transition-colors ${borderClass} ${
          isRearranging ? (isDragging ? "cursor-grabbing" : "cursor-grab") : ""
        } ${isDragging ? "opacity-60" : ""}`}
      >
        {isFocusLocked ? (
          isEmpty ? (
            <div className="flex h-full w-full items-center justify-center text-2xl font-light text-ink-muted">+</div>
          ) : (
            <button onClick={onOpenFocus} className="block h-full w-full" title={`Browse ${folder.name}`}>
              <div className="h-full w-full" style={{ clipPath: getClipStyle(transform?.crop) }}>
                <img
                  src={activeReference.src}
                  alt={folder.name}
                  draggable={false}
                  className={`h-full w-full object-contain ${transform?.grayscale ? "grayscale" : ""}`}
                  style={{ transform: getTransformStyle(transform) }}
                />
              </div>
            </button>
          )
        ) : isRearranging ? (
          isEmpty ? (
            <div className="flex h-full w-full items-center justify-center text-2xl font-light text-ink-muted">+</div>
          ) : (
            <div className="h-full w-full" style={{ clipPath: getClipStyle(transform?.crop) }}>
              <img
                src={activeReference.src}
                alt={folder.name}
                draggable={false}
                className={`h-full w-full select-none object-contain ${transform?.grayscale ? "grayscale" : ""}`}
                style={{ transform: getTransformStyle(transform) }}
              />
            </div>
          )
        ) : isEmpty ? (
          <button
            onClick={onOpenUpload}
            className="flex h-full w-full flex-col items-center justify-center gap-1 text-ink-muted transition-colors hover:text-accent-primary"
            title={`Add references to ${folder.name}`}
          >
            <span className="text-2xl font-light leading-none">+</span>
          </button>
        ) : (
          <>
            <button onClick={onOpenFocus} className="block h-full w-full" title={`Browse ${folder.name}`}>
              <div className="h-full w-full" style={{ clipPath: getClipStyle(transform?.crop) }}>
                <img
                  src={activeReference.src}
                  alt={folder.name}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    onPhotoDragStart?.();
                  }}
                  title={`Drag onto another folder to move it there`}
                  className={`h-full w-full object-contain transition-opacity ${
                    locked ? "opacity-70" : ""
                  } ${transform?.grayscale ? "grayscale" : ""}`}
                  style={{ transform: getTransformStyle(transform) }}
                />
              </div>
            </button>

            {/* Lock toggle */}
            <button
              onClick={onToggleLock}
              title={locked ? "Unlock (Shuffle will re-roll this)" : "Lock (Shuffle will skip this)"}
              aria-label={locked ? "Unlock this reference" : "Lock this reference"}
              className={`absolute left-2 top-2 flex h-9 w-9 items-center justify-center rounded-full text-sm shadow-md transition-colors ${
                locked
                  ? "bg-accent-primary text-accent-primary-ink"
                  : "bg-black/40 text-white opacity-0 backdrop-blur-sm group-hover:opacity-100 focus-visible:opacity-100"
              }`}
            >
              {locked ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              )}
            </button>

            {/* Add more (upload) */}
            <button
              onClick={onOpenUpload}
              title={`Add more to ${folder.name}`}
              aria-label={`Add more to ${folder.name}`}
              className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-base text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            >
              +
            </button>

            {/* Step 1 of ✕: clear this slot's picture — never touches the
                library copy. Once this leaves the slot empty, the block
                below takes over the same top-right spot for step 2. */}
            <button
              onClick={onClearSlot}
              title="Clear this picture (keeps it in Add References)"
              aria-label="Clear this picture"
              className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-sm text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            >
              ✕
            </button>
          </>
        )}

        {/* Step 2 of ✕: once the slot is already empty, detach this
            folder's card from the board itself immediately (keeps the
            folder and its photos in Add References — it just moves to "Add
            existing" until reattached). Works for every folder now,
            defaults included; `isDefault` only controls auto-attaching at
            the start of a new drawing, not permanence afterward. Same
            top-right spot as step 1, always-visible since there's no
            picture left to protect from clutter. */}
        {!isRearranging && !isFocusLocked && isEmpty && (
          <button
            onClick={onDetachFolder}
            title={`Remove "${folder.name}" from this board (keeps it in Add References)`}
            aria-label={`Remove ${folder.name} from this board`}
            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-sm text-white opacity-100 backdrop-blur-sm transition-opacity focus-visible:opacity-100"
          >
            ✕
          </button>
        )}
      </div>

      <div className="mt-2 px-0.5">
        {!isRearranging && !isFocusLocked ? (
          <InlineRenameField
            value={folder.name}
            onSave={onRenameFolder}
            className="text-sm font-semibold text-ink-secondary"
            inputClassName="bg-accent-primary-soft text-sm font-semibold text-ink-primary"
          />
        ) : (
          <span className="block max-w-full truncate text-sm font-semibold text-ink-secondary">{folder.name}</span>
        )}
      </div>
    </div>
  );
}
