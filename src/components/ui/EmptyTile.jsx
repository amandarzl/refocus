// Shared "nothing here yet" dashed-border tile — the same idiom (dashed
// border + centered content) that AddFolderControl.jsx, FolderSlot.jsx's
// empty slot, PhotoGrid.jsx's two empty states, FinishModal.jsx's upload
// dropzone, and the Hub's Gallery Vault empty states each built with their
// own radius/spacing choices. `size="tile"` is the square grid-cell shape
// (a folder/photo slot); `size="wide"` is the full-width banner shape (an
// upload dropzone, a Gallery Vault empty state).
export default function EmptyTile({
  size = "tile",
  onClick,
  as = onClick ? "button" : "div",
  className = "",
  children,
}) {
  const Tag = as;
  const sizing =
    size === "tile"
      ? "aspect-square rounded-panel"
      : "w-full rounded-panel px-6 py-16";

  return (
    <Tag
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border text-center text-ink-muted transition-colors hover:border-accent-primary hover:text-accent-primary ${sizing} ${className}`}
    >
      {children}
    </Tag>
  );
}
