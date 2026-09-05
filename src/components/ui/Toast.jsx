import { useEffect } from "react";
import Button from "./Button.jsx";
import { Z } from "./zIndex.js";

// A brief, dismissible confirmation with an "Undo" escape hatch — the
// safety net for actions that already act immediately (a one-click photo
// delete) or that already went through their own confirm dialog (bulk
// delete, folder delete) but are still worth one more chance to reverse.
// Purely presentational: the actual "don't really delete yet" logic lives
// wherever the caller schedules its own commit timer (see
// ReferenceLibrary.jsx's pendingDelete) — this just mirrors that window
// with its own auto-dismiss so the toast doesn't linger after it expires.
export default function Toast({ message, onUndo, onDismiss, duration = 5000 }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [message, onDismiss, duration]);

  return (
    <div
      className="fixed inset-x-0 bottom-6 flex justify-center px-4"
      style={{ zIndex: Z.toast }}
    >
      <div
        role="status"
        className="pointer-events-auto flex items-center gap-3 rounded-panel border border-border bg-surface-overlay px-4 py-3 text-sm text-ink-primary shadow-2xl"
      >
        <span>{message}</span>
        <Button variant="ghost" onClick={onUndo} className="px-2 py-1 text-xs font-bold uppercase tracking-wider">
          Undo
        </Button>
      </div>
    </div>
  );
}
