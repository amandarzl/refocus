// Non-blocking "time for a break" prompt. Deliberately a dismissible
// bottom banner, never a modal — the timer is a soft reminder, not a gate.
export default function BreakBanner({ isDark, onSnooze, onDismiss }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[65] flex justify-center px-4">
      <div
        className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl ${
          isDark
            ? "border-zinc-700 bg-[#242428] text-slate-100"
            : "border-slate-200 bg-white text-slate-900"
        }`}
      >
        <span className="text-lg">☕</span>
        <span className="text-sm font-medium">Time for a break — rest your eyes for a bit.</span>
        <button
          onClick={onSnooze}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            isDark
              ? "bg-zinc-800 text-slate-300 hover:bg-zinc-700"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Snooze 5m
        </button>
        <button
          onClick={onDismiss}
          className="rounded-lg bg-[#A8C3A4] px-3 py-1.5 text-xs font-bold text-black transition-colors hover:bg-[#97b593]"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
