import Modal from "./ui/Modal.jsx";
import Button from "./ui/Button.jsx";

export default function TemplateModal({ templates, onClose, onSelect }) {
  return (
    <Modal onClose={onClose} maxWidth="3xl" labelledBy="template-modal-title">
      <div className="max-h-[90vh] overflow-y-auto p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 id="template-modal-title" className="font-display text-xl font-semibold tracking-tight text-ink-primary sm:text-2xl">
              Select your template framework
            </h2>
            <p className="mt-1 text-sm text-ink-secondary">Choose a framework that matches your creative goal.</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-control p-2 text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary"
            title="Close"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Framework Cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className="group flex flex-col rounded-panel border border-border bg-surface-raised p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-accent-primary/60 hover:shadow-2xl"
            >
              {/* Template Icon */}
              <div className="flex h-12 w-12 items-center justify-center rounded-control bg-surface-sunken">
                {template.id === "cute-cozy" && (
                  <svg className="h-6 w-6 text-ink-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                )}
                {template.id === "dynamic-action" && (
                  <svg className="h-6 w-6 text-accent-warm" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )}
                {template.id === "blank-canvas" && (
                  <svg className="h-6 w-6 text-ink-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
                  </svg>
                )}
              </div>

              <h3 className="mt-4 font-display text-base font-semibold text-ink-primary">{template.name}</h3>
              <p className="mt-1 flex-1 text-sm text-ink-secondary">{template.description}</p>

              <Button variant="primary" onClick={() => onSelect(template)} className="mt-5 justify-center py-2.5">
                Select →
              </Button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
