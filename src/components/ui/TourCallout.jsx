import Popover from "./Popover.jsx";

// One step of the board's first-time-only tour (see ReferenceBoard.jsx's
// tourStep) — the same absolute-positioned panel every dropdown in this
// app already uses, just with a message and Next/Skip instead of a menu.
// Mount it inside whatever `relative`-positioned element the step should
// point at; `align`/`placement` forward straight to Popover for that.
export default function TourCallout({
  message,
  advanceLabel = "Next",
  onAdvance,
  onSkip,
  align = "left",
  placement = "bottom",
}) {
  return (
    <Popover isOpen onClose={onAdvance} align={align} placement={placement} width="w-64">
      <div className="p-4">
        <p className="text-sm text-ink-secondary">{message}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            onClick={onSkip}
            className="text-xs font-semibold text-ink-muted underline transition-colors hover:text-ink-primary"
          >
            Skip tour
          </button>
          <button
            onClick={onAdvance}
            className="rounded-control bg-accent-primary px-3 py-1.5 text-xs font-bold text-accent-primary-ink transition-colors hover:bg-accent-primary-hover"
          >
            {advanceLabel}
          </button>
        </div>
      </div>
    </Popover>
  );
}
