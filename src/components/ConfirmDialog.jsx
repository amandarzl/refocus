import Modal from "./ui/Modal.jsx";
import Button from "./ui/Button.jsx";

// Small reusable confirmation modal for destructive actions, on the shared
// Modal shell — reads as part of the app instead of a plain browser
// confirm() popup.
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}) {
  return (
    <Modal onClose={onCancel} maxWidth="sm" layer="confirmDialog" labelledBy="confirm-dialog-title">
      <div className="p-6">
        <h2 id="confirm-dialog-title" className="text-lg font-bold text-ink-primary">
          {title}
        </h2>
        <p className="mt-2 text-sm text-ink-secondary">{message}</p>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} className="px-4 py-2">
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} className="px-4 py-2">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
