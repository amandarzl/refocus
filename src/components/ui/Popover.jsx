import { useRef } from "react";
import useClickOutside from "../../hooks/useClickOutside.js";
import { Z } from "./zIndex.js";

// Shared dropdown/popover panel — the `absolute ... rounded-panel border
// shadow-2xl` shell that Header.jsx's profile menu, Header.jsx's hamburger
// menu, and AddFolderMenu.jsx each built independently. Owns positioning,
// click-outside, and Escape-to-close; callers provide the panel's content
// (padding included, since a menu list and a form need different insets).
export default function Popover({
  isOpen,
  onClose,
  align = "right",
  placement = "bottom",
  width = "w-56",
  children,
}) {
  const panelRef = useRef(null);
  useClickOutside(panelRef, onClose, isOpen);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      role="menu"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose?.();
      }}
      className={`absolute ${placement === "top" ? "bottom-full mb-2" : "top-full mt-2"} ${
        align === "right" ? "right-0" : "left-0"
      } ${width} overflow-hidden rounded-panel border border-border bg-surface-overlay text-ink-primary shadow-2xl`}
      style={{ zIndex: Z.dropdown }}
    >
      {children}
    </div>
  );
}
