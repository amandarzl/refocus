import { useEffect } from "react";

// Fires `onOutside` on any mousedown outside the element `ref` is attached
// to. Extracted from the click-outside handler Header.jsx used to hand-roll
// separately for its profile and hamburger dropdowns — same logic, one
// place. `active` lets a caller skip attaching the listener entirely while
// the popover it belongs to is closed.
export default function useClickOutside(ref, onOutside, active = true) {
  useEffect(() => {
    if (!active) return;
    const handlePointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        onOutside(event);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [ref, onOutside, active]);
}
