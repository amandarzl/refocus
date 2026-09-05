import Modal from "./ui/Modal.jsx";
import Button from "./ui/Button.jsx";

// One-time welcome screen for brand-new users, shown once on their first
// hub visit (see App.jsx's hasSeenWelcome setting) — a plain-text
// explainer, not a carousel, since there's only one screen's worth to
// say before the real thing (the board's own Shuffle/Lock/Focus Lock
// controls) takes over via ReferenceBoard.jsx's own first-time callouts.
export default function OnboardingModal({ onDismiss }) {
  return (
    <Modal onClose={onDismiss} maxWidth="md" labelledBy="onboarding-title">
      <div className="p-6 sm:p-8">
        <h2
          id="onboarding-title"
          className="font-display text-xl font-semibold tracking-tight text-ink-primary sm:text-2xl"
        >
          Welcome to ReFocus
        </h2>
        <p className="mt-1 text-sm text-ink-secondary">
          A quick rundown before you dive in:
        </p>

        <ul className="mt-5 space-y-4">
          <li className="flex gap-3">
            <span className="text-xl leading-none">📁</span>
            <p className="text-sm text-ink-secondary">
              <span className="font-semibold text-ink-primary">Folders</span> hold
              your reference photos. Add a few, or grab suggestions the moment you
              start a drawing.
            </p>
          </li>
          <li className="flex gap-3">
            <span className="text-xl leading-none">🔀</span>
            <p className="text-sm text-ink-secondary">
              <span className="font-semibold text-ink-primary">Shuffle</span> swaps
              in a fresh picture from each folder whenever you want a new angle.
            </p>
          </li>
          <li className="flex gap-3">
            <span className="text-xl leading-none">🔒</span>
            <p className="text-sm text-ink-secondary">
              <span className="font-semibold text-ink-primary">Lock</span> a
              picture you like so Shuffle leaves it alone, or hit{" "}
              <span className="font-semibold text-ink-primary">Focus Lock</span>{" "}
              to hide every control and just draw.
            </p>
          </li>
        </ul>

        <Button
          variant="primary"
          onClick={onDismiss}
          className="mt-7 w-full justify-center py-3 shadow-card"
        >
          Let's start
        </Button>
      </div>
    </Modal>
  );
}
