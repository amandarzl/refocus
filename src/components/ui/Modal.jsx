import { useEffect } from "react";
import { Z } from "./zIndex.js";

const MAX_WIDTHS = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
};

// Shared modal shell — the fixed-overlay + backdrop-blur + rounded panel
// chrome that TemplateModal, FinishModal, ConfirmDialog, and the Gallery
// Vault preview lightbox in App.jsx used to each hand-roll separately (each
// with its own slightly different z-index). Callers only ever provide the
// panel's content; this owns the overlay, the click-to-close backdrop, the
// Escape key, and which named z-layer (see zIndex.js) it sits on.
export default function Modal({
  onClose,
  maxWidth = "lg",
  layer = "modal",
  labelledBy,
  children,
}) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const z = Z[layer] ?? Z.modal;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        style={{ zIndex: z }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: z + 1 }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          className={`w-full ${MAX_WIDTHS[maxWidth] ?? MAX_WIDTHS.lg} rounded-panel border border-border bg-surface-overlay text-ink-primary shadow-2xl`}
        >
          {children}
        </div>
      </div>
    </>
  );
}
