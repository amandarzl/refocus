import Button from "../ui/Button.jsx";

// Non-blocking "time for a break" prompt. Deliberately a dismissible
// bottom banner, never a modal — the timer is a soft reminder, not a gate.
export default function BreakBanner({ onSnooze, onDismiss }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[65] flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-panel border border-border bg-surface-overlay px-4 py-3 text-ink-primary shadow-2xl">
        <span className="text-lg">☕</span>
        <span className="text-sm font-medium">Time for a break — rest your eyes for a bit.</span>
        <button
          onClick={onSnooze}
          className="rounded-control bg-surface-sunken px-3 py-1.5 text-xs font-semibold text-ink-secondary transition-colors hover:bg-surface-raised"
        >
          Snooze 5m
        </button>
        <Button variant="primary" onClick={onDismiss} className="px-3 py-1.5 text-xs">
          Dismiss
        </Button>
      </div>
    </div>
  );
}
